import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ARRIVAL_ASSUMPTIONS } from '../../../config/arrivalAssumptions';
import { EventSchema, type Registration, VenueSchema } from '../../../contract/schemas';
import { callJson } from '../llm/groq';
import { mapColumns } from './mapColumns';
import { normalizeRegistrations } from './normalize';
import { buildGroups } from './buildGroups';

vi.mock('../llm/groq', () => ({ callJson: vi.fn() }));
const mockedCallJson = vi.mocked(callJson);

const samplesDir = path.join(import.meta.dirname, '../../../contract/samples');
const readJSON = (name: string) => JSON.parse(readFileSync(path.join(samplesDir, name), 'utf8'));

function reg(id: string, eventId: string, overrides: Partial<Registration['normalized']>): Registration {
  return {
    id,
    eventId,
    raw: {},
    normalized: { originArea: 'Kharghar', travelMode: 'metro', hotelId: null, groupSize: 1, gateHint: null, ...overrides },
    groupId: null,
  };
}

describe('buildGroups — stadium event', () => {
  const venue = VenueSchema.parse(readJSON('venue-stadium.json'));
  const event = EventSchema.parse(readJSON('event-stadium.json'));

  // origin is no longer part of the bucket key (see buildGroups.ts's bucketKey comment), so
  // distinctness here comes from mode/hotel/gateHint, not from originArea
  const big = ARRIVAL_ASSUMPTIONS.minGroupSize + 10;
  const registrations: Registration[] = [
    reg('r1', event.id, { travelMode: 'metro', hotelId: null, groupSize: big }), // stays its own group (>= minGroupSize)
    reg('r2', event.id, { travelMode: 'metro', hotelId: 'hotel_kharghar_grand', groupSize: 3 }), // distinct bucket (different hotel), small -> merged
    reg('r3', event.id, { travelMode: 'train', groupSize: 4 }), // small -> merged
    reg('r4', event.id, { travelMode: 'car', groupSize: 5 }), // now routable via tp_parking_north
    reg('r5', event.id, { travelMode: 'other', groupSize: 1 }), // no option for 'other' -> unrouted
  ];
  const totalPeople = registrations.reduce((s, r) => s + r.normalized.groupSize, 0);

  it('produces groups for the routable registrations, none with an empty path', () => {
    const { groups } = buildGroups(registrations, event, venue);
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) expect(g.path.length).toBeGreaterThan(0);
  });

  it('keeps a group at/above minGroupSize under its own descriptive label (not the merged arrow format)', () => {
    const { groups } = buildGroups(registrations, event, venue);
    expect(groups.some((g) => g.label === 'Metro arrivals' && g.size === big)).toBe(true);
  });

  it('merges below-minGroupSize routable groups into a "<Mode> -> <Gate>" group', () => {
    const { groups } = buildGroups(registrations, event, venue);
    expect(groups.some((g) => g.label === 'Metro -> Gate A')).toBe(true);
    expect(groups.some((g) => g.label === 'Train -> Gate C')).toBe(true);
    expect(groups.some((g) => g.label === 'Car -> Gate A')).toBe(true);
  });

  it('routes car registrations via the parking transport point (no longer unrouted)', () => {
    const { unroutedByMode } = buildGroups(registrations, event, venue);
    expect(unroutedByMode.some((u) => u.mode === 'car')).toBe(false);
  });

  it('puts genuinely unroutable modes into unroutedByMode with a per-mode reason, never guesses', () => {
    const { groups, unroutedByMode } = buildGroups(registrations, event, venue);
    expect(unroutedByMode.some((u) => u.mode === 'other' && u.reason.includes('other'))).toBe(true);
    expect(groups.some((g) => g.label.toLowerCase().includes('other arrivals'))).toBe(false);
  });

  it('preserves total people exactly across the merge (groups + unrouted == total registered)', () => {
    const { groups, unroutedTotal } = buildGroups(registrations, event, venue);
    expect(groups.reduce((s, g) => s + g.size, 0) + unroutedTotal).toBe(totalPeople);
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
    reg('p3', event.id, { originArea: 'Dadar', travelMode: 'walk', groupSize: 200 }), // now routable via the walk-in point
  ];

  it('works with zero code changes: produces groups and never an empty path', () => {
    const { groups } = buildGroups(registrations, event, venue);
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) expect(g.path.length).toBeGreaterThan(0);
  });

  it('routes walk registrations via the new walk-in transport point', () => {
    const { unroutedByMode } = buildGroups(registrations, event, venue);
    expect(unroutedByMode.some((u) => u.mode === 'walk')).toBe(false);
  });

  it('accounts for every registered person between groups and unrouted', () => {
    const { groups, unroutedTotal } = buildGroups(registrations, event, venue);
    const total = registrations.reduce((s, r) => s + r.normalized.groupSize, 0);
    expect(groups.reduce((s, g) => s + g.size, 0) + unroutedTotal).toBe(total);
  });
});

function loadCsvRows(fileName: string): { header: string[]; rows: Array<Record<string, string>> } {
  const lines = readFileSync(path.join(samplesDir, fileName), 'utf8').trim().split(/\r?\n/);
  const header = lines[0].split(',');
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']));
  });
  return { header, rows };
}

describe('buildGroups at scale', () => {
  beforeEach(() => {
    mockedCallJson.mockImplementation(async (_prompt, _schema, fallback) => fallback);
  });

  it('the ~20k-row stadium sample: merges the long tail to <=20 groups, unrouted stays under 5%, zero people lost', async () => {
    const venue = VenueSchema.parse(readJSON('venue-stadium.json'));
    const event = EventSchema.parse(readJSON('event-stadium.json'));
    const { header, rows } = loadCsvRows('registrations-stadium.csv');

    const mapping = await mapColumns(header, rows.slice(0, 5));
    const { registrations } = await normalizeRegistrations(rows, mapping, event);
    const { groups, unroutedTotal } = buildGroups(registrations, event, venue);

    const keptPeople = registrations.reduce((s, r) => s + r.normalized.groupSize, 0);
    const groupPeople = groups.reduce((s, g) => s + g.size, 0);

    expect(groupPeople + unroutedTotal).toBe(keptPeople);
    expect(unroutedTotal / keptPeople).toBeLessThan(0.05);
    expect(groups.length).toBeLessThanOrEqual(20);
    for (const g of groups) expect(g.path.length).toBeGreaterThan(0);
  });

  it('the ~10k-row procession sample: unrouted stays under 5%, zero people lost', async () => {
    const venue = VenueSchema.parse(readJSON('venue-procession.json'));
    const event = EventSchema.parse(readJSON('event-procession.json'));
    const { header, rows } = loadCsvRows('registrations-procession.csv');

    const mapping = await mapColumns(header, rows.slice(0, 5));
    const { registrations } = await normalizeRegistrations(rows, mapping, event);
    const { groups, unroutedTotal } = buildGroups(registrations, event, venue);

    const keptPeople = registrations.reduce((s, r) => s + r.normalized.groupSize, 0);
    const groupPeople = groups.reduce((s, g) => s + g.size, 0);

    expect(groupPeople + unroutedTotal).toBe(keptPeople);
    expect(unroutedTotal / keptPeople).toBeLessThan(0.05);
    for (const g of groups) expect(g.path.length).toBeGreaterThan(0);
  });
});
