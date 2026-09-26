/**
 * Every number here is an assumption, not a measurement — used only where Event/Venue don't
 * supply one. See lib/server/scenario/arrivalRules.ts for how each is applied, and
 * config/trust.ts for how a Trusted<number> is discounted before it reaches these formulas.
 */
export const ARRIVAL_ASSUMPTIONS = {
  /** assumption: floor under any derived std, in minutes — never tighter than this */
  minStdMin: 5,
  /** assumption: nudge-acceptance probability until real Room/redTeam data exists per group */
  defaultNudgeAcceptance: 0.4,
  /** assumption: visitor language until per-registration language data exists */
  defaultLang: 'en' as const,
  /** assumption: a routed group below this many people is folded into a "<Mode> -> <Gate>" group
   * instead of staying its own line — see lib/server/registrations/buildGroups.ts. Tuned for the
   * ~20k-row stadium sample: buckets are now keyed by mode+hotel+gateHint only (origin dropped —
   * see bucketKey's comment), leaving only a handful of distinct buckets per mode, most of them
   * already large; this needs to be high enough to catch the hotel/gateHint-crossed slices too. */
  minGroupSize: 1000,
  /** assumption: width (minutes) of the arrival-time bucket used to key merged groups, so a
   * merge never blends arrivals that are actually far apart in time */
  mergeWindowMin: 30,
  /** assumption: per mode, "this mode's arrivals peak N minutes before showStart, with this much
   * spread" — the anchor for CrowdGroup.mean/std (see arrivalRules.ts's deriveArrival). Clamped
   * into [gatesOpen, showStart] at use, so these numbers don't need to individually respect that
   * window for every event — the clamp does. */
  showAnchoredArrival: {
    train: { peakBeforeShowMin: 90, spreadMin: 20 },
    metro: { peakBeforeShowMin: 75, spreadMin: 18 },
    bus: { peakBeforeShowMin: 100, spreadMin: 15 },
    car: { peakBeforeShowMin: 70, spreadMin: 25 },
    walk: { peakBeforeShowMin: 60, spreadMin: 22 },
  },
  /** assumption: a rail pulse's width as a fraction of its period (see derivePulse) */
  pulseWidthFraction: 0.3,
} as const;
