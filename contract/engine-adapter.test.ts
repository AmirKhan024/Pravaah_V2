import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { simulate } from '../engine/simulate';
import { buildGroups } from '../lib/server/registrations/buildGroups';
import { mapColumns } from '../lib/server/registrations/mapColumns';
import { normalizeRegistrations } from '../lib/server/registrations/normalize';
import { callJson } from '../lib/server/llm/groq';
import { toEngineScenario } from './engine-adapter';
import { EventSchema, VenueSchema } from './schemas';

vi.mock('../lib/server/llm/groq', () => ({ callJson: vi.fn() }));
const mockedCallJson = vi.mocked(callJson);

const samplesDir = path.join(import.meta.dirname, 'samples');
const readJSON = (name: string) => JSON.parse(readFileSync(path.join(samplesDir, name), 'utf8'));

async function loadScenarioInputs(eventFile: string, venueFile: string, csvFile: string) {
  const event = EventSchema.parse(readJSON(eventFile));
  const venue = VenueSchema.parse(readJSON(venueFile));
  const lines = readFileSync(path.join(samplesDir, csvFile), 'utf8').trim().split(/\r?\n/);
  const header = lines[0].split(',');
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']));
  });
  const mapping = await mapColumns(header, rows.slice(0, 5));
  const { registrations } = await normalizeRegistrations(rows, mapping, event);
  const { groups, unroutedTotal } = buildGroups(registrations, event, venue);
  const keptPeople = registrations.reduce((s, r) => s + r.normalized.groupSize, 0);
  return { event, venue, groups, unroutedTotal, keptPeople };
}

describe('toEngineScenario', () => {
  beforeEach(() => {
    mockedCallJson.mockImplementation(async (_prompt, _schema, fallback) => fallback);
  });

  it.each([
    ['stadium', 'event-stadium.json', 'venue-stadium.json', 'registrations-stadium-small.csv'],
    ['procession', 'event-procession.json', 'venue-procession.json', 'registrations-procession-small.csv'],
  ])('%s: cohort sizes + unrouted == kept people, every cohort has a real path, deterministic, simulate() runs clean', async (_label, eventFile, venueFile, csvFile) => {
    const { event, venue, groups, unroutedTotal, keptPeople } = await loadScenarioInputs(eventFile, venueFile, csvFile);

    const scenario = toEngineScenario(event, venue, groups);

    const cohortPeople = scenario.cohorts.reduce((s, c) => s + c.size, 0);
    expect(cohortPeople + unroutedTotal).toBe(keptPeople);

    const linkIds = new Set(scenario.links.map((l) => l.id));
    for (const c of scenario.cohorts) {
      expect(c.path.length).toBeGreaterThan(0);
      for (const id of c.path) expect(linkIds.has(id)).toBe(true);
      if (c.alt) for (const id of c.alt) expect(linkIds.has(id)).toBe(true);
    }

    // determinism: same input, same Scenario, same simulate() output
    const scenario2 = toEngineScenario(event, venue, groups);
    expect(scenario2).toEqual(scenario);
    const r1 = simulate(scenario, []);
    const r2 = simulate(scenario2, []);
    expect(r1.crushMin).toBe(r2.crushMin);
    expect(r1.missed).toBe(r2.missed);

    // simulate() must not throw against our minimal graph
    expect(() => simulate(scenario, [])).not.toThrow();
  });

  it('rail groups (train, metro) carry pulse through to the Cohort', async () => {
    const { event, venue, groups } = await loadScenarioInputs('event-stadium.json', 'venue-stadium.json', 'registrations-stadium-small.csv');
    const scenario = toEngineScenario(event, venue, groups);
    const railCohorts = scenario.cohorts.filter((c) => c.label.startsWith('Metro') || c.label.startsWith('Train'));
    expect(railCohorts.length).toBeGreaterThan(0);
    expect(railCohorts.some((c) => c.pulse)).toBe(true);
  });

  it('marks every zone/link built from an unobserved Trusted<number> as estimated', async () => {
    const { event, venue, groups } = await loadScenarioInputs('event-stadium.json', 'venue-stadium.json', 'registrations-stadium-small.csv');
    const scenario = toEngineScenario(event, venue, groups);
    const gateZone = scenario.zones.find((z) => z.type === 'gate');
    expect(gateZone?.estimated).toBe(true); // every stadium gate sample value is claimed/documented, never fully observed
  });
});
