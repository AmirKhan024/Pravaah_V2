/**
 * toEngineScenario() (contract/engine-adapter.ts) needs a few numbers the contract doesn't carry
 * at all yet — Venue has no gate/transport-point-to-gate distance or capacity data, so these fill
 * that gap. Every one is an assumption, mirroring engine/venueImport/buildGraph.ts's own
 * VENUE_DEFAULTS for the same missing-data problem (that file's constants aren't exported, so
 * these are re-stated here, not imported). Every zone/link built from one of these is marked
 * `estimated: true`.
 */
export const ENGINE_GRAPH_ASSUMPTIONS = {
  /** assumption: free-flow walk time from a transport point to its gate, minutes */
  approachFFMin: 4,
  /** assumption: people/min capacity of the transport-point-to-gate approach link */
  approachCapPerMin: 450,
  /** assumption: m² of the approach link, for density */
  approachAreaM2: 2000,
  /** assumption: free-flow time from gate to the venue bowl, minutes */
  concourseFFMin: 3,
  /** assumption: m² of the gate-to-venue concourse link */
  concourseAreaM2: 3000,
  /** assumption: m² for a transit (station/bus stop/drop-off) zone, Venue carries none */
  transitZoneAreaM2: 2500,
  /** assumption: m² for a parking zone when Venue.parking doesn't specify one (it always does
   * here, but Venue.gates/transportPoints carry no coordinates, so gate/parking/hotel zones all
   * reuse the venue's own lat/lng — there is no real distance model between them yet) */
  fallbackAreaM2: 2000,
} as const;
