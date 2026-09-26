import type { Scenario } from '../engine/types';
import type { CrowdGroup, Event, Venue } from './schemas';

/**
 * event + venue + groups -> engine Scenario. Signature only — see CLAUDE.md ("Engine first,
 * golden test green, then UI"): nobody implements this until the golden test exists to hold it
 * accountable, and engine/ needs zero changes to receive its output.
 *
 * DOCUMENTED RULE for CrowdGroup.mean/std (every implementation must read these from Event/Venue —
 * never invent a literal number here or in the implementation's constants):
 *
 *  1. A registration's normalized.travelMode picks the matching entry in event.transportOptions.
 *     That option's transportPointId must appear in some venue.entrances[].transportPointIds —
 *     that entrance is where this registrant's path onto the venue graph starts.
 *  2. Within [event.gatesOpen, event.showStart] (the ticket entry window — there is no separate
 *     field for it), the option's timetable entries are the arrival pulses; the registration
 *     belongs to the pulse whose arrivalTime is nearest its own booking/entry data, and that
 *     pulse's timetableEntry.pulseSize sets the CrowdGroup's size for that pulse.
 *  3. mean = timetableEntry.arrivalTime, adjusted by the walk/road travel time the venue graph
 *     implies from that transportPointId to a gate in the matched entrance's gateIds (via
 *     venue.entrances[].gateIds), then pulled toward event.showStart by however much the
 *     [gatesOpen, showStart] window compresses arrivals for that travelMode.
 *  4. std = the spread already implied by how closely that option's consecutive timetable entries
 *     cluster around the matched pulse, widened for a travelMode with only one entry (a single
 *     data point implies less certainty than several).
 *  5. path/alt = the shortest/second-shortest walk from the matched entrance to its gateIds
 *     through the venue graph (Venue.entrances -> Venue.gates) — never typed in on Registration.
 *  6. Every Trusted<number> read out of Venue/Event (lanes, laneRate, capacity, rooms, ...) is
 *     discounted through config/trust.ts's TRUST_CAPACITY_DISCOUNT before it becomes a plain
 *     engine number, and anything not "observed" sets the engine field's `estimated: true`. This
 *     function is the only caller of that table — the discount is never duplicated or hidden
 *     anywhere else.
 *
 * Not implemented here. Whoever implements this reads engine/types.ts's Scenario/Zone/Link/Cohort
 * shapes and this comment, not a new spec.
 */
export declare function toEngineScenario(event: Event, venue: Venue, groups: CrowdGroup[]): Scenario;
