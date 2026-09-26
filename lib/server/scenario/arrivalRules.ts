/**
 * Implements the documented rule from contract/engine-adapter.ts's toEngineScenario() doc comment:
 * a CrowdGroup's mean/std comes from the matched EventTransportOption's timetable plus the travel
 * time the venue graph implies, never from an invented number; path/alt comes from walking
 * Venue.entrances -> Venue.gates, never typed in. Both lib/server/registrations/buildGroups.ts
 * (Step 1) and the eventual toEngineScenario() implementation (Step 2) call these same functions,
 * so the rule is defined exactly once.
 *
 * Simplification made explicit here (not hidden): rather than assigning each registration to a
 * single timetable pulse, mean/std are the pulseSize-weighted mean/std of ALL of the matched
 * option's timetable entries. This is deterministic and well-defined whether an option has one
 * entry or many, and avoids inventing a rule for "which single pulse a registration belongs to"
 * that the data doesn't actually support.
 *
 * Tick convention: mean is in minutes relative to event.gatesOpen (tick 0 = gatesOpen). Step 2's
 * toEngineScenario may pick an earlier Scenario.t0Min and shift every mean by a constant offset —
 * that shift is Step 2's responsibility, not this file's.
 */
import { ARRIVAL_ASSUMPTIONS } from '../../../config/arrivalAssumptions';
import { discountedCapacity } from '../../../config/trust';
import type { Event, EventTransportOption, TravelMode, Venue } from '../../../contract/schemas';

export function parseHHMM(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6371000;
export function haversineMeters(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Walk under walkLimitM, road (with a detour factor) beyond it — mirrors the engine's own
 * venue-import defaults for the same walk-vs-road question. */
function travelTimeMinutes(distanceM: number, A: typeof ARRIVAL_ASSUMPTIONS): number {
  if (distanceM <= A.walkLimitM) return distanceM / A.walkSpeedMPerMin;
  return (distanceM * A.detourFactor) / A.roadSpeedMPerMin;
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

export interface DeriveArrivalInput {
  option: EventTransportOption;
  venue: Venue;
  event: Event;
}

export interface DerivedArrival {
  mean: number;
  std: number;
}

export function deriveArrival({ option, venue, event }: DeriveArrivalInput): DerivedArrival {
  const A = ARRIVAL_ASSUMPTIONS;
  const entries = option.timetable.map((t) => ({
    min: parseHHMM(t.arrivalTime),
    weight: discountedCapacity(t.pulseSize.value, t.pulseSize.trust),
  }));
  const totalWeight = entries.reduce((s, e) => s + e.weight, 0);
  const weightedMean = totalWeight > 0 ? entries.reduce((s, e) => s + e.min * e.weight, 0) / totalWeight : entries[0].min;

  let std: number;
  if (entries.length === 1) {
    std = A.singlePulseStdMin;
  } else if (totalWeight > 0) {
    const variance = entries.reduce((s, e) => s + e.weight * (e.min - weightedMean) ** 2, 0) / totalWeight;
    std = Math.sqrt(variance);
  } else {
    std = A.singlePulseStdMin;
  }
  std = Math.max(std, A.minStdMin);

  const transportPoint = venue.transportPoints.find((p) => p.id === option.transportPointId);
  const travelTimeMin = transportPoint ? travelTimeMinutes(haversineMeters(transportPoint, venue), A) : 0;

  const gatesOpenMin = parseHHMM(event.gatesOpen);
  const mean = weightedMean + travelTimeMin - gatesOpenMin;

  return { mean, std };
}
