import { toEngineScenario } from '../../../contract/engine-adapter';
import { CrowdGroupSchema, EventSchema, VenueSchema } from '../../../contract/schemas';
import { runAblation } from '../../../engine/ablation';
import { computeDecisionBoard } from '../../../engine/decisionWindow';
import { runEnsemble } from '../../../engine/ensemble';
import { optimiseProfile } from '../../../engine/optimise';
import { probeWaits, simulate } from '../../../engine/simulate';
import { buildConsoleState, type ActionState } from '../console/buildConsoleState';
import { getServiceRoleClient } from '../supabase/client';
import { append } from '../ledger/ledger';
import type { ScenarioPatch } from './types';

const ENSEMBLE_RUNS = 30;

export interface RerunResult {
  ok: boolean;
  reason?: string;
}

/**
 * When applyReport() (replan.ts) says needsRerun, this is the one place that actually re-runs the
 * evening: past minutes are locked (cohorts whose mean arrival tick is already behind
 * patch.capPatch.fromTick keep their original size — only what hasn't happened yet is patched),
 * the engine's own SimOptions.patch carries the capacity change, the optimiser runs again on the
 * patched scenario, and the console's suggested actions are rebuilt from the new result. Saves a
 * new simulation_results row and appends one ledger entry. Never edits engine/.
 */
export async function rerunFromPatch(eventId: string, patch: ScenarioPatch, triggerDetail: string): Promise<RerunResult> {
  let supabase;
  try {
    supabase = getServiceRoleClient();
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Supabase not configured' };
  }

  try {
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

    // past minutes are locked: only cohorts whose mean arrival hasn't happened yet get resized
    const fromTick = patch.capPatch.fromTick ?? 0;
    if (patch.sizeMultiplier !== 1) {
      scenario.cohorts = scenario.cohorts.map((c) => (c.mean >= fromTick ? { ...c, size: Math.round(c.size * patch.sizeMultiplier) } : c));
    }

    const simOpts = { patch: patch.capPatch };
    const waits = probeWaits(scenario, simOpts);
    const base = simulate(scenario, [], { ...simOpts, waits });
    const ensemble = runEnsemble(scenario, ENSEMBLE_RUNS, base.worst.zone);
    const ablation = runAblation(scenario, base, waits);
    const plan = optimiseProfile(scenario, 'Balanced', waits, { opts: simOpts });
    const decisionBoard = computeDecisionBoard(scenario, plan.chosen);

    const { data: actionRows } = await supabase.from('console_actions').select('action_id,state').eq('event_id', eventId);
    const actionStates: ActionState = {};
    for (const row of actionRows ?? []) actionStates[row.action_id] = row.state;
    const { data: publishedPlan } = await supabase.from('plans').select('id').eq('event_id', eventId).eq('status', 'published').maybeSingle();

    const consoleState = await buildConsoleState({ event, scenario, base, ensemble, ablation, plan, decisionBoard, actionStates, published: !!publishedPlan });

    const summary = {
      eventId,
      trigger: triggerDetail,
      dangerousMinutes: base.crushMin,
      missedShow: base.missed,
      dangerProbability: ensemble.p,
      consoleState,
    };
    await supabase.from('simulation_results').upsert({ id: `sim_${eventId}_${Date.now()}`, event_id: eventId, data: summary });

    await append(eventId, {
      ts: new Date().toISOString(),
      simClock: '',
      type: 'forecast_issued',
      summary: `Re-simulated from a live report: ${triggerDetail}`,
      payload: { trigger: triggerDetail, fromTick, crushMin: base.crushMin },
    });

    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'rerun failed' };
  }
}
