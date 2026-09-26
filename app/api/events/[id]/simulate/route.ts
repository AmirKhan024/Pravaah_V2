import { NextResponse } from 'next/server';
import { toEngineScenario } from '../../../../../contract/engine-adapter';
import { CrowdGroupSchema, EventSchema, VenueSchema } from '../../../../../contract/schemas';
import { minutesToClock } from '../../../../../lib/server/scenario/arrivalRules';
import { getServiceRoleClient } from '../../../../../lib/server/supabase/client';
import { probeWaits, simulate } from '../../../../../engine/simulate';
import { runEnsemble } from '../../../../../engine/ensemble';
import { runAblation } from '../../../../../engine/ablation';
import { optimiseProfile } from '../../../../../engine/optimise';

const ENSEMBLE_RUNS = 60;

/**
 * Loads event/venue/crowd_groups for `id` from Supabase, builds an engine Scenario via
 * toEngineScenario(), runs simulate + ensemble + ablation + optimiser, returns a short summary,
 * and saves it to simulation_results. Read-only against engine/ — never edits it.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;

  let supabase;
  try {
    supabase = getServiceRoleClient();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Supabase not configured' }, { status: 503 });
  }

  const { data: eventRow, error: eventError } = await supabase.from('events').select('data, venue_id').eq('id', eventId).single();
  if (eventError || !eventRow) return NextResponse.json({ error: `event "${eventId}" not found` }, { status: 404 });
  const eventParsed = EventSchema.safeParse(eventRow.data);
  if (!eventParsed.success) return NextResponse.json({ error: 'stored event failed validation', issues: eventParsed.error.issues }, { status: 500 });

  const { data: venueRow, error: venueError } = await supabase.from('venues').select('data').eq('id', eventRow.venue_id).single();
  if (venueError || !venueRow) return NextResponse.json({ error: `venue "${eventRow.venue_id}" not found` }, { status: 404 });
  const venueParsed = VenueSchema.safeParse(venueRow.data);
  if (!venueParsed.success) return NextResponse.json({ error: 'stored venue failed validation', issues: venueParsed.error.issues }, { status: 500 });

  const { data: groupRows, error: groupError } = await supabase.from('crowd_groups').select('data').eq('event_id', eventId);
  if (groupError) return NextResponse.json({ error: groupError.message }, { status: 500 });
  const groups = (groupRows ?? []).map((r) => CrowdGroupSchema.parse(r.data));

  const event = eventParsed.data;
  const venue = venueParsed.data;
  const scenario = toEngineScenario(event, venue, groups);

  const waits = probeWaits(scenario);
  const base = simulate(scenario, [], { waits });
  const ensemble = runEnsemble(scenario, ENSEMBLE_RUNS, base.worst.zone);
  const ablation = runAblation(scenario, base, waits);
  const plan = optimiseProfile(scenario, 'Balanced', waits);

  const clock = (tick: number) => minutesToClock(scenario.t0Min + tick);
  const firstDangerousTick = base.crushSeries.findIndex((v) => v > 0);

  // expectedCountsPerGate: total simulated throughput at each gate's concourse link, summed
  // across every frame's flow — the baseline lib/server/live/gateScanDrift.ts compares a live
  // gate_scan report against (see that file's SimulationResultPayloadSchema).
  const expectedCountsPerGate: Record<string, number> = {};
  for (const g of venue.gates) {
    const linkIdx = scenario.links.findIndex((l) => l.id === `link_${g.id}_venue`);
    if (linkIdx < 0) continue;
    expectedCountsPerGate[g.id] = Math.round(base.frames.reduce((s, f) => s + (f.linkFlow[linkIdx] || 0), 0));
  }

  const summary = {
    eventId,
    dangerousMinutes: base.crushMin,
    firstDangerousMinute: firstDangerousTick >= 0 ? clock(firstDangerousTick) : null,
    peakDensity: Math.round(base.worst.den * 100) / 100,
    peakZone: scenario.zones[base.worst.zone]?.name ?? scenario.zones[base.worst.zone]?.id ?? null,
    missedShow: base.missed,
    dangerProbability: ensemble.p,
    topPlan: {
      levers: plan.chosen.map((c) => c.label),
      rupeesCost: plan.result.rupees,
      crushMinutes: plan.result.crushMin,
      missed: plan.result.missed,
    },
    ablation: ablation.map((a) => ({ name: a.name, detail: a.detail, removed: a.removed, left: a.left })),
    expectedCountsPerGate,
  };

  const { error: saveError } = await supabase.from('simulation_results').upsert({ id: `sim_${eventId}_${Date.now()}`, event_id: eventId, data: summary });

  return NextResponse.json({ summary, saved: !saveError, ...(saveError ? { saveError: saveError.message } : {}) });
}
