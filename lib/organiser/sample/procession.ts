import type { ConsoleState, FlowBoard, OrderView, StatusLevel, ZoneFrame } from '../types';

const LOAD_FOR: Record<StatusLevel, number> = { calm: 0.35, watch: 0.7, act_now: 1.1 };

/** No hotel node here — a different shape from the stadium board, and a "transport" kind node
 * (the stadium board never uses one), matching the no-Hotels theme of this event. */
const PROCESSION_NODES: FlowBoard['nodes'] = [
  { id: 'entrance_lalbaug', label: 'Lalbaug Entry', kind: 'origin', service: 'crowd_flow' },
  { id: 'entrance_chowpatty', label: 'Chowpatty Entry', kind: 'origin', service: 'crowd_flow' },
  { id: 'shuttle_charni', label: 'Charni Road Buses', kind: 'transport', service: 'travel' },
  { id: 'checkpoint_1', label: 'Lalbaug Checkpoint', kind: 'gate', service: 'gates' },
  { id: 'checkpoint_2', label: 'Chowpatty Checkpoint', kind: 'gate', service: 'gates' },
  { id: 'food_girgaon', label: 'Girgaon Food', kind: 'food', service: 'food' },
  { id: 'venue_chowpatty', label: 'Chowpatty Grounds', kind: 'venue', service: 'venue' },
];

const PROCESSION_LINKS: FlowBoard['links'] = [
  { id: 'link_lalbaug_cp1', from: 'entrance_lalbaug', to: 'checkpoint_1' },
  { id: 'link_shuttle_cp2', from: 'shuttle_charni', to: 'checkpoint_2' },
  { id: 'link_chowpatty_cp2', from: 'entrance_chowpatty', to: 'checkpoint_2' },
  { id: 'link_cp1_venue', from: 'checkpoint_1', to: 'venue_chowpatty' },
  { id: 'link_cp2_venue', from: 'checkpoint_2', to: 'venue_chowpatty' },
  { id: 'link_food_venue', from: 'food_girgaon', to: 'venue_chowpatty' },
];

function processionFlowFrame(minute: number, byService: Record<string, StatusLevel>): FlowBoard['frames'][number] {
  const nodes: FlowBoard['frames'][number]['nodes'] = {};
  let worst: StatusLevel = 'calm';
  for (const node of PROCESSION_NODES) {
    if (node.kind === 'venue') continue;
    const s = byService[node.service ?? ''] ?? 'calm';
    nodes[node.id] = { load: LOAD_FOR[s], status: s };
    if (s === 'act_now' || (s === 'watch' && worst === 'calm')) worst = s;
  }
  nodes.venue_chowpatty = { load: LOAD_FOR[worst], status: worst };

  const links: FlowBoard['frames'][number]['links'] = {};
  for (const link of PROCESSION_LINKS) links[link.id] = nodes[link.from] ?? { load: 0.35, status: 'calm' };

  return { minute, nodes, links };
}

export function processionFlowBoard(): FlowBoard {
  const byMinute: Array<[number, Record<string, StatusLevel>]> = [
    [0, { crowd_flow: 'calm', travel: 'calm', gates: 'calm', routes: 'calm', food: 'calm' }],
    [30, { crowd_flow: 'watch', travel: 'calm', gates: 'watch', routes: 'calm', food: 'calm' }],
    [60, { crowd_flow: 'act_now', travel: 'watch', gates: 'watch', routes: 'watch', food: 'calm' }],
    [90, { crowd_flow: 'act_now', travel: 'watch', gates: 'act_now', routes: 'watch', food: 'watch' }],
    [120, { crowd_flow: 'watch', travel: 'calm', gates: 'watch', routes: 'calm', food: 'watch' }],
  ];
  return { nodes: PROCESSION_NODES, links: PROCESSION_LINKS, frames: byMinute.map(([minute, byService]) => processionFlowFrame(minute, byService)) };
}

/** Ganesh Visarjan Procession — no Hotels service, has Crowd-flow instead (see
 * contract/samples/event-procession.json). Same components render this unchanged. */
