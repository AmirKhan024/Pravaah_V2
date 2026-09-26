import { ENGINE_GRAPH_ASSUMPTIONS as G } from '../config/engineGraphAssumptions';
import { discountedCapacity, isEstimated } from '../config/trust';
import type { Link, Scenario, Zone } from '../engine/types';
import { findMatchingTransportOption, parseHHMM } from '../lib/server/scenario/arrivalRules';
import type { CrowdGroup, Event, Trusted, Venue } from './schemas';

/**
 * event + venue + groups -> engine Scenario.
 *
 * DOCUMENTED RULE for CrowdGroup.mean/std/pulse (see lib/server/scenario/arrivalRules.ts — the
 * single source of that math; buildGroups.ts already ran it before groups reached this
 * function, so this function never recomputes it, only translates units and IDs):
 *
 *  - mean is ticks relative to event.gatesOpen (arrivalRules.ts's convention). This function sets
 *    Scenario.t0Min = gatesOpen's minutes-after-midnight, so cohort.mean passes through unchanged
 *    and gatesOpenTick is always 0.
 *  - std and pulse pass through unchanged — they're already engine-shaped.
 *  - path/alt are re-expressed here: buildGroups.ts recorded them as
 *    [transportPointId, entranceId, gateId] (venue-graph node ids), which meant nothing outside
 *    this function. Here they become the real [approachLinkId, concourseLinkId] link-id sequence
 *    the engine actually walks (see engine/simulate.ts: cohort.path indexes into Scenario.links).
 *
 * Trust: every Trusted<number> pulled from Venue/Event goes through config/trust.ts's
 * discountedCapacity() before becoming a plain engine number — this is the only place that
 * happens, and every zone/link built from one is marked `estimated: true`.
 *
 * Known gaps, not invented around (see the gaps this leaves, reported by the caller):
 *  - Venue carries no gate/parking coordinates, so every gate/parking/hotel zone reuses the
 *    venue's own lat/lng — there is no real distance model between them yet.
 *  - EventHotel has no explicit link into the entrance/gate graph (no field for it in the
 *    contract), so a coach-served hotel is routed like a car arrival — same entrance the 'car'
 *    transport option uses — a documented inference, not invented data. distanceToVenueM +
 *    config.coachSpeedMPerMin gives the link its travel time; coachCapacity (if given) or
 *    config.fallbackCoachCapPerMin gives it a cap. A hotel with coachOption=false gets a zone but
 *    no link — still nothing routes through it (no cohort's path currently passes through a hotel
 *    zone either way; buildGroups.ts derives path from travel mode, not hotelId).
 *  - Approach/concourse link capacity, travel time and area are config assumptions
 *    (config/engineGraphAssumptions.ts), mirroring engine/venueImport/buildGraph.ts's own
 *    defaults for the same missing-data problem, since Venue carries none of that either.
 */
