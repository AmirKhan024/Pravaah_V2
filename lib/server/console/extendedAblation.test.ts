import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toEngineScenario } from '../../../contract/engine-adapter';
import { EventSchema, VenueSchema } from '../../../contract/schemas';
import { runAblation } from '../../../engine/ablation';
import { probeWaits, simulate } from '../../../engine/simulate';
import { callJson } from '../llm/groq';
import { buildGroups } from '../registrations/buildGroups';
import { mapColumns } from '../registrations/mapColumns';
import { normalizeRegistrations } from '../registrations/normalize';
import { ablationSummary, extendedAblation } from './extendedAblation';

vi.mock('../llm/groq', () => ({ callJson: vi.fn() }));
const mockedCallJson = vi.mocked(callJson);

const samplesDir = path.join(import.meta.dirname, '../../../contract/samples');
const readJSON = (name: string) => JSON.parse(readFileSync(path.join(samplesDir, name), 'utf8'));

describe('extendedAblation', () => {
  beforeEach(() => mockedCallJson.mockImplementation(async (_p, _s, fallback) => fallback));

  it('ranks causes by dangerous minutes removed and names the real top cause honestly (large stadium sample)', async () => {
    const event = EventSchema.parse(readJSON('event-stadium.json'));
    const venue = VenueSchema.parse(readJSON('venue-stadium.json'));
    const lines = readFileSync(path.join(samplesDir, 'registrations-stadium.csv'), 'utf8').trim().split(/\r?\n/);
    const header = lines[0].split(',');
    const rows = lines.slice(1).map((line) => { const c = line.split(','); return Object.fromEntries(header.map((h, i) => [h, c[i] ?? ''])); });
    const mapping = await mapColumns(header, rows.slice(0, 5));
    const { registrations } = await normalizeRegistrations(rows, mapping, event);
    const { groups } = buildGroups(registrations, event, venue);
    const scenario = toEngineScenario(event, venue, groups);
    const waits = probeWaits(scenario);
    const base = simulate(scenario, [], { waits });
    const engineRows = runAblation(scenario, base, waits);

    const all = extendedAblation(scenario, base, waits, engineRows);
    expect(all.length).toBe(engineRows.length + 3);
    expect(all.map((r) => r.name)).toEqual(expect.arrayContaining(['Gate capacity shortage', 'Approach/link capacity', 'Arrival concentration']));
    for (let i = 1; i < all.length; i++) expect(all[i - 1].removed).toBeGreaterThanOrEqual(all[i].removed);

    const summary = ablationSummary(all, base.crushMin);
    expect(summary).toContain(all[0].name);
    expect(summary).toContain(String(all[0].removed));
  });
});
