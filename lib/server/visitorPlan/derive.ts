import type { CrowdGroup, Event, InterventionShape, Venue } from '../../../contract/schemas';
import { VISITOR_LEAVE_BUFFER_MIN } from '../../../config/server-extras';
import { minutesToClock, parseHHMM } from '../scenario/arrivalRules';

export interface DerivedVisitorFields {
  gateName: string;
  leaveTimeClock: string;
  travelDepartClock: string;
  stay: { hotelName: string; coach: boolean } | null;
}

/**
 * Deterministic, no LLM: the group's own path/mean (arrivalRules.ts), adjusted by whichever of the
 * published plan's levers target this group, using engine/interventions.ts's own semantics —
 * `stagger`/`nudge(ask:"shift")` shift the arrival tick, `nudge(ask:"reroute")` switches to the
 * group's alternate path, `house` puts a late-booked group into a hotel.
 */
export function deriveVisitorFields(group: CrowdGroup, venue: Venue, event: Event, levers: InterventionShape[]): DerivedVisitorFields {
  let path = group.path;
  let mean = group.mean;

  for (const lever of levers) {
    if (lever.type === 'stagger' && lever.cohort === group.id) {
      mean += lever.delta;
    }
    if (lever.type === 'nudge' && lever.cohort === group.id) {
      if (lever.ask === 'shift' && typeof lever.delta === 'number') mean += lever.delta;
      if (lever.ask === 'reroute' && group.alt) path = group.alt;
    }
  }

  const gateId = path[path.length - 1];
  const gateName = venue.gates.find((g) => g.id === gateId)?.name ?? gateId;

  const gatesOpenMin = parseHHMM(event.gatesOpen);
  const arrivalAbsMin = gatesOpenMin + mean;
  const leaveAbsMin = Math.max(0, arrivalAbsMin - VISITOR_LEAVE_BUFFER_MIN);

  let stay: DerivedVisitorFields['stay'] = null;
  if (levers.some((l) => l.type === 'house') && group.housed && group.housed.length > 0) {
    const hotelId = group.housed[0];
    const hotelName = event.hotels.find((h) => h.id === hotelId)?.name ?? hotelId;
    stay = { hotelName, coach: true };
  }

  return { gateName, leaveTimeClock: minutesToClock(leaveAbsMin), travelDepartClock: minutesToClock(arrivalAbsMin), stay };
}