export function toEngineScenario(event: Event, venue: Venue, groups: CrowdGroup[]): Scenario {
  const num = (t: Trusted<number>) => discountedCapacity(t.value, t.trust);
  const est = (...trusts: Array<Trusted<unknown>['trust']>) => trusts.some(isEstimated);

  const zones: Zone[] = [];
  const links: Link[] = [];

  zones.push({
    id: 'venue',
    name: venue.name,
    type: 'venue',
    lat: venue.lat,
    lng: venue.lng,
    areaM2: Math.round(num(venue.totalAreaM2)),
    capacity: Math.round(num(venue.capacity)),
    estimated: est(venue.totalAreaM2.trust, venue.capacity.trust),
  });

  // gate zones + gate -> venue concourse/screening link (one per gate, shared by every entrance
  // that routes into it)
  const gateVenueLinkId = new Map<string, string>();
  for (const g of venue.gates) {
    zones.push({
      id: g.id,
      name: g.name,
      type: 'gate',
      lat: venue.lat,
      lng: venue.lng,
      areaM2: Math.round(num(g.forecourtAreaM2)),
      lanes: Math.round(num(g.lanes)),
      estimated: est(g.forecourtAreaM2.trust, g.lanes.trust),
    });
    const linkId = `link_${g.id}_venue`;
    gateVenueLinkId.set(g.id, linkId);
    links.push({
      id: linkId,
      from: g.id,
      to: 'venue',
      name: `${g.name} concourse`,
      mode: 'gate',
      gate: g.id,
      ff: G.concourseFFMin,
      areaM2: G.concourseAreaM2,
      estimated: true,
    });
  }

  // parking zones (display/graph nodes only unless an entrance links one in as a transport point)
  for (const p of venue.parking) {
    zones.push({
      id: p.id,
      name: p.name,
      type: 'parking',
      lat: venue.lat,
      lng: venue.lng,
      areaM2: Math.round(num(p.areaM2)),
      estimated: est(p.areaM2.trust, p.capacity.trust),
    });
  }

  // transport-point zones + their approach link(s) to whichever gate(s) their entrance reaches
  const approachLinkId = new Map<string, string>(); // key: `${transportPointId}__${gateId}`
  for (const tp of venue.transportPoints) {
    zones.push({
      id: tp.id,
      name: tp.name,
      type: 'transit',
      lat: tp.lat,
      lng: tp.lng,
      areaM2: G.transitZoneAreaM2,
      estimated: true,
    });
  }
  for (const entrance of venue.entrances) {
    for (const tpId of entrance.transportPointIds) {
      for (const gateId of entrance.gateIds) {
        const key = `${tpId}__${gateId}`;
        if (approachLinkId.has(key)) continue;
        const linkId = `link_${key}`;
        approachLinkId.set(key, linkId);
        const tp = venue.transportPoints.find((p) => p.id === tpId);
        links.push({
          id: linkId,
          from: tpId,
          to: gateId,
          name: `${tp?.name ?? tpId} to ${venue.gates.find((g) => g.id === gateId)?.name ?? gateId}`,
          mode: 'walk',
          cap: G.approachCapPerMin,
          ff: G.approachFFMin,
          areaM2: G.approachAreaM2,
          estimated: true,
        });
      }
    }
  }

  // hotel zones, connected to a gate for coach-served hotels: the contract has no explicit
  // hotel->entrance field, so a coach is routed like a car (same entrance 'car' arrivals use) —
  // documented inference, not invented data. distanceToVenueM + a road speed assumption gives the
  // link its travel time; coachCapacity (if the sample gave one) becomes the link's cap.
  const carOption = findMatchingTransportOption('car', event);
  const carEntrance = carOption ? venue.entrances.find((e) => e.transportPointIds.includes(carOption.transportPointId)) : undefined;
  const coachGateId = carEntrance?.gateIds[0] ?? venue.gates[0]?.id;

  for (const h of event.hotels) {
    zones.push({
      id: h.id,
      name: h.name,
      type: 'hotel',
      lat: venue.lat,
      lng: venue.lng,
      rooms: Math.round(num(h.rooms)),
      occupied: Math.round(num(h.occupied)),
      estimated: est(h.rooms.trust, h.occupied.trust),
    });
    if (h.coachOption && coachGateId) {
      const distanceM = num(h.distanceToVenueM);
      links.push({
        id: `link_hotel_${h.id}_${coachGateId}`,
        from: h.id,
        to: coachGateId,
        name: `${h.name} coach to ${venue.gates.find((g) => g.id === coachGateId)?.name ?? coachGateId}`,
        mode: 'road',
        cap: h.coachCapacity ? Math.round(num(h.coachCapacity)) : G.fallbackCoachCapPerMin,
        ff: Math.max(1, Math.round(distanceM / G.coachSpeedMPerMin)),
        estimated: true,
      });
    }
  }

  // a single global laneRate (Scenario.laneRate) approximates every gate's own discounted
  // laneRate — the engine has one scenario-wide rate, not a per-gate one
  const laneRate = venue.gates.length ? Math.round(venue.gates.reduce((s, g) => s + num(g.laneRate), 0) / venue.gates.length) : 0;

  const gatesOpenMin = parseHHMM(event.gatesOpen);
  const showStartMin = parseHHMM(event.showStart);
  const showStartTick = showStartMin - gatesOpenMin;

  const cohorts = groups.map((g) => {
    const { path: rawPath, alt: rawAlt, ...rest } = g;
    const [tpId, , gateId] = rawPath;
    const path = [approachLinkId.get(`${tpId}__${gateId}`), gateVenueLinkId.get(gateId)].filter((x): x is string => !!x);

    let alt: string[] | undefined;
    if (rawAlt) {
      const [altTpId, , altGateId] = rawAlt;
      const altPath = [approachLinkId.get(`${altTpId}__${altGateId}`), gateVenueLinkId.get(altGateId)].filter((x): x is string => !!x);
      if (altPath.length === 2) alt = altPath;
    }
    return { ...rest, path, ...(alt ? { alt } : {}) };
  });

  return {
    id: event.id,
    name: event.name,
    sub: `${venue.name} · gates ${event.gatesOpen} · show ${event.showStart}`,
    venueLabel: venue.name,
    t0Min: gatesOpenMin,
    horizon: showStartTick + 90,
    gatesOpenTick: 0,
    showStartTick,
    laneRate,
    lateBookings: 0,
    zones,
    links,
    cohorts,
  };
}
