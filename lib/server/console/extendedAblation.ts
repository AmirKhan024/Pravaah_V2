import type { AblationRow } from '../../../engine/ablation';
import { simulate } from '../../../engine/simulate';
import type { Scenario, SimResult } from '../../../engine/types';

/** assumption: how much a cause is "removed" by, for measuring its contribution — not a claim
 * this much capacity/spread is actually achievable, just a consistent yardstick across causes. */
const BOOST_FACTOR = 3;

/**
 * Extends engine/ablation.ts's own rows (routing mismatch, rail pulses) with three more causes,
 * each measured the same way runAblation() measures its own: re-simulate with that one constraint
 * relaxed, and report how many dangerous minutes disappear. Never edits engine/ — only calls its
 * already-exported simulate().
 */
export function extendedAblation(scenario: Scenario, base: SimResult, waits: Record<string, number>, engineRows: AblationRow[]): AblationRow[] {
  const B = base.crushMin;
  const rows: AblationRow[] = [...engineRows];

  const gateBoosted: Scenario = { ...scenario, zones: scenario.zones.map((z) => (z.type === 'gate' ? { ...z, lanes: (z.lanes ?? 1) * BOOST_FACTOR } : z)) };
  const rGate = simulate(gateBoosted, [], { waits, lite: true });
  rows.push({ name: 'Gate capacity shortage', detail: `all gates at ${BOOST_FACTOR}x their expected lanes`, removed: B - rGate.crushMin, left: rGate.crushMin });

  const linkBoosted: Scenario = { ...scenario, links: scenario.links.map((l) => (l.mode !== 'gate' && l.cap ? { ...l, cap: l.cap * BOOST_FACTOR } : l)) };
  const rLink = simulate(linkBoosted, [], { waits, lite: true });
  rows.push({ name: 'Approach/link capacity', detail: `every approach link at ${BOOST_FACTOR}x its capacity`, removed: B - rLink.crushMin, left: rLink.crushMin });

  const spreadOut: Scenario = { ...scenario, cohorts: scenario.cohorts.map((c) => ({ ...c, std: c.std * BOOST_FACTOR })) };
  const rSpread = simulate(spreadOut, [], { waits, lite: true });
  rows.push({ name: 'Arrival concentration', detail: `arrivals spread over ${BOOST_FACTOR}x the time window`, removed: B - rSpread.crushMin, left: rSpread.crushMin });

  return rows.sort((a, b) => b.removed - a.removed);
}

/** One honest sentence naming the biggest cause, with its own numbers — never invents a cause
 * that isn't the top-ranked row. */
export function ablationSummary(rows: AblationRow[], baseCrushMin: number): string {
  if (!rows.length || baseCrushMin <= 0) return 'No dangerous minutes to explain.';
  const top = rows[0];
  const pct = Math.round((top.removed / baseCrushMin) * 100);
  return `${top.name} is the main cause: removing it cuts ${top.removed} of ${baseCrushMin} dangerous minutes (${pct}%).`;
}
