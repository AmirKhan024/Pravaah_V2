import { CONSOLE_DEFAULT_MINUTES_LEFT, CONSOLE_STATUS_THRESHOLDS as T } from '../../../config/server-extras';
import type { Event } from '../../../contract/schemas';
import type { AblationRow } from '../../../engine/ablation';
import type { BoardOption } from '../../../engine/decisionWindow';
import type { EnsembleResult } from '../../../engine/ensemble';
import type { Lever } from '../../../engine/interventions';
import type { OptimiseResult } from '../../../engine/optimise';
import type { Scenario, SimResult } from '../../../engine/types';
import type { ConsoleState, DisplayNumber, ServiceStatus, StatusLevel, SuggestedAction } from '../../organiser/types';
import { buildWhyText } from './whyText';

export interface ActionState {
  /** action.id -> its current state; anything not listed here is 'pending' */
  [actionId: string]: 'pending' | 'approved' | 'skipped';
}

export interface BuildConsoleStateInput {
  event: Event;
  scenario: Scenario;
  base: SimResult;
  ensemble: EnsembleResult;
  ablation: AblationRow[];
  plan: OptimiseResult;
  decisionBoard: BoardOption[];
  actionStates: ActionState;
  published: boolean;
}

function levelForMinutes(minutes: number, watch: number, actNow: number): StatusLevel {
  if (minutes >= actNow) return 'act_now';
  if (minutes >= watch) return 'watch';
  return 'calm';
}

function severity(level: StatusLevel): number {
  return level === 'act_now' ? 2 : level === 'watch' ? 1 : 0;
}

/** Which zone/link id (if any) a lever targets — used to attach it to the right service. */
function leverTargetId(iv: Lever): string | null {
  switch (iv.type) {
    case 'lanes':
      return iv.gate;
    case 'shuttle':
      return iv.link;
    case 'food':
      return iv.zone;
    default:
      return null; // nudge/stagger (cohort-targeted) and house (untargeted) go in "Routes"/"Hotels"
  }
}

function actionId(eventId: string, iv: Lever, index: number): string {
  return `act_${eventId}_${index}_${iv.type}`;
}

async function buildAction(input: BuildConsoleStateInput, serviceId: string, iv: Lever, index: number, ablationRow: AblationRow | undefined): Promise<SuggestedAction> {
  const id = actionId(input.event.id, iv, index);
  const board = input.decisionBoard.find((b) => b.iv === iv);
  const minutesLeft: DisplayNumber = board && !board.useless ? { value: Math.max(0, board.deadlineTick), unit: 'min', sample: false } : { value: CONSOLE_DEFAULT_MINUTES_LEFT, unit: 'min', sample: true };

  const costLabel = 'rupees' in iv && iv.rupees ? `Rs ${iv.rupees.toLocaleString('en-IN')}` : 'Free';

  const template = ablationRow
    ? `{NAME} removes about {REMOVED} dangerous minutes, {LEFT} left after.`
    : `This move is expected to ease the crowd here.`;
  const why = await buildWhyText(template, {
    NAME: ablationRow?.name ?? '',
    REMOVED: String(ablationRow?.removed ?? 0),
    LEFT: String(ablationRow?.left ?? 0),
  });

  return {
    id,
    serviceId,
    title: iv.label.split(' ').slice(0, 4).join(' '),
    costLabel,
    minutesLeft,
    why,
    state: input.actionStates[id] ?? 'pending',
    sample: false,
  };
}

/**
 * Pure mapping from one simulate()+ensemble+ablation+optimiser+decisionWindow run into
 * ConsoleState — no LLM number, no invented data. Services come only from what actually exists in
 * the scenario (gates, transit links with a cap, hotel zones with a coach link, food zones); a
 * service with nothing to show is left out entirely. Status colors come from
 * config/server-extras.ts's CONSOLE_STATUS_THRESHOLDS (assumption). Suggested actions are the
 * optimiser's own chosen levers, attached to whichever service they target; "Why?" text is
 * built from the matching ablation row's real numbers (see lib/server/console/whyText.ts).
 */
