import { NextResponse } from 'next/server';
import { toEngineScenario } from '../../../../../contract/engine-adapter';
import { CrowdGroupSchema, EventSchema, FlowBoardSchema, VenueSchema, type FlowBoard } from '../../../../../contract/schemas';
import { runAblation } from '../../../../../engine/ablation';
import { computeDecisionBoard } from '../../../../../engine/decisionWindow';
import { runEnsemble } from '../../../../../engine/ensemble';
import type { Lever } from '../../../../../engine/interventions';
import type { Scenario, SimResult } from '../../../../../engine/types';
import { optimiseProfile } from '../../../../../engine/optimise';
import { probeWaits, simulate } from '../../../../../engine/simulate';
import { buildConsoleState, type ActionState } from '../../../../../lib/server/console/buildConsoleState';
import { buildFlowBoard } from '../../../../../lib/server/console/buildFlowBoard';
import { publishPlan } from '../../../../../lib/server/publish/publish';
import { getServiceRoleClient } from '../../../../../lib/server/supabase/client';

/** Builds the board and validates it against FlowBoardSchema before it ever reaches a client —
 * an invalid board is a bug in buildFlowBoard.ts, not something the UI should have to guard
 * against, so it's logged and left out rather than shipped. */
function buildValidatedFlowBoard(eventId: string, scenario: Scenario, base: SimResult): FlowBoard | undefined {
  const board = buildFlowBoard(scenario, base);
  const parsed = FlowBoardSchema.safeParse(board);
  if (!parsed.success) {
    console.error(`flowBoard failed validation for event "${eventId}":`, parsed.error);
    return undefined;
  }
  return parsed.data;
}

const ENSEMBLE_RUNS = 30;

async function loadScenarioAndPlan(supabase: ReturnType<typeof getServiceRoleClient>, eventId: string) {
  const { data: eventRow, error: eventError } = await supabase.from('events').select('data, venue_id').eq('id', eventId).single();
  if (eventError || !eventRow) throw new Error(`event "${eventId}" not found`);
  const event = EventSchema.parse(eventRow.data);

  const { data: venueRow, error: venueError } = await supabase.from('venues').select('data').eq('id', eventRow.venue_id).single();
  if (venueError || !venueRow) throw new Error(`venue "${eventRow.venue_id}" not found`);
  const venue = VenueSchema.parse(venueRow.data);

  const { data: groupRows, error: groupError } = await supabase.from('crowd_groups').select('data').eq('event_id', eventId);
  if (groupError) throw groupError;
  const groups = (groupRows ?? []).map((r) => CrowdGroupSchema.parse(r.data));

  const scenario = toEngineScenario(event, venue, groups);
  const waits = probeWaits(scenario);
  const base = simulate(scenario, [], { waits });
  const ensemble = runEnsemble(scenario, ENSEMBLE_RUNS, base.worst.zone);
  const ablation = runAblation(scenario, base, waits);
  const plan = optimiseProfile(scenario, 'Balanced', waits);
  const decisionBoard = computeDecisionBoard(scenario, plan.chosen);

  return { event, scenario, base, ensemble, ablation, plan, decisionBoard };
}

async function loadActionStates(supabase: ReturnType<typeof getServiceRoleClient>, eventId: string): Promise<ActionState> {
  const { data } = await supabase.from('console_actions').select('action_id,state').eq('event_id', eventId);
  const states: ActionState = {};
  for (const row of data ?? []) states[row.action_id] = row.state;
  return states;
}

/** GET builds the current ConsoleState for `id` — never edits engine/, no hardcoded service. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  let supabase;
  try {
    supabase = getServiceRoleClient();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Supabase not configured' }, { status: 503 });
  }

  try {
    const built = await loadScenarioAndPlan(supabase, eventId);
    const actionStates = await loadActionStates(supabase, eventId);
    const { data: publishedPlan } = await supabase.from('plans').select('id').eq('event_id', eventId).eq('status', 'published').maybeSingle();

    const state = await buildConsoleState({ ...built, actionStates, published: !!publishedPlan });
    const flowBoard = buildValidatedFlowBoard(eventId, built.scenario, built.base);
    return NextResponse.json(flowBoard ? { ...state, flowBoard } : state);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'could not build console state' }, { status: 500 });
  }
}

/** POST { action: 'approve'|'skip', actionId } or { action: 'publish' }. Approve/skip persist to
 * console_actions; publish builds a Plan from every currently-approved lever, then calls the
 * real publishPlan() (bumps plans.version, appends the ledger entry). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  let supabase;
  try {
    supabase = getServiceRoleClient();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Supabase not configured' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'expected JSON body' }, { status: 400 });
  }
  const b = (body ?? {}) as { action?: string; actionId?: string };

  try {
    if (b.action === 'approve' || b.action === 'skip') {
      if (!b.actionId) return NextResponse.json({ error: 'missing "actionId"' }, { status: 400 });
      const state = b.action === 'approve' ? 'approved' : 'skipped';
      const { error } = await supabase.from('console_actions').upsert({ event_id: eventId, action_id: b.actionId, state, updated_at: new Date().toISOString() });
      if (error) throw error;
      const built = await loadScenarioAndPlan(supabase, eventId);
      const actionStates = await loadActionStates(supabase, eventId);
      const { data: publishedPlan } = await supabase.from('plans').select('id').eq('event_id', eventId).eq('status', 'published').maybeSingle();
      const consoleState = await buildConsoleState({ ...built, actionStates, published: !!publishedPlan });
      const flowBoard = buildValidatedFlowBoard(eventId, built.scenario, built.base);
      return NextResponse.json(flowBoard ? { ...consoleState, flowBoard } : consoleState);
    }

    if (b.action === 'publish') {
      const built = await loadScenarioAndPlan(supabase, eventId);
      const actionStates = await loadActionStates(supabase, eventId);
      const approvedIds = new Set(Object.entries(actionStates).filter(([, s]) => s === 'approved').map(([id]) => id));
      if (!approvedIds.size) return NextResponse.json({ error: 'nothing approved yet' }, { status: 409 });

      // rebuild the id->lever mapping the same deterministic way buildConsoleState does
      const leverIds = built.plan.chosen.map((iv: Lever, i: number) => `act_${eventId}_${i}_${iv.type}`);
      const levers = built.plan.chosen.filter((_, i) => approvedIds.has(leverIds[i]));

      const planId = `plan_${eventId}_console`;
      const { data: existing } = await supabase.from('plans').select('version').eq('id', planId).maybeSingle();
      const { error: upsertErr } = await supabase.from('plans').upsert({ id: planId, event_id: eventId, status: 'approved', data: levers, version: existing?.version ?? 0 });
      if (upsertErr) throw upsertErr;

      const result = await publishPlan(eventId, planId);
      return NextResponse.json(result, { status: result.ok ? 200 : 409 });
    }

    return NextResponse.json({ error: `unknown action "${b.action}"` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'console action failed' }, { status: 500 });
  }
}
