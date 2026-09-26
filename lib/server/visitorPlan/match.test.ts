import { describe, expect, it } from 'vitest';
import type { CrowdGroup, Event } from '../../../contract/schemas';
import { matchCrowdGroup } from './match';

const event = {
  id: 'e1',
  name: 'Test',
  venueId: 'v1',
  date: '2026-11-14',
  gatesOpen: '17:00',
  showStart: '19:30',
  endTime: '22:30',
  hotels: [],
  transportOptions: [
    { id: 'opt_metro', mode: 'metro', transportPointId: 'tp_metro', timetable: [{ arrivalTime: '17:10', pulseSize: { value: 100, trust: 'claimed' } }] },
    { id: 'opt_train', mode: 'train', transportPointId: 'tp_train', timetable: [{ arrivalTime: '17:05', pulseSize: { value: 100, trust: 'claimed' } }] },
  ],
} as unknown as Event;

const groups: CrowdGroup[] = [
  { id: 'grp_metro', label: 'Metro arrivals', size: 500, mean: 30, std: 10, ps: 0.4, lang: 'en', path: ['tp_metro', 'entrance_1', 'gate_a'] },
  { id: 'grp_train_hotel', label: 'Train arrivals (Kharghar Grand)', size: 200, mean: 20, std: 8, ps: 0.4, lang: 'en', path: ['tp_train', 'entrance_2', 'gate_b'] },
  { id: 'grp_train_plain', label: 'Train arrivals', size: 900, mean: 25, std: 9, ps: 0.4, lang: 'en', path: ['tp_train', 'entrance_2', 'gate_b'] },
];

describe('matchCrowdGroup', () => {
  it('matches by mode via the group path -> transport option', () => {
    const result = matchCrowdGroup(groups, event, { mode: 'metro' });
    expect(result?.id).toBe('grp_metro');
  });

  it('prefers a hotel-labeled match over a larger plain one', () => {
    const result = matchCrowdGroup(groups, event, { mode: 'train', hotel: 'Kharghar Grand' });
    expect(result?.id).toBe('grp_train_hotel');
  });

  it('falls back to the largest match when hotel matches nothing', () => {
    const result = matchCrowdGroup(groups, event, { mode: 'train', hotel: 'Nonexistent Inn' });
    expect(result?.id).toBe('grp_train_plain');
  });

  it('returns null when no group matches the mode', () => {
    expect(matchCrowdGroup(groups, event, { mode: 'bus' })).toBeNull();
  });

  it('returns the largest group of any mode when no mode is given', () => {
    const result = matchCrowdGroup(groups, event, {});
    expect(result?.id).toBe('grp_train_plain');
  });
});
