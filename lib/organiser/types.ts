import type { Lang, OrderStatus } from '../../contract/schemas';

/** Calm/Watch/Act-now — the only three states any part of the console can be in. */
export type StatusLevel = 'calm' | 'watch' | 'act_now';

/** A number shown on screen. Every one is tagged so the UI can mark it "sample"/"assumption". */
export type DisplayNumber = {
  value: number;
  /** short unit shown after the value, e.g. "min", "%", "m" */
  unit?: string;
  /** true when this number is not real, measured data (sample fixture or an unverified assumption) */
  sample: boolean;
};

/** One suggested fix, shown as a single card in the service detail screen. */
export type SuggestedAction = {
  id: string;
  serviceId: string;
  /** card title, max 4 words */
  title: string;
  /** cost shown on the card, already formatted (e.g. "Free", "Rs 12,000") */
  costLabel: string;
  minutesLeft: DisplayNumber;
  /** one short sentence behind the "Why?" tap */
  why: string;
  state: 'pending' | 'approved' | 'skipped';
  sample: boolean;
};

/** One tile on the overview screen and one detail screen — name and shape come entirely from data. */
export type ServiceStatus = {
  id: string;
  /** tile label, e.g. "Hotels" or "Crowd flow" — never hardcoded in a component */
  label: string;
  statusColor: StatusLevel;
  /** the single number a tile is allowed to show, or none */
  headline: DisplayNumber | null;
  /** the problem statement for the detail screen, max 6 words */
  problem: string;
  actions: SuggestedAction[];
  sample: boolean;
};

/** One node kind a flow board can lay out — column order runs origin/transport -> gate -> venue,
 * with hotel/food drawn as side nodes off that main pipeline. */
export type FlowNodeKind = 'origin' | 'transport' | 'gate' | 'hotel' | 'food' | 'venue';

export type FlowNode = {
  id: string;
  /** node label — comes entirely from data, never hardcoded in a component */
  label: string;
  kind: FlowNodeKind;
  /** the ServiceStatus.id this node belongs to, for node-tap filtering */
  service: string;
};

export type FlowLink = {
  id: string;
  from: string;
  to: string;
};

/** load: 0 to 1 or more (1 = full). One frame per minute of the evening. */
export type FlowFrame = {
  minute: number;
  nodes: Record<string, { load: number; status: StatusLevel }>;
  links: Record<string, { load: number; status: StatusLevel }>;
};

/** The control room's schematic — another developer fills this from the engine. Falls back to a
 * simple board built from ZoneFrame/ServiceStatus (see lib/organiser/flowBoardFallback.ts) when absent. */
export type FlowBoard = {
  nodes: FlowNode[];
  links: FlowLink[];
  frames: FlowFrame[];
};

/** Top-level state the console is built from. */
export type ConsoleState = {
  eventId: string;
  eventName: string;
  statusWord: StatusLevel;
  services: ServiceStatus[];
  /** minutes left to act on the most urgent open decision, or null if nothing is time-boxed */
  nextDeadline: DisplayNumber | null;
  /** Publish plan is enabled only once true */
  canPublish: boolean;
  /** true once "Publish plan" has been pressed for this event */
  published: boolean;
  /** set once published — the "Live v<version>" tag and the /v?event= link. Optional: the real
   * console route (lib/server/console/buildConsoleState.ts) doesn't set this yet. */
  publishedVersion?: number | null;
  flowBoard?: FlowBoard;
  sample: boolean;
};

/** One colored cell in the zone board (screen 3's grid stand-in for a real map). */
export type ZoneCell = {
  id: string;
  label: string;
  statusColor: StatusLevel;
};

/** One point on the time slider: the forecast status for every service and zone at that minute. */
export type ZoneFrame = {
  /** minutes since gates-open, the slider's native unit */
  minuteOffset: number;
  /** HH:MM label shown next to the slider handle */
  timeLabel: string;
  serviceStatus: Record<string, StatusLevel>;
  zones: ZoneCell[];
  sample: boolean;
};

/** One tap-to-select ground report chip. Ids are matched against messages/organiser/en.json. */
export type GroundReportChipId = 'rain' | 'rail_delay' | 'gates_late' | 'more_people' | 'fewer_people' | 'slow_lanes';

export type GroundReportSubmission = {
  chipIds: GroundReportChipId[];
  note: string;
};

/** One row in the Orders screen. */
export type OrderView = {
  id: string;
  serviceLabel: string;
  text: string;
  status: OrderStatus;
  sample: boolean;
};

export type ConsoleLang = Lang;

/** Result of a mutating api.ts call — same shape contract/schemas.ts uses for SaveStatus. */
export type SubmitResult = { ok: true } | { ok: false; error: string };
