import type { Scenario, SimResult } from '../../../engine/types';

export interface PeopleAccounting {
  totalRegistered: number;
  unrouted: number;
  routed: number;
  entered: number;
  stillInTransit: number;
  /** routed - entered - stillInTransit, floored at 0 — see rawMissed for the unfloored value.
   * NOT the same as engine's own SimResult.missed (= venue capacity minus arrived — capacity-
   * relative, can exceed the number of people who ever registered). This is people-relative:
   * entered + missed + stillInTransit + unrouted always equals totalRegistered, by construction. */
  missed: number;
  /** unfloored routed - entered - stillInTransit. Should never be negative — a negative value
   * means people are being double-counted somewhere (entered and "in transit" overlapping, or a
   * zone/link miscategorized). Tests assert this directly instead of relying on the floor to hide
   * it (see peopleAccounting.test.ts). */
  rawMissed: number;
}

/**
 * The one place "missed" is computed for reporting. Evaluated at `atTick` (default:
 * scenario.showStartTick) — engine's own SimResult.missed is a snapshot AT showStartTick, not at
 * the end of the simulated horizon (engine/simulate.ts: `if (t === scn.showStartTick) missed = ...`),
 * so this matches that same evaluation point rather than the horizon end, where more people would
 * have already arrived and understate how many were still short at showtime itself.
 * `unrouted` must be the PEOPLE count (sum of groupSize) of registrations buildGroups.ts couldn't
 * route, not a row count.
 */
export function computePeopleAccounting(scenario: Scenario, base: SimResult, unrouted: number, atTick: number = scenario.showStartTick): PeopleAccounting {
  const routed = scenario.cohorts.reduce((s, c) => s + c.size, 0);
  const tick = Math.max(0, Math.min(atTick, base.frames.length - 1));
  const frame = base.frames[tick];
  const venueIdx = scenario.zones.findIndex((z) => z.type === 'venue');

  const entered = venueIdx >= 0 ? Math.round(frame?.zoneOcc[venueIdx] ?? 0) : 0;
  const linkOcc = scenario.links.reduce((s, _l, i) => s + (frame?.linkOcc[i] ?? 0), 0);
  const nonVenueZoneOcc = scenario.zones.reduce((s, z, i) => s + (z.type !== 'venue' ? (frame?.zoneOcc[i] ?? 0) : 0), 0);
  const stillInTransit = Math.round(linkOcc + nonVenueZoneOcc);

  const rawMissed = routed - entered - stillInTransit;
  const missed = Math.max(0, rawMissed);

  return { totalRegistered: routed + unrouted, unrouted, routed, entered, stillInTransit, missed, rawMissed };
}
