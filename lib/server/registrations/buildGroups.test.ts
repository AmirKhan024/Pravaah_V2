import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EventSchema, type Registration, VenueSchema } from '../../../contract/schemas';
import { buildGroups } from './buildGroups';

const samplesDir = path.join(import.meta.dirname, '../../../contract/samples');
const readJSON = (name: string) => JSON.parse(readFileSync(path.join(samplesDir, name), 'utf8'));

function reg(id: string, eventId: string, overrides: Partial<Registration['normalized']>): Registration {
  return {
    id,
    eventId,
    raw: {},
    normalized: { originArea: 'Kharghar', travelMode: 'metro', hotelId: null, groupSize: 1, gateHint: null, ...overrides },
  };
}

describe('buildGroups — stadium event', () => {
  const venue = VenueSchema.parse(readJSON('venue-stadium.json'));
  const event = EventSchema.parse(readJSON('event-stadium.json'));

  const registrations: Registration[] = [
    reg('r1', event.id, { originArea: 'Kharghar', travelMode: 'metro', groupSize: 3 }),
    reg('r2', event.id, { originArea: 'Kharghar', travelMode: 'metro', groupSize: 2 }),
    reg('r3', event.id, { originArea: 'Panvel', travelMode: 'train', groupSize: 4 }),
    reg('r4', event.id, { originArea: 'Thane', travelMode: 'car', groupSize: 5 }), // no 'car' transport option -> unrouted
    reg('r5', event.id, { originArea: 'Pune', travelMode: 'other', groupSize: 1 }), // 'other' has no option either -> unrouted
  ];

  const totalPeople = registrations.reduce((s, r) => s + r.normalized.groupSize, 0);

  it('produces groups for the routable registrations', () => {
    const { groups } = buildGroups(registrations, event, venue);
    expect(groups.length).toBeGreaterThan(0);
  });

  it('never produces a group with an empty path', () => {
    const { groups } = buildGroups(registrations, event, venue);
    for (const g of groups) expect(g.path.length).toBeGreaterThan(0);
  });

  it('groups the two Kharghar metro rows together (same origin+mode+hotel+gate)', () => {
    const { groups } = buildGroups(registrations, event, venue);
    const metroGroup = groups.find((g) => g.label.includes('Kharghar'));
    expect(metroGroup?.size).toBe(5); // 3 + 2
  });

  it('puts unroutable modes (no matching transport option) into `unrouted`, never guesses a group for them', () => {
    const { groups, unrouted } = buildGroups(registrations, event, venue);
    expect(unrouted.some((u) => u.reason.includes('car'))).toBe(true);
    expect(unrouted.some((u) => u.reason.includes('other'))).toBe(true);
    expect(groups.some((g) => g.label.toLowerCase().includes('car'))).toBe(false);
  });

  it('sum of kept group sizes plus unrouted sizes equals total registered people', () => {
    const { groups, unrouted } = buildGroups(registrations, event, venue);
    const groupTotal = groups.reduce((s, g) => s + g.size, 0);
    const unroutedTotal = unrouted.reduce((s, u) => s + u.size, 0);
    expect(groupTotal + unroutedTotal).toBe(totalPeople);
  });

  it('is pure and deterministic', () => {
    const a = buildGroups(registrations, event, venue);
    const b = buildGroups(registrations, event, venue);
    expect(a).toEqual(b);
  });
});

describe('buildGroups — procession event (same code, different venue/event)', () => {
  const venue = VenueSchema.parse(readJSON('venue-procession.json'));
  const event = EventSchema.parse(readJSON('event-procession.json'));

  const registrations: Registration[] = [
    reg('p1', event.id, { originArea: 'Lalbaug', travelMode: 'train', groupSize: 6 }),
    reg('p2', event.id, { originArea: 'Girgaon', travelMode: 'bus', groupSize: 3 }),
    reg('p3', event.id, { originArea: 'Dadar', travelMode: 'walk', groupSize: 2 }), // no 'walk' option -> unrouted
  ];

  it('works with zero code changes: produces groups and never an empty path', () => {
    const { groups } = buildGroups(registrations, event, venue);
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) expect(g.path.length).toBeGreaterThan(0);
  });

  it('accounts for every registered person between groups and unrouted', () => {
    const { groups, unrouted } = buildGroups(registrations, event, venue);
    const total = registrations.reduce((s, r) => s + r.normalized.groupSize, 0);
    expect(groups.reduce((s, g) => s + g.size, 0) + unrouted.reduce((s, u) => s + u.size, 0)).toBe(total);
  });
});
