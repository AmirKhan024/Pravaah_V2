import type { Scenario, SimResult } from '../../../engine/types';

export interface PeopleAccounting {
  totalRegistered: number;
  unrouted: number;
  routed: number;
  entered: number;
  stillInTransit: number;
  /** routed - entered - stillInTransit, floored at 0 — people who registered, were routed, but
   * neither arrived nor are still moving by the end of the simulated window. NOT the same as
   * engine's own SimResult.missed (= venue capacity minus arrived — capacity-relative, can exceed
   * the number of people who ever registered). This is people-relative: entered + missed +
   * stillInTransit + unrouted always equals totalRegistered, by construction. */
  missed: number;
}

/**
 * The one place "missed" is computed for reporting. `unrouted` must be the PEOPLE count (sum of
 * groupSize) of registrations buildGroups.ts couldn't route, not a row count.
 */
export function computePeopleAccounting(scenario: Scenario, base: SimResult, unrouted: number): PeopleAccounting {
  const routed = scenario.cohorts.reduce((s, c) => s + c.size, 0);
  const finalFrame = base.frames[base.frames.length - 1];
  const venueIdx = scenario.zones.findIndex((z) => z.type === 'venue');

  const entered = venueIdx >= 0 ? Math.round(finalFrame?.zoneOcc[venueIdx] ?? 0) : 0;
  const linkOcc = scenario.links.reduce((s, _l, i) => s + (finalFrame?.linkOcc[i] ?? 0), 0);
  const nonVenueZoneOcc = scenario.zones.reduce((s, z, i) => s + (z.type !== 'venue' ? (finalFrame?.zoneOcc[i] ?? 0) : 0), 0);
  const stillInTransit = Math.round(linkOcc + nonVenueZoneOcc);

  const missed = Math.max(0, routed - entered - stillInTransit);

  return { totalRegistered: routed + unrouted, unrouted, routed, entered, stillInTransit, missed };
}
