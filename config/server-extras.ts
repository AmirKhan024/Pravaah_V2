/**
 * Every number in this file is an assumption, not a measurement, used only where no real config
 * or documented value exists yet. Same spirit as config/arrivalAssumptions.ts and config/trust.ts,
 * scoped to the server-side pieces built on feat/bilal-server (documents, live reports, ledger,
 * publish, visitor plan, orders).
 */

/** assumption: a venue document upload larger than this is rejected outright (5MB, per spec) */
export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;

/** assumption: claimed vs. documented capacity within this fraction counts as "no mismatch" */
export const CAPACITY_MISMATCH_TOLERANCE = 0.05;

export const STAFF_REPORT_CHIPS = ['rain', 'rail_delay', 'gates_late', 'more_people', 'fewer_people', 'slow_lanes'] as const;
export type StaffReportChip = (typeof STAFF_REPORT_CHIPS)[number];

/**
 * Clamp bounds for the ScenarioPatch a staff ground report can produce (lib/server/live/replan.ts)
 * — mirrors the clamped-capMult idea in engine/whatif.ts's WhatIfPatch, so one phone report can
 * never swing the scenario further than these limits regardless of what the LLM/chip implies.
 */
export const STAFF_REPORT_CLAMP = {
  /** assumption: a single report can never claim capacity fell by more than half */
  capMultMin: 0.5,
  /** a report only ever reduces capacity, never claims more than baseline */
  capMultMax: 1.0,
  /** assumption: a single "gates late" report clamps to at most 60 minutes of delay */
  maxGateDelayMin: 60,
  /** assumption: "more/fewer people" clamps the implied crowd-size change to +/-50% */
  maxSizeMultiplier: 1.5,
} as const;

/** assumption: gate_scan counts more than this far off the last saved simulation trip the drift flag */
export const GATE_SCAN_DRIFT_THRESHOLD = 0.2;

/** assumption ("k"): a visitor_location zone count is only ever returned once at least this many
 * people are in it — below k, a single visitor's location would be identifiable */
export const VISITOR_LOCATION_MIN_ZONE_COUNT = 5;

/** assumption: /api/live/summary only aggregates reports from the last N minutes, so stale reports don't dominate the view */
export const LIVE_SUMMARY_WINDOW_MIN = 60;

/** assumption: abort a Telegram order send after this long so a slow/hanging network call never blocks the request */
export const ORDER_TELEGRAM_TIMEOUT_MS = 8000;

/**
 * Visitor-plan text templates, one row per field, 4 words or fewer each (placeholders count as one
 * word). These are the fallback used whenever the LLM's translation is rejected (see
 * lib/server/visitorPlan/wording.ts) — every digit/time is substituted in afterward, never seen by
 * the LLM. Marathi/Hindi rows are simple, common event phrasing — a native speaker should review
 * before this goes in front of real visitors (assumption).
 */
export const VISITOR_PLAN_TEMPLATES = {
  en: {
    gate: 'Use {GATE}',
    travel: '{MODE} at {TIME}',
    leaveTime: 'Leave by {TIME}',
    food: '{ZONE} by {TIME}',
    noHotel: 'No hotel booked',
    noFood: 'No food zone yet',
  },
  hi: {
    gate: '{GATE} का उपयोग करें',
    travel: '{TIME} बजे {MODE}',
    leaveTime: '{TIME} तक निकलें',
    food: '{TIME} तक {ZONE}',
    noHotel: 'कोई होटल नहीं',
    noFood: 'कोई फूड ज़ोन नहीं',
  },
  mr: {
    gate: '{GATE} वापरा',
    travel: '{TIME} वाजता {MODE}',
    leaveTime: '{TIME} पर्यंत निघा',
    food: '{TIME} पर्यंत {ZONE}',
    noHotel: 'हॉटेल नाही',
    noFood: 'फूड झोन नाही',
  },
} as const;

export type VisitorPlanTemplateField = keyof (typeof VISITOR_PLAN_TEMPLATES)['en'];
