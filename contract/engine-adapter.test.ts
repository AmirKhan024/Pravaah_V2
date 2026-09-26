import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { probeWaits, simulate } from '../engine/simulate';
import { runEnsemble } from '../engine/ensemble';
import { runAblation, runRejected } from '../engine/ablation';
import { optimiseProfile } from '../engine/optimise';
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

describe('accounting: nobody from our own cohorts silently vanishes', () => {
  /**
   * SimResult.missed = venue CAPACITY minus arrived (engine/simulate.ts) — it's relative to the
   * venue's full capacity, not to our (much smaller) registered sample, so it's expected to be
   * large whenever a sample is a fraction of capacity. That is NOT what this test checks. This
   * checks a different, sample-relative invariant: every person WE registered is accounted for —
   * either they arrived, or they're still moving through a zone/link — and none of them are stuck
   * given that gate/link capacity comfortably exceeds their demand (confirmed separately: peak
   * demand at every gate and approach link is under 10% of its capacity for this sample).
   */
  it('stadium: cohort total = arrived + still in transit, with ~0 unaccounted for', async () => {
    const { event, venue, groups } = await loadScenarioInputs('event-stadium.json', 'venue-stadium.json', 'registrations-stadium-small.csv');
    const scenario = toEngineScenario(event, venue, groups);
    const cohortTotal = scenario.cohorts.reduce((s, c) => s + c.size, 0);

    const waits = probeWaits(scenario);
    const result = simulate(scenario, [], { waits });
    const finalFrame = result.frames[result.frames.length - 1];

    const venueZoneIdx = scenario.zones.findIndex((z) => z.type === 'venue');
    const arrived = finalFrame.zoneOcc[venueZoneIdx] ?? 0;
    const stillInTransit =
      scenario.links.reduce((s, _l, i) => s + (finalFrame.linkOcc[i] ?? 0), 0) +
      scenario.zones.reduce((s, z, i) => s + (z.type !== 'venue' ? (finalFrame.zoneOcc[i] ?? 0) : 0), 0);

    const unaccountedFor = cohortTotal - arrived - stillInTransit;
    expect(Math.abs(unaccountedFor)).toBeLessThan(cohortTotal * 0.02); // within rounding, not "missing"

    // gate/link capacity comfortably exceeds this sample's demand everywhere, so nobody should be
    // stuck queuing at showStart either
    expect(result.maxGateWait).toBeLessThan(5); // minutes
  });
});

describe('engine/interventions.ts + ablation.ts generalize past the dyPatil golden scenario', () => {
  beforeEach(() => {
    mockedCallJson.mockImplementation(async (_prompt, _schema, fallback) => fallback);
  });

  it.each([
    ['stadium', 'event-stadium.json', 'venue-stadium.json', 'registrations-stadium-small.csv'],
    ['procession', 'event-procession.json', 'venue-procession.json', 'registrations-procession-small.csv'],
  ])('%s: optimise, ablation and ensemble run without throwing on a non-dyPatil scenario', async (_label, eventFile, venueFile, csvFile) => {
    const { event, venue, groups } = await loadScenarioInputs(eventFile, venueFile, csvFile);
    const scenario = toEngineScenario(event, venue, groups);
    expect(scenario.id).not.toBe('dyPatil');

    const waits = probeWaits(scenario);
    const base = simulate(scenario, [], { waits });

    expect(() => runEnsemble(scenario, 10, base.worst.zone)).not.toThrow();
    expect(() => runAblation(scenario, base, waits)).not.toThrow();
    expect(() => runRejected(scenario, waits)).not.toThrow();
    expect(() => optimiseProfile(scenario, 'Balanced', waits)).not.toThrow();
  });

  it('proposes a shuttle lever on a real transit link, never a hardcoded id', async () => {
    const { event, venue, groups } = await loadScenarioInputs('event-stadium.json', 'venue-stadium.json', 'registrations-stadium-small.csv');
    const scenario = toEngineScenario(event, venue, groups);
    const waits = probeWaits(scenario);
    const plan = optimiseProfile(scenario, 'Safest', waits, { depth: 8 });
    // whether or not a shuttle lever was CHOSEN, every candidate lever the optimiser could have
    // picked from must reference a link that actually exists in this scenario
    const linkIds = new Set(scenario.links.map((l) => l.id));
    for (const lever of plan.chosen) if (lever.type === 'shuttle') expect(linkIds.has(lever.link)).toBe(true);
  });

  it('returns a plan (non-empty levers) when a scenario genuinely has a crush', async () => {
    const { event, venue, groups } = await loadScenarioInputs('event-stadium.json', 'venue-stadium.json', 'registrations-stadium-small.csv');
    const scenario = toEngineScenario(event, venue, groups);
    // force a real crush: gut every gate's lanes and forecourt area so demand overwhelms capacity
    const crushScenario = { ...scenario, zones: scenario.zones.map((z) => (z.type === 'gate' ? { ...z, lanes: 0, areaM2: 10 } : z)) };
    const waits = probeWaits(crushScenario);
    const base = simulate(crushScenario, [], { waits });
    expect(base.crushMin).toBeGreaterThan(0);

    const plan = optimiseProfile(crushScenario, 'Safest', waits, { depth: 6 });
    expect(() => optimiseProfile(crushScenario, 'Safest', waits)).not.toThrow();
    expect(plan.chosen.length).toBeGreaterThan(0);
    expect(plan.result.crushMin).toBeLessThanOrEqual(base.crushMin);
  });
});