export const PROCESSION_EVENT_ID = 'event_procession_visarjan';

export function processionConsoleState(): ConsoleState {
  return {
    eventId: PROCESSION_EVENT_ID,
    eventName: 'Ganesh Visarjan Procession',
    statusWord: 'act_now',
    sample: true,
    canPublish: false,
    published: false,
    publishedVersion: null,
    nextDeadline: { value: 10, unit: 'min', sample: true },
    flowBoard: processionFlowBoard(),
    services: [
      {
        id: 'crowd_flow',
        label: 'Crowd flow',
        statusColor: 'act_now',
        headline: { value: 92, unit: '% density', sample: true },
        problem: 'Lalbaug entry density rising fast',
        sample: true,
        actions: [
          {
            id: 'act_crowd_1',
            serviceId: 'crowd_flow',
            title: 'Slow release at Lalbaug',
            costLabel: 'Free',
            minutesLeft: { value: 10, unit: 'min', sample: true },
            why: 'Prevents a crush building up at the Lalbaug entry.',
            state: 'pending',
            sample: true,
          },
        ],
      },
      {
        id: 'travel',
        label: 'Travel',
        statusColor: 'watch',
        headline: { value: 18, unit: 'min delay', sample: true },
        problem: 'Charni Road bus delay building',
        sample: true,
        actions: [
          {
            id: 'act_travel_1',
            serviceId: 'travel',
            title: 'Add 2 shuttle buses',
            costLabel: 'Rs 30,000',
            minutesLeft: { value: 20, unit: 'min', sample: true },
            why: 'Clears the backlog building up from Charni Road station.',
            state: 'pending',
            sample: true,
          },
        ],
      },
      {
        id: 'gates',
        label: 'Gates',
        statusColor: 'watch',
        headline: { value: 6, unit: 'lanes open', sample: true },
        problem: 'Chowpatty checkpoint lanes stretched',
        sample: true,
        actions: [
          {
            id: 'act_gates_1',
            serviceId: 'gates',
            title: 'Open 2 more lanes',
            costLabel: 'Rs 5,000',
            minutesLeft: { value: 35, unit: 'min', sample: true },
            why: 'Speeds up checkpoint throughput at Chowpatty.',
            state: 'pending',
            sample: true,
          },
        ],
      },
      {
        id: 'routes',
        label: 'Routes',
        statusColor: 'calm',
        headline: { value: 40, unit: '%', sample: true },
        problem: 'Girgaon route moving smoothly',
        sample: true,
        actions: [
          {
            id: 'act_routes_1',
            serviceId: 'routes',
            title: 'Hold current route plan',
            costLabel: 'Free',
            minutesLeft: { value: 60, unit: 'min', sample: true },
            why: 'No change needed on this route yet.',
            state: 'pending',
            sample: true,
          },
        ],
      },
      {
        id: 'food',
        label: 'Food',
        statusColor: 'calm',
        headline: { value: 5, unit: 'stalls open', sample: true },
        problem: 'Girgaon food stall queues short',
        sample: true,
        actions: [
          {
            id: 'act_food_1',
            serviceId: 'food',
            title: 'Add 1 food stall',
            costLabel: 'Rs 1,500',
            minutesLeft: { value: 55, unit: 'min', sample: true },
            why: 'Keeps food queues short near Girgaon through the evening.',
            state: 'pending',
            sample: true,
          },
        ],
      },
    ],
  };
}

