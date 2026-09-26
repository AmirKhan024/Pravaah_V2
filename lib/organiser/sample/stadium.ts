import type { ConsoleState, OrderView, ZoneFrame } from '../types';

/** Continental Cup Final — 5 services, sample:true throughout (see contract/samples/event-stadium.json). */
export const STADIUM_EVENT_ID = 'event_stadium_final';

export function stadiumConsoleState(): ConsoleState {
  return {
    eventId: STADIUM_EVENT_ID,
    eventName: 'Continental Cup Final',
    statusWord: 'act_now',
    sample: true,
    canPublish: false,
    published: false,
    nextDeadline: { value: 15, unit: 'min', sample: true },
    services: [
      {
        id: 'hotels',
        label: 'Hotels',
        statusColor: 'watch',
        headline: { value: 92, unit: '%', sample: true },
        problem: 'Kharghar Grand rooms filling fast',
        sample: true,
        actions: [
          {
            id: 'act_hotels_1',
            serviceId: 'hotels',
            title: 'Confirm coach pickup',
            costLabel: 'Free',
            minutesLeft: { value: 25, unit: 'min', sample: true },
            why: 'Locks coach slots before the hotel releases them to walk-ins.',
            state: 'pending',
            sample: true,
          },
        ],
      },
      {
        id: 'travel',
        label: 'Travel',
        statusColor: 'act_now',
        headline: { value: 4100, unit: 'arriving', sample: true },
        problem: 'Kharghar Metro pulse building up',
        sample: true,
        actions: [
          {
            id: 'act_travel_1',
            serviceId: 'travel',
            title: 'Add 3 shuttles',
            costLabel: 'Rs 45,000',
            minutesLeft: { value: 15, unit: 'min', sample: true },
            why: 'Clears the metro pulse before the queue backs onto the platform.',
            state: 'pending',
            sample: true,
          },
        ],
      },
      {
        id: 'gates',
        label: 'Gates',
        statusColor: 'act_now',
        headline: { value: 60, unit: 'm queue', sample: true },
        problem: 'Gate A queue growing fast',
        sample: true,
        actions: [
          {
            id: 'act_gates_1',
            serviceId: 'gates',
            title: 'Open 4 extra lanes',
            costLabel: 'Rs 8,000',
            minutesLeft: { value: 30, unit: 'min', sample: true },
            why: 'Cuts the Gate A wait before the show starts.',
            state: 'pending',
            sample: true,
          },
        ],
      },
      {
        id: 'routes',
        label: 'Routes',
        statusColor: 'watch',
        headline: { value: 65, unit: '%', sample: true },
        problem: 'North route congestion rising',
        sample: true,
        actions: [
          {
            id: 'act_routes_1',
            serviceId: 'routes',
            title: 'Reroute via South path',
            costLabel: 'Free',
            minutesLeft: { value: 40, unit: 'min', sample: true },
            why: 'Spreads load off the North route before it saturates.',
            state: 'pending',
            sample: true,
          },
        ],
      },
      {
        id: 'food',
        label: 'Food',
        statusColor: 'calm',
        headline: { value: 3, unit: 'stalls open', sample: true },
        problem: 'Zone 2 stalls understaffed',
        sample: true,
        actions: [
          {
            id: 'act_food_1',
            serviceId: 'food',
            title: 'Add 2 food staff',
            costLabel: 'Rs 2,000',
            minutesLeft: { value: 50, unit: 'min', sample: true },
            why: 'Keeps food lines short in Zone 2 through peak arrival.',
            state: 'pending',
            sample: true,
          },
        ],
      },
    ],
  };
}

