import { z } from 'zod';
import type { Cohort, Intervention } from '../engine/types';

// ---------------------------------------------------------------------------------------------
// Trust — every number the ORGANISER hasn't verified on the ground is labeled with how far it can
// be trusted. The discount that turns a trust level into a number lives in ONE place,
// config/trust.ts — never here, never in the adapter.
// ---------------------------------------------------------------------------------------------

export const TrustSchema = z.enum(['claimed', 'documented', 'observed']);
export type Trust = z.infer<typeof TrustSchema>;

function trusted<T extends z.ZodTypeAny>(value: T) {
  return z.object({ value, trust: TrustSchema });
}
export type Trusted<T> = { value: T; trust: Trust };

const TimeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:MM, 24-hour');

// ---------------------------------------------------------------------------------------------
// Venue
// ---------------------------------------------------------------------------------------------

export const VenueTransportPointTypeSchema = z.enum(['train_station', 'metro_station', 'bus_stop', 'parking', 'drop_off']);
export type VenueTransportPointType = z.infer<typeof VenueTransportPointTypeSchema>;

export const VenueTransportPointSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: VenueTransportPointTypeSchema,
  lat: z.number(),
  lng: z.number(),
});
export type VenueTransportPoint = z.infer<typeof VenueTransportPointSchema>;

/** An entrance is where the venue graph meets the outside world — it links transport points to
 * the gates a registrant coming from them would use. Cohort path/alt are derived by walking this
 * graph (venue.entrances -> venue.gates), never typed in directly. */
export const VenueEntranceSchema = z.object({
  id: z.string(),
  name: z.string(),
  transportPointIds: z.array(z.string()).min(1),
  gateIds: z.array(z.string()).min(1),
});
export type VenueEntrance = z.infer<typeof VenueEntranceSchema>;

export const VenueGateSchema = z.object({
  id: z.string(),
  name: z.string(),
  lanes: trusted(z.number().int().positive()),
  /** people per lane per minute */
  laneRate: trusted(z.number().positive()),
  forecourtAreaM2: trusted(z.number().positive()),
});
export type VenueGate = z.infer<typeof VenueGateSchema>;

export const VenueParkingSchema = z.object({
  id: z.string(),
  name: z.string(),
  capacity: trusted(z.number().int().nonnegative()),
  areaM2: trusted(z.number().positive()),
});
export type VenueParking = z.infer<typeof VenueParkingSchema>;

export const VenueSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string(),
  lat: z.number(),
  lng: z.number(),
  totalAreaM2: trusted(z.number().positive()),
  capacity: trusted(z.number().int().positive()),
  gates: z.array(VenueGateSchema).min(1),
  parking: z.array(VenueParkingSchema),
  transportPoints: z.array(VenueTransportPointSchema),
  entrances: z.array(VenueEntranceSchema).min(1),
});
export type Venue = z.infer<typeof VenueSchema>;

export const VenueDocumentTypeSchema = z.enum(['fire_noc', 'occupancy_cert']);
export type VenueDocumentType = z.infer<typeof VenueDocumentTypeSchema>;

export const VenueDocumentSchema = z.object({
  id: z.string(),
  venueId: z.string(),
  type: VenueDocumentTypeSchema,
  fileUrl: z.string().url().nullable(),
  /** whatever the LLM extracted from the document — always zod-validated, never a raw number the LLM invented */
  extractedFields: z.record(z.string(), z.union([z.string(), z.number()])),
  expiry: z.iso.date(),
  /** e.g. "capacity_differs_from_claimed" — flags for the head to resolve, never auto-resolved */
  mismatchFlags: z.array(z.string()),
});
export type VenueDocument = z.infer<typeof VenueDocumentSchema>;

// ---------------------------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------------------------

export const TransportModeSchema = z.enum(['train', 'metro', 'bus', 'car', 'walk']);
export type TransportMode = z.infer<typeof TransportModeSchema>;

export const TimetableEntrySchema = z.object({
  /** when this batch reaches the linked transport point */
  arrivalTime: TimeOfDaySchema,
  /** how many people arrive in this batch */
  pulseSize: trusted(z.number().int().nonnegative()),
});
export type TimetableEntry = z.infer<typeof TimetableEntrySchema>;

export const EventTransportOptionSchema = z.object({
  id: z.string(),
  mode: TransportModeSchema,
  /** must reference a Venue.transportPoints[].id */
  transportPointId: z.string(),
  timetable: z.array(TimetableEntrySchema).min(1),
});
export type EventTransportOption = z.infer<typeof EventTransportOptionSchema>;

export const EventHotelSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    rooms: trusted(z.number().int().nonnegative()),
    occupied: trusted(z.number().int().nonnegative()),
    distanceToVenueM: trusted(z.number().nonnegative()),
    coachOption: z.boolean(),
    coachCapacity: trusted(z.number().int().nonnegative()).nullable(),
  })
  .refine((h) => h.occupied.value <= h.rooms.value, {
    message: 'occupied cannot exceed rooms',
    path: ['occupied'],
  });