export function processionFrames(): ZoneFrame[] {
  return [
    {
      minuteOffset: 0,
      timeLabel: '14:00',
      sample: true,
      serviceStatus: { crowd_flow: 'calm', travel: 'calm', gates: 'calm', routes: 'calm', food: 'calm' },
      zones: [
        { id: 'entrance_lalbaug', label: 'Lalbaug Entry', statusColor: 'calm' },
        { id: 'checkpoint_1', label: 'Lalbaug Checkpoint', statusColor: 'calm' },
        { id: 'entrance_chowpatty', label: 'Chowpatty Entry', statusColor: 'calm' },
        { id: 'checkpoint_2', label: 'Chowpatty Checkpoint', statusColor: 'calm' },
        { id: 'parking_chowpatty', label: 'Chowpatty Vehicle Stand', statusColor: 'calm' },
      ],
    },
    {
      minuteOffset: 30,
      timeLabel: '14:30',
      sample: true,
      serviceStatus: { crowd_flow: 'watch', travel: 'calm', gates: 'watch', routes: 'calm', food: 'calm' },
      zones: [
        { id: 'entrance_lalbaug', label: 'Lalbaug Entry', statusColor: 'watch' },
        { id: 'checkpoint_1', label: 'Lalbaug Checkpoint', statusColor: 'watch' },
        { id: 'entrance_chowpatty', label: 'Chowpatty Entry', statusColor: 'calm' },
        { id: 'checkpoint_2', label: 'Chowpatty Checkpoint', statusColor: 'calm' },
        { id: 'parking_chowpatty', label: 'Chowpatty Vehicle Stand', statusColor: 'calm' },
      ],
    },
    {
      minuteOffset: 60,
      timeLabel: '15:00',
      sample: true,
      serviceStatus: { crowd_flow: 'act_now', travel: 'watch', gates: 'watch', routes: 'watch', food: 'calm' },
      zones: [
        { id: 'entrance_lalbaug', label: 'Lalbaug Entry', statusColor: 'act_now' },
        { id: 'checkpoint_1', label: 'Lalbaug Checkpoint', statusColor: 'act_now' },
        { id: 'entrance_chowpatty', label: 'Chowpatty Entry', statusColor: 'watch' },
        { id: 'checkpoint_2', label: 'Chowpatty Checkpoint', statusColor: 'watch' },
        { id: 'parking_chowpatty', label: 'Chowpatty Vehicle Stand', statusColor: 'watch' },
      ],
    },
    {
      minuteOffset: 90,
      timeLabel: '15:30',
      sample: true,
      serviceStatus: { crowd_flow: 'act_now', travel: 'watch', gates: 'act_now', routes: 'watch', food: 'watch' },
      zones: [
        { id: 'entrance_lalbaug', label: 'Lalbaug Entry', statusColor: 'act_now' },
        { id: 'checkpoint_1', label: 'Lalbaug Checkpoint', statusColor: 'act_now' },
        { id: 'entrance_chowpatty', label: 'Chowpatty Entry', statusColor: 'act_now' },
        { id: 'checkpoint_2', label: 'Chowpatty Checkpoint', statusColor: 'act_now' },
        { id: 'parking_chowpatty', label: 'Chowpatty Vehicle Stand', statusColor: 'watch' },
      ],
    },
    {
      minuteOffset: 120,
      timeLabel: '16:00',
      sample: true,
      serviceStatus: { crowd_flow: 'watch', travel: 'calm', gates: 'watch', routes: 'calm', food: 'watch' },
      zones: [
        { id: 'entrance_lalbaug', label: 'Lalbaug Entry', statusColor: 'watch' },
        { id: 'checkpoint_1', label: 'Lalbaug Checkpoint', statusColor: 'watch' },
        { id: 'entrance_chowpatty', label: 'Chowpatty Entry', statusColor: 'watch' },
        { id: 'checkpoint_2', label: 'Chowpatty Checkpoint', statusColor: 'watch' },
        { id: 'parking_chowpatty', label: 'Chowpatty Vehicle Stand', statusColor: 'calm' },
      ],
    },
  ];
}

export function processionOrders(): OrderView[] {
  return [
    { id: 'order_crowd_1', serviceLabel: 'Crowd flow', text: 'Lalbaug checkpoint: brief marshals on staged release', status: 'sent', sample: true },
    { id: 'order_travel_1', serviceLabel: 'Travel', text: 'Charni Road: request 2 standby buses', status: 'pending', sample: true },
  ];
}