export function stadiumFrames(): ZoneFrame[] {
  return [
    {
      minuteOffset: 0,
      timeLabel: '17:00',
      sample: true,
      serviceStatus: { hotels: 'calm', travel: 'calm', gates: 'calm', routes: 'calm', food: 'calm' },
      zones: [
        { id: 'entrance_north', label: 'North Entrance', statusColor: 'calm' },
        { id: 'entrance_south', label: 'South Entrance', statusColor: 'calm' },
        { id: 'gate_a', label: 'Gate A', statusColor: 'calm' },
        { id: 'gate_b', label: 'Gate B', statusColor: 'calm' },
        { id: 'gate_c', label: 'Gate C', statusColor: 'calm' },
        { id: 'parking_north', label: 'North Parking', statusColor: 'calm' },
      ],
    },
    {
      minuteOffset: 30,
      timeLabel: '17:30',
      sample: true,
      serviceStatus: { hotels: 'calm', travel: 'watch', gates: 'watch', routes: 'calm', food: 'calm' },
      zones: [
        { id: 'entrance_north', label: 'North Entrance', statusColor: 'watch' },
        { id: 'entrance_south', label: 'South Entrance', statusColor: 'calm' },
        { id: 'gate_a', label: 'Gate A', statusColor: 'watch' },
        { id: 'gate_b', label: 'Gate B', statusColor: 'calm' },
        { id: 'gate_c', label: 'Gate C', statusColor: 'calm' },
        { id: 'parking_north', label: 'North Parking', statusColor: 'watch' },
      ],
    },
    {
      minuteOffset: 60,
      timeLabel: '18:00',
      sample: true,
      serviceStatus: { hotels: 'watch', travel: 'act_now', gates: 'act_now', routes: 'watch', food: 'calm' },
      zones: [
        { id: 'entrance_north', label: 'North Entrance', statusColor: 'act_now' },
        { id: 'entrance_south', label: 'South Entrance', statusColor: 'watch' },
        { id: 'gate_a', label: 'Gate A', statusColor: 'act_now' },
        { id: 'gate_b', label: 'Gate B', statusColor: 'watch' },
        { id: 'gate_c', label: 'Gate C', statusColor: 'calm' },
        { id: 'parking_north', label: 'North Parking', statusColor: 'act_now' },
      ],
    },
    {
      minuteOffset: 90,
      timeLabel: '18:30',
      sample: true,
      serviceStatus: { hotels: 'watch', travel: 'act_now', gates: 'act_now', routes: 'watch', food: 'watch' },
      zones: [
        { id: 'entrance_north', label: 'North Entrance', statusColor: 'act_now' },
        { id: 'entrance_south', label: 'South Entrance', statusColor: 'watch' },
        { id: 'gate_a', label: 'Gate A', statusColor: 'act_now' },
        { id: 'gate_b', label: 'Gate B', statusColor: 'act_now' },
        { id: 'gate_c', label: 'Gate C', statusColor: 'watch' },
        { id: 'parking_north', label: 'North Parking', statusColor: 'act_now' },
      ],
    },
    {
      minuteOffset: 120,
      timeLabel: '19:00',
      sample: true,
      serviceStatus: { hotels: 'calm', travel: 'watch', gates: 'watch', routes: 'calm', food: 'watch' },
      zones: [
        { id: 'entrance_north', label: 'North Entrance', statusColor: 'watch' },
        { id: 'entrance_south', label: 'South Entrance', statusColor: 'calm' },
        { id: 'gate_a', label: 'Gate A', statusColor: 'watch' },
        { id: 'gate_b', label: 'Gate B', statusColor: 'watch' },
        { id: 'gate_c', label: 'Gate C', statusColor: 'calm' },
        { id: 'parking_north', label: 'North Parking', statusColor: 'watch' },
      ],
    },
  ];
}

export function stadiumOrders(): OrderView[] {
  return [
    { id: 'order_hotels_1', serviceLabel: 'Hotels', text: 'Kharghar Grand: hold 45 coach seats from 18:00', status: 'confirmed', sample: true },
    { id: 'order_travel_1', serviceLabel: 'Travel', text: 'Metro ops: extra staff at Kharghar platform', status: 'sent', sample: true },
    { id: 'order_gates_1', serviceLabel: 'Gates', text: 'Gate A: brief 2 extra stewards', status: 'pending', sample: true },
  ];
}
