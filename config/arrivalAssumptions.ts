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
  /** assumption: a routed group below this many people is folded into an "Other <mode> to <gate>"
   * group instead of staying its own line — see lib/server/registrations/buildGroups.ts. Tuned
   * for the ~20k-row stadium sample: since arrival mean/std/path come only from the matched
   * transport option (never from origin), every origin sharing a mode is numerically identical,
   * so a low threshold barely reduces the group count — this needs to be large enough to catch
   * most per-origin/per-hotel splits to hit "~20 groups or fewer" at that scale. */
  minGroupSize: 700,
  /** assumption: width (minutes) of the arrival-time bucket used to key "Other" groups, so a
   * mode+gate merge never blends arrivals that are actually far apart in time */
  mergeWindowMin: 30,
  /** assumption: how far outside [gatesOpen, showStart] a group's mean may fall before it's
   * flagged for review as outside the show window — see deriveArrival's `withinShowWindow` */
  showWindowToleranceMin: 30,
} as const;
