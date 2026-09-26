/**
 * Implements the documented rule from contract/engine-adapter.ts's toEngineScenario() doc comment.
 *
 * mean/std: anchored to event.showStart, per mode — config.arrivalAssumptions.SHOW_ANCHORED_ARRIVAL
 * says "this mode peaks N minutes before showStart, with spread S" (an assumption, not a
 * measurement), clamped into [gatesOpen, showStart]. Previously this was the timetable's own
 * pulseSize-weighted mean — but that has no real anchor to the show itself (a mode's people would
 * "arrive" whenever its vehicles happen to run, even if that drifted away from the show), so it's
 * replaced rather than blended. This is NOT "the first vehicle's time" — every timetable entry
 * still matters, just for sizing pulses (see derivePulse), not for timing the mean.
 *
 * path/alt: from walking Venue.entrances -> Venue.gates, never typed in.
 *
 * Both lib/server/registrations/buildGroups.ts (Step 1) and the eventual toEngineScenario()
 * implementation (Step 2) call these same functions, so the rule is defined exactly once.
 *
 * Tick convention: mean is in minutes relative to event.gatesOpen (tick 0 = gatesOpen). Step 2's
 * toEngineScenario may pick an earlier Scenario.t0Min and shift every mean by a constant offset —
 * that shift is Step 2's responsibility, not this file's.
 */
import { ARRIVAL_ASSUMPTIONS } from '../../../config/arrivalAssumptions';
import type { Event, EventTransportOption, Pulse, TransportMode, TravelMode, Venue } from '../../../contract/schemas';

export function parseHHMM(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Inverse of parseHHMM, for reporting a tick/minute value as a clock time (e.g. 1125 -> "18:45"). */
export function minutesToClock(minutesAfterMidnight: number): string {
  const total = Math.round(minutesAfterMidnight) % (24 * 60);
  const norm = total < 0 ? total + 24 * 60 : total;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** The registration's travelMode picks the matching EventTransportOption — step 1 of the documented rule. */
export function findMatchingTransportOption(travelMode: TravelMode, event: Event): EventTransportOption | undefined {
  return event.transportOptions.find((o) => o.mode === travelMode);
}

export interface DerivePathInput {
  option: EventTransportOption;
  venue: Venue;
  gateHint: string | null;
}

export interface DerivedPath {
  entranceId: string;
  gateId: string;
  path: string[];
  alt?: string[];
}

/**
 * Walks Venue.entrances -> Venue.gates from the matched transport point. Returns null ("do not
 * guess") when that transport point isn't linked to any entrance — the caller must treat those
 * people as unrouted, never assign them a gate anyway.
 */
export function derivePath({ option, venue, gateHint }: DerivePathInput): DerivedPath | null {
  const entrance = venue.entrances.find((e) => e.transportPointIds.includes(option.transportPointId));
  if (!entrance) return null;

  const hint = gateHint?.trim().toLowerCase();
  const hintedGateId = hint
    ? entrance.gateIds.find((gid) => {
        if (gid.toLowerCase() === hint) return true;
        const gate = venue.gates.find((g) => g.id === gid);
        return gate?.name.toLowerCase() === hint;
      })
    : undefined;

  // No distance model between an entrance and its gates yet (Venue carries no gate coordinates) —
  // the first-listed gate is the deterministic default until one exists.
  const gateId = hintedGateId ?? entrance.gateIds[0];
  const altGateId = entrance.gateIds.find((gid) => gid !== gateId);

  return {
    entranceId: entrance.id,
    gateId,
    path: [option.transportPointId, entrance.id, gateId],
    alt: altGateId ? [option.transportPointId, entrance.id, altGateId] : undefined,
  };
}

const RAIL_MODES: ReadonlySet<TransportMode> = new Set(['train', 'metro']);

/**
 * Rail modes (train, metro) run in bursts, not a steady trickle — Cohort.pulse captures that
 * (see engine/types.ts). period/width come from the Event timetable's own entry spacing, never
 * invented, except the width-as-a-fraction-of-period ratio (config, labeled assumption). Needs at
 * least 2 timetable entries to imply a period; a single entry has no spacing to derive from.
 */
export function derivePulse(option: EventTransportOption): Pulse | undefined {
  if (!RAIL_MODES.has(option.mode) || option.timetable.length < 2) return undefined;
  const times = option.timetable.map((t) => parseHHMM(t.arrivalTime)).sort((a, b) => a - b);
  const gaps = times.slice(1).map((t, i) => t - times[i]);
  const period = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const width = Math.max(1, Math.round(period * ARRIVAL_ASSUMPTIONS.pulseWidthFraction));
  return { period: Math.round(period), width, offset: 0 };
}

export interface DeriveArrivalInput {
  option: EventTransportOption;
  event: Event;
}

export interface DerivedArrival {
  mean: number;
  std: number;
  /** always true by construction now (mean is clamped into [gatesOpen, showStart]) — kept as an
   * explicit, testable statement of that guarantee rather than an implicit assumption. */
  withinShowWindow: boolean;
}

export function deriveArrival({ option, event }: DeriveArrivalInput): DerivedArrival {
  const A = ARRIVAL_ASSUMPTIONS;
  const anchor = A.showAnchoredArrival[option.mode];
  const gatesOpenMin = parseHHMM(event.gatesOpen);
  const showStartMin = parseHHMM(event.showStart);

  const rawArrivalMin = showStartMin - anchor.peakBeforeShowMin;
  const arrivalAtGateMin = Math.min(showStartMin, Math.max(gatesOpenMin, rawArrivalMin));
  const mean = arrivalAtGateMin - gatesOpenMin;
  const std = Math.max(anchor.spreadMin, A.minStdMin);

  return { mean, std, withinShowWindow: true };
}
