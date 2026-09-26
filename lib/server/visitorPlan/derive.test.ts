import { describe, expect, it } from 'vitest';
import type { CrowdGroup, Event, InterventionShape, Venue } from '../../../contract/schemas';
import { deriveVisitorFields } from './derive';

const event = {
  gatesOpen: '17:00',
  showStart: '19:30',
  hotels: [{ id: 'hotel_1', name: 'Kharghar Grand', rooms: { value: 10, trust: 'claimed' }, occupied: { value: 0, trust: 'claimed' }, distanceToVenueM: { value: 1000, trust: 'claimed' }, coachOption: true, coachCapacity: null }],
} as unknown as Event;

const venue = {
  gates: [
    { id: 'gate_a', name: 'Gate A', lanes: { value: 4, trust: 'claimed' }, laneRate: { value: 20, trust: 'claimed' }, forecourtAreaM2: { value: 100, trust: 'claimed' } },
    { id: 'gate_b', name: 'Gate B', lanes: { value: 4, trust: 'claimed' }, laneRate: { value: 20, trust: 'claimed' }, forecourtAreaM2: { value: 100, trust: 'claimed' } },
  ],
} as unknown as Venue;

const baseGroup: CrowdGroup = {
  id: 'grp_1',
  label: 'Metro arrivals',
  size: 500,
  mean: 60,
  std: 10,
  ps: 0.4,
  lang: 'en',
  path: ['tp_metro', 'entrance_1', 'gate_a'],
  alt: ['tp_metro', 'entrance_1', 'gate_b'],
};

describe('deriveVisitorFields', () => {
  it('derives gate and leave time from the group path/mean with no levers', () => {
    const result = deriveVisitorFields(baseGroup, venue, event, []);
    expect(result.gateName).toBe('Gate A');
    expect(result.travelDepartClock).toBe('18:00'); // 17:00 + 60min
    expect(result.stay).toBeNull();
  });

  it('shifts arrival for a matching stagger lever', () => {
    const levers: InterventionShape[] = [{ type: 'stagger', cohort: 'grp_1', delta: -30 }];
    const result = deriveVisitorFields(baseGroup, venue, event, levers);
    expect(result.travelDepartClock).toBe('17:30'); // 60 - 30 = 30min after gatesOpen
  });

  it('ignores a stagger lever for a different cohort', () => {
    const levers: InterventionShape[] = [{ type: 'stagger', cohort: 'grp_other', delta: -30 }];
    const result = deriveVisitorFields(baseGroup, venue, event, levers);
    expect(result.travelDepartClock).toBe('18:00');
  });

  it('shifts arrival for a nudge(shift) lever on this cohort', () => {
    const levers: InterventionShape[] = [{ type: 'nudge', cohort: 'grp_1', ask: 'shift', rupees: 100, delta: -20 }];
    const result = deriveVisitorFields(baseGroup, venue, event, levers);
    expect(result.travelDepartClock).toBe('17:40');
  });

  it('reroutes to the alt path for a nudge(reroute) lever on this cohort', () => {
    const levers: InterventionShape[] = [{ type: 'nudge', cohort: 'grp_1', ask: 'reroute', rupees: 0 }];
    const result = deriveVisitorFields(baseGroup, venue, event, levers);
    expect(result.gateName).toBe('Gate B');
  });

  it('houses a group with a housed hotel when a house lever is present', () => {
    const housedGroup: CrowdGroup = { ...baseGroup, housed: ['hotel_1'] };
    const levers: InterventionShape[] = [{ type: 'house' }];
    const result = deriveVisitorFields(housedGroup, venue, event, levers);
    expect(result.stay).toEqual({ hotelName: 'Kharghar Grand', coach: true });
  });

  it('never houses a group without a house lever, even if housed data exists', () => {
    const housedGroup: CrowdGroup = { ...baseGroup, housed: ['hotel_1'] };
    const result = deriveVisitorFields(housedGroup, venue, event, []);
    expect(result.stay).toBeNull();
  });
});
