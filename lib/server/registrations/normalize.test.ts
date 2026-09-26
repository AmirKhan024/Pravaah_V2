import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventSchema } from '../../../contract/schemas';
import { callJson } from '../llm/groq';
import type { ColumnMapping } from './mapColumns';
import { normalizeRegistrations } from './normalize';

vi.mock('../llm/groq', () => ({ callJson: vi.fn() }));
const mockedCallJson = vi.mocked(callJson);

const event = EventSchema.parse(JSON.parse(readFileSync(path.join(import.meta.dirname, '../../../contract/samples/event-stadium.json'), 'utf8')));

const mapping: ColumnMapping = {
  'Origin City': 'originArea',
  'Mode of Travel': 'travelMode',
  'Hotel Name': 'hotelName',
  'Group Size': 'groupSize',
  'Gate Pref': 'gateHint',
};

function row(overrides: Partial<Record<string, string>> = {}) {
  return { 'Origin City': 'Kharghar', 'Mode of Travel': 'Metro', 'Hotel Name': 'Kharghar Grand', 'Group Size': '2', 'Gate Pref': '', ...overrides };
}

describe('normalizeRegistrations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the LLM to fix a value the fallback synonym list could never catch (e.g. "Harbour line" -> train)', async () => {
    mockedCallJson.mockImplementation(async (prompt) => {
      if (prompt.includes('travel-mode value')) return { 'Harbour line': 'train' };
      if (prompt.includes('place-name value')) return { Kharghar: 'Kharghar' };
      return { 'Kharghar Grand': 'Kharghar Grand' };
    });
    const { registrations, dropped } = await normalizeRegistrations([row({ 'Mode of Travel': 'Harbour line' })], mapping, event);
    expect(dropped).toHaveLength(0);
    expect(registrations[0].normalized.travelMode).toBe('train');
  });

  it('falls back to synonym matching when the LLM fails, still producing usable results', async () => {
    mockedCallJson.mockImplementation(async (_prompt, _schema, fallback) => fallback);
    const rows = [row({ 'Mode of Travel': 'BUS' }), row({ 'Mode of Travel': 'Cab' }), row({ 'Mode of Travel': '' })];
    const { registrations, dropped } = await normalizeRegistrations(rows, mapping, event);
    expect(dropped).toHaveLength(0);
    expect(registrations.map((r) => r.normalized.travelMode)).toEqual(['bus', 'car', 'other']);
  });

  it('drops rows with no determinable origin area, and counts the reason', async () => {
    mockedCallJson.mockImplementation(async (_prompt, _schema, fallback) => fallback);
    const rows = [row(), row({ 'Origin City': '' })];
    const { registrations, dropped } = await normalizeRegistrations(rows, mapping, event);
    expect(registrations).toHaveLength(1);
    expect(dropped).toHaveLength(1);
    expect(dropped[0].reason).toMatch(/origin area/);
  });

  it('defaults a blank group size to 1 instead of dropping the row', async () => {
    mockedCallJson.mockImplementation(async (_prompt, _schema, fallback) => fallback);
    const { registrations, dropped } = await normalizeRegistrations([row({ 'Group Size': '' })], mapping, event);
    expect(dropped).toHaveLength(0);
    expect(registrations[0].normalized.groupSize).toBe(1);
  });

  it('matches a fuzzy hotel name against the event\'s known hotels via the fallback', async () => {
    mockedCallJson.mockImplementation(async (_prompt, _schema, fallback) => fallback);
    const { registrations } = await normalizeRegistrations([row({ 'Hotel Name': 'kharghar grand' })], mapping, event);
    expect(registrations[0].normalized.hotelId).toBe('hotel_kharghar_grand');
  });

  it('treats "N/A" and blank hotel values as no hotel', async () => {
    mockedCallJson.mockImplementation(async (_prompt, _schema, fallback) => fallback);
    const { registrations } = await normalizeRegistrations([row({ 'Hotel Name': 'N/A' }), row({ 'Hotel Name': '' })], mapping, event);
    expect(registrations.map((r) => r.normalized.hotelId)).toEqual([null, null]);
  });

  it('never sends every row to the LLM, only unique values', async () => {
    mockedCallJson.mockImplementation(async (_prompt, _schema, fallback) => fallback);
    const rows = Array.from({ length: 50 }, () => row({ 'Mode of Travel': 'Metro' }));
    await normalizeRegistrations(rows, mapping, event);
    for (const call of mockedCallJson.mock.calls) {
      const prompt = call[0];
      const valuesMatch = prompt.match(/Values: (\[.*\])/);
      if (valuesMatch) expect(JSON.parse(valuesMatch[1]).length).toBeLessThanOrEqual(1);
    }
  });
});
