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

/** assumption: generic lead time before a visitor's derived arrival tick, until real hotel/venue
 * travel-time modeling exists (see lib/server/visitorPlan/derive.ts) */
export const VISITOR_LEAVE_BUFFER_MIN = 30;

/**
 * Visitor-plan text templates, one row per field, 4 words or fewer each (placeholders count as one
 * word). Only VisitorPlan's two freeform string fields (`gate`, `food.window` — every other field
 * is a strict enum/HH:MM per contract/schemas.ts) ever carry translated wording. These are the
 * fallback whenever the LLM's translation is rejected (see lib/server/visitorPlan/wording.ts) —
 * every digit/time is substituted in afterward, never seen by the LLM. Marathi/Hindi rows are
 * simple, common event phrasing — a native speaker should review before this goes in front of real
 * visitors (assumption).
 */
export const VISITOR_PLAN_TEMPLATES = {
  en: { gate: 'Use {GATE}', foodWindow: 'From {TIME}' },
  hi: { gate: '{GATE} का उपयोग करें', foodWindow: '{TIME} से' },
  mr: { gate: '{GATE} वापरा', foodWindow: '{TIME} पासून' },
} as const;

export type VisitorPlanTemplateField = keyof (typeof VISITOR_PLAN_TEMPLATES)['en'];
