import type { ConsoleState, FlowBoard, OrderView, ZoneFrame } from '../types';

/** A small, all-calm meetup — no actions anywhere, so the console shows "All calm" and a disabled
 * publish button. Deliberately the smallest of the three sample shapes: one gate, no hotel, no food. */
export const CALM_EVENT_ID = 'event_calm_meetup_sample';

const CALM_NODES: FlowBoard['nodes'] = [
  { id: 'walkin_entry', label: 'Walk-in Entry', kind: 'origin', service: 'gates' },
  { id: 'gate_main', label: 'Main Gate', kind: 'gate', service: 'gates' },
  { id: 'venue_lawn', label: 'Lawn Grounds', kind: 'venue', service: 'venue' },
];

const CALM_LINKS: FlowBoard['links'] = [
  { id: 'link_entry_gate', from: 'walkin_entry', to: 'gate_main' },
  { id: 'link_gate_venue', from: 'gate_main', to: 'venue_lawn' },
];

function calmFlowBoard(): FlowBoard {
  const frame = (minute: number): FlowBoard['frames'][number] => ({
    minute,
    nodes: { walkin_entry: { load: 0.2, status: 'calm' }, gate_main: { load: 0.25, status: 'calm' }, venue_lawn: { load: 0.2, status: 'calm' } },
    links: { link_entry_gate: { load: 0.2, status: 'calm' }, link_gate_venue: { load: 0.25, status: 'calm' } },
  });
  return { nodes: CALM_NODES, links: CALM_LINKS, frames: [frame(0), frame(30), frame(60)] };
}

export function calmConsoleState(): ConsoleState {
  return {
    eventId: CALM_EVENT_ID,
    eventName: 'Neighbourhood Meetup',
    statusWord: 'calm',
    sample: true,
    canPublish: false,
    published: false,
    publishedVersion: null,
    nextDeadline: null,
    flowBoard: calmFlowBoard(),
    services: [
      { id: 'gates', label: 'Gates', statusColor: 'calm', headline: { value: 4, unit: 'min wait', sample: true }, problem: 'Moving well', actions: [], sample: true },
      { id: 'routes', label: 'Routes', statusColor: 'calm', headline: null, problem: 'Nothing to report', actions: [], sample: true },
    ],
  };
}

export function calmFrames(): ZoneFrame[] {
  return [0, 30, 60].map((minuteOffset) => ({
    minuteOffset,
    timeLabel: minuteOffset === 0 ? '16:00' : minuteOffset === 30 ? '16:30' : '17:00',
    sample: true,
    serviceStatus: { gates: 'calm', routes: 'calm' },
    zones: [
      { id: 'gate_main', label: 'Main Gate', statusColor: 'calm' },
      { id: 'venue_lawn', label: 'Lawn Grounds', statusColor: 'calm' },
    ],
  }));
}

export function calmOrders(): OrderView[] {
  return [];
}