export type EventHotel = z.infer<typeof EventHotelSchema>;

export const EventSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    venueId: z.string(),
    date: z.iso.date(),
    /** the [gatesOpen, showStart] window IS the ticket entry window — no separate field */
    gatesOpen: TimeOfDaySchema,
    showStart: TimeOfDaySchema,
    endTime: TimeOfDaySchema,
    hotels: z.array(EventHotelSchema),
    transportOptions: z.array(EventTransportOptionSchema),
  })
  .refine((e) => e.gatesOpen < e.showStart, {
    message: 'gatesOpen must be before showStart',
    path: ['gatesOpen'],
  });
export type Event = z.infer<typeof EventSchema>;

// ---------------------------------------------------------------------------------------------
// Registration — raw row (whatever the source file had) + normalized fields the adapter reads
// ---------------------------------------------------------------------------------------------

export const TravelModeSchema = z.enum(['train', 'metro', 'bus', 'car', 'walk', 'other']);
export type TravelMode = z.infer<typeof TravelModeSchema>;

export const RegistrationNormalizedSchema = z.object({
  originArea: z.string(),
  travelMode: TravelModeSchema,
  hotelId: z.string().nullable(),
  groupSize: z.number().int().positive(),
  gateHint: z.string().nullable(),
});
export type RegistrationNormalized = z.infer<typeof RegistrationNormalizedSchema>;

export const RegistrationSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  /** the untouched row exactly as the source file had it — messy column names, blanks, whatever */
  raw: z.record(z.string(), z.unknown()),
  normalized: RegistrationNormalizedSchema,
});
export type Registration = z.infer<typeof RegistrationSchema>;

// ---------------------------------------------------------------------------------------------
// CrowdGroup — maps 1:1 to the engine's Cohort. Same fields, same types, nothing added.
// ---------------------------------------------------------------------------------------------

export const LangSchema = z.enum(['mr', 'hi', 'en']);
export type Lang = z.infer<typeof LangSchema>;

export const PulseSchema = z.object({
  period: z.number(),
  width: z.number(),
  offset: z.number(),
});

export const CrowdGroupSchema = z.object({
  id: z.string(),
  label: z.string(),
  size: z.number().int().nonnegative(),
  mean: z.number(),
  std: z.number().positive(),
  ps: z.number().min(0).max(1),
  lang: LangSchema,
  pulse: PulseSchema.optional(),
  path: z.array(z.string()).min(1),
  alt: z.array(z.string()).optional(),
  altExtraMin: z.number().optional(),
  housed: z.array(z.string()).optional(),
});
export type CrowdGroup = z.infer<typeof CrowdGroupSchema>;

// Compile-time proof that CrowdGroup really is engine's Cohort, field for field — if either type
// drifts, `npx tsc --noEmit` fails here instead of silently at toEngineScenario()'s call site.
type AssertEqual<A, B> = A extends B ? (B extends A ? true : never) : never;
const _crowdGroupIsCohort: AssertEqual<CrowdGroup, Cohort> = true;
void _crowdGroupIsCohort;

// ---------------------------------------------------------------------------------------------
// Plan — levers reuse the engine's own Intervention union, verbatim
// ---------------------------------------------------------------------------------------------

const LanesInterventionSchema = z.object({ type: z.literal('lanes'), gate: z.string(), n: z.number(), from: z.number(), label: z.string().optional() });
const ShuttleInterventionSchema = z.object({ type: z.literal('shuttle'), link: z.string(), add: z.number(), vehicles: z.number(), from: z.number(), label: z.string().optional() });
const StaggerInterventionSchema = z.object({ type: z.literal('stagger'), cohort: z.string(), delta: z.number(), decisionTick: z.number().optional(), label: z.string().optional() });
const HouseInterventionSchema = z.object({ type: z.literal('house'), decisionTick: z.number().optional(), label: z.string().optional() });
const NudgeInterventionSchema = z.object({
  type: z.literal('nudge'),
  cohort: z.string(),
  ask: z.enum(['reroute', 'shift']),
  rupees: z.number(),
  delta: z.number().optional(),
  decisionTick: z.number().optional(),
  label: z.string().optional(),
});
const FoodInterventionSchema = z.object({ type: z.literal('food'), zone: z.string(), n: z.number(), from: z.number(), label: z.string().optional() });

export const InterventionSchema = z.discriminatedUnion('type', [
  LanesInterventionSchema,
  ShuttleInterventionSchema,
  StaggerInterventionSchema,
  HouseInterventionSchema,
  NudgeInterventionSchema,
  FoodInterventionSchema,
]);
export type InterventionShape = z.infer<typeof InterventionSchema>;

