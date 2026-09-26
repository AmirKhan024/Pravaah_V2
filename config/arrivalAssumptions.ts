/**
 * Every number here is an assumption, not a measurement — used only where Event/Venue don't
 * supply one. See lib/server/scenario/arrivalRules.ts for how each is applied, and
 * config/trust.ts for how a Trusted<number> is discounted before it reaches these formulas.
 */
export const ARRIVAL_ASSUMPTIONS = {
  /** assumption: average walk speed from a transport point onto the venue grounds, m/min */
  walkSpeedMPerMin: 70,
  /** assumption: beyond this distance people don't walk it — same walk/road split as
   * engine/venueImport/buildGraph.ts's own VENUE_DEFAULTS, mirrored here (not imported) since
   * that file's constants aren't exported and engine/ isn't ours to add exports to */
  walkLimitM: 1800,
  /** assumption: road/shuttle speed once past walkLimitM, m/min */
  roadSpeedMPerMin: 350,
  /** assumption: street distance is this much longer than straight-line distance */
  detourFactor: 1.25,
  /** assumption: floor under any derived std, in minutes — never tighter than this */
  minStdMin: 5,
  /** assumption: std used when a transport option has only one timetable entry (no spread to measure) */
  singlePulseStdMin: 15,
  /** assumption: nudge-acceptance probability until real Room/redTeam data exists per group */
  defaultNudgeAcceptance: 0.4,
  /** assumption: visitor language until per-registration language data exists */
  defaultLang: 'en' as const,
} as const;