export async function buildConsoleState(input: BuildConsoleStateInput): Promise<ConsoleState> {
  const { event, scenario, base, plan } = input;
  const ablationByGate = new Map<string, AblationRow>();
  for (const row of input.ablation) {
    const gate = scenario.zones.find((z) => z.type === 'gate' && row.name.includes(z.name));
    if (gate) ablationByGate.set(gate.id, row);
  }

  const services: ServiceStatus[] = [];
  let leverIndex = 0;
  const leversByTarget = new Map<string, Lever[]>();
  const untargeted: Lever[] = [];
  for (const iv of plan.chosen) {
    const target = leverTargetId(iv);
    if (target) {
      const list = leversByTarget.get(target) ?? [];
      list.push(iv);
      leversByTarget.set(target, list);
    } else {
      untargeted.push(iv);
    }
  }

  // gates
  for (const zone of scenario.zones.filter((z) => z.type === 'gate')) {
    const waitMin = base.gateWaitPeak[zone.id] ?? 0;
    const statusColor = levelForMinutes(waitMin, T.gateWatchMin, T.gateActNowMin);
    const levers = leversByTarget.get(zone.id) ?? [];
    const actions: SuggestedAction[] = [];
    for (const iv of levers) actions.push(await buildAction(input, zone.id, iv, leverIndex++, ablationByGate.get(zone.id)));
    services.push({
      id: zone.id,
      label: zone.name,
      statusColor,
      headline: { value: Math.round(waitMin * 10) / 10, unit: 'min wait', sample: false },
      problem: statusColor === 'calm' ? 'Moving well' : 'Queue building up',
      actions,
      sample: false,
    });
  }

  // transit links (shuttle-eligible: real capacity, not the gate-screening link itself)
  for (const link of scenario.links.filter((l) => l.mode !== 'gate' && l.cap)) {
    const levers = leversByTarget.get(link.id) ?? [];
    if (!levers.length) continue; // nothing to act on here — leave this service out entirely
    const actions: SuggestedAction[] = [];
    for (const iv of levers) actions.push(await buildAction(input, link.id, iv, leverIndex++, undefined));
    services.push({ id: link.id, label: link.name, statusColor: 'watch', headline: null, problem: 'Extra capacity available', actions, sample: false });
  }

  // hotels (only ones with a coach link — see contract/engine-adapter.ts)
  const hotelZones = scenario.zones.filter((z) => z.type === 'hotel' && scenario.links.some((l) => l.from === z.id));
  if (hotelZones.length && untargeted.some((iv) => iv.type === 'house')) {
    const houseLevers = untargeted.filter((iv) => iv.type === 'house');
    const actions: SuggestedAction[] = [];
    for (const iv of houseLevers) actions.push(await buildAction(input, 'hotels', iv, leverIndex++, undefined));
    services.push({ id: 'hotels', label: 'Hotels', statusColor: 'watch', headline: null, problem: 'Rooms need booking', actions, sample: false });
  }

  // food
  for (const zone of scenario.zones.filter((z) => z.type === 'food')) {
    const levers = leversByTarget.get(zone.id) ?? [];
    if (!levers.length) continue;
    const actions: SuggestedAction[] = [];
    for (const iv of levers) actions.push(await buildAction(input, zone.id, iv, leverIndex++, undefined));
    services.push({ id: zone.id, label: zone.name, statusColor: 'watch', headline: null, problem: 'Queue building up', actions, sample: false });
  }

  // routes (cohort-targeted nudge/stagger levers — no single zone/link owns these)
  const routeLevers = untargeted.filter((iv) => iv.type === 'nudge' || iv.type === 'stagger');
  if (routeLevers.length) {
    const actions: SuggestedAction[] = [];
    for (const iv of routeLevers) actions.push(await buildAction(input, 'routes', iv, leverIndex++, undefined));
    services.push({ id: 'routes', label: 'Routes', statusColor: 'watch', headline: null, problem: 'Arrivals could spread out more', actions, sample: false });
  }

  const worst = services.reduce<StatusLevel>((acc, s) => (severity(s.statusColor) > severity(acc) ? s.statusColor : acc), 'calm');
  const statusWord: StatusLevel = base.crushMin > 0 ? (severity(worst) > severity('watch') ? worst : 'watch') : worst;

  const allActions = services.flatMap((s) => s.actions);
  const anyApproved = allActions.some((a) => a.state === 'approved');
  const pendingMinutes = allActions.filter((a) => a.state === 'pending').map((a) => a.minutesLeft.value);
  const nextDeadline: DisplayNumber | null = pendingMinutes.length ? { value: Math.min(...pendingMinutes), unit: 'min', sample: allActions.find((a) => a.minutesLeft.value === Math.min(...pendingMinutes))?.minutesLeft.sample ?? true } : null;

  return {
    eventId: event.id,
    eventName: event.name,
    statusWord,
    services,
    nextDeadline,
    canPublish: anyApproved && !input.published,
    published: input.published,
    sample: false,
  };
}