const _interventionIsEngineIntervention: AssertEqual<InterventionShape, Intervention> = true;
void _interventionIsEngineIntervention;

export const PlanStatusSchema = z.enum(['draft', 'approved', 'published']);
export type PlanStatus = z.infer<typeof PlanStatusSchema>;

export const PlanSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  levers: z.array(InterventionSchema),
  status: PlanStatusSchema,
  approvedBy: z.string().nullable(),
  approvedAt: z.iso.datetime().nullable(),
});
export type Plan = z.infer<typeof PlanSchema>;

// ---------------------------------------------------------------------------------------------
// Order
// ---------------------------------------------------------------------------------------------

export const OrderServiceSchema = z.enum(['hotel', 'travel', 'gate', 'route', 'food']);
export type OrderService = z.infer<typeof OrderServiceSchema>;

export const OrderStatusSchema = z.enum(['pending', 'sent', 'confirmed', 'failed']);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const OrderSchema = z.object({
  id: z.string(),
  planId: z.string(),
  service: OrderServiceSchema,
  text: z.string(),
  status: OrderStatusSchema,
});
export type Order = z.infer<typeof OrderSchema>;

// ---------------------------------------------------------------------------------------------
// VisitorPlan — only what the head approved and published, nothing else
// ---------------------------------------------------------------------------------------------

export const VisitorPlanSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  registrationId: z.string(),
  stay: z.object({ hotelName: z.string(), coach: z.boolean() }).nullable(),
  travel: z.object({ mode: TravelModeSchema, departTime: TimeOfDaySchema }),
  gate: z.string(),
  leaveTime: TimeOfDaySchema,
  food: z.object({ zoneName: z.string(), window: z.string() }).nullable(),
  language: LangSchema,
  version: z.number().int().positive(),
});
export type VisitorPlan = z.infer<typeof VisitorPlanSchema>;

// ---------------------------------------------------------------------------------------------
// LiveReport
// ---------------------------------------------------------------------------------------------

export const LiveReportSourceSchema = z.enum(['gate_scan', 'staff', 'visitor_location']);
export type LiveReportSource = z.infer<typeof LiveReportSourceSchema>;

export const LiveReportSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  source: LiveReportSourceSchema,
  payload: z.record(z.string(), z.unknown()),
  time: z.iso.datetime(),
});
export type LiveReport = z.infer<typeof LiveReportSchema>;

// ---------------------------------------------------------------------------------------------
// LedgerEntry — same hash-chain design as the old project (append-only, tamper-evident:
// hash = SHA-256(prevHash + canonicalJSON(rest))). Scoped per event here instead of per browser
// session, since this is an org-wide platform rather than a single-laptop demo.
// ---------------------------------------------------------------------------------------------

export const LedgerTypeSchema = z.enum([
  'forecast_issued',
  'warning_raised',
  'plan_recommended',
  'plan_rejected',
  'plan_approved',
  'orders_sent',
  'room_result',
  'outcome',
  'redteam',
  'clock_expired',
  'staff_report',
  'tripwire_fired',
  'action_stopped_working',
  'decision_recorded',
  'action_expiring',
  'status_changed',
]);
export type LedgerType = z.infer<typeof LedgerTypeSchema>;

export const LedgerEntrySchema = z.object({
  eventId: z.string(),
  seq: z.number().int().positive(),
  ts: z.iso.datetime(),
  simClock: z.string(),
  type: LedgerTypeSchema,
  summary: z.string(),
  payload: z.unknown(),
  prevHash: z.string().length(64),
  hash: z.string().length(64),
});
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

// ---------------------------------------------------------------------------------------------
// UploadResult — the shape of POST /api/registrations/upload's response (Step 1)
// ---------------------------------------------------------------------------------------------

export const SaveStatusSchema = z.discriminatedUnion('ok', [z.object({ ok: z.literal(true) }), z.object({ ok: z.literal(false), error: z.string() })]);
export type SaveStatus = z.infer<typeof SaveStatusSchema>;

export const DroppedReasonSchema = z.object({ reason: z.string(), count: z.number().int().nonnegative() });
export const UnroutedByModeSchema = z.object({ mode: TravelModeSchema, size: z.number().int().nonnegative(), reason: z.string() });

export const UploadResultSchema = z.object({
  totalRows: z.number().int().nonnegative(),
  keptRows: z.number().int().nonnegative(),
  keptPeople: z.number().int().nonnegative(),
  dropped: z.number().int().nonnegative(),
  droppedReasons: z.array(DroppedReasonSchema),
  groups: z.array(CrowdGroupSchema),
  unroutedTotal: z.number().int().nonnegative(),
  unroutedByMode: z.array(UnroutedByModeSchema),
  assumedMappings: z.array(z.string()),
  saveStatus: SaveStatusSchema,
});
export type UploadResult = z.infer<typeof UploadResultSchema>;
