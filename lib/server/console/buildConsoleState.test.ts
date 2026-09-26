import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toEngineScenario } from '../../../contract/engine-adapter';
import { EventSchema, VenueSchema } from '../../../contract/schemas';
import { runAblation } from '../../../engine/ablation';
import { computeDecisionBoard } from '../../../engine/decisionWindow';
import { runEnsemble } from '../../../engine/ensemble';
import { optimiseProfile } from '../../../engine/optimise';
import { probeWaits, simulate } from '../../../engine/simulate';
import { buildGroups } from '../registrations/buildGroups';
import { mapColumns } from '../registrations/mapColumns';
import { normalizeRegistrations } from '../registrations/normalize';
import { callJson } from '../llm/groq';
import { buildConsoleState } from './buildConsoleState';

vi.mock('../llm/groq', () => ({ callJson: vi.fn() }));
const mockedCallJson = vi.mocked(callJson);

const samplesDir = path.join(import.meta.dirname, '../../../contract/samples');
const readJSON = (name: string) => JSON.parse(readFileSync(path.join(samplesDir, name), 'utf8'));

async function buildStadiumInput() {
  const event = EventSchema.parse(readJSON('event-stadium.json'));
  const venue = VenueSchema.parse(readJSON('venue-stadium.json'));
  const lines = readFileSync(path.join(samplesDir, 'registrations-stadium.csv'), 'utf8').trim().split(/\r?\n/);
  const header = lines[0].split(',');
  const rows = lines.slice(1).map((line) => {
    const c = line.split(',');
    return Object.fromEntries(header.map((h, i) => [h, c[i] ?? '']));
  });
  const mapping = await mapColumns(header, rows.slice(0, 5));
  const { registrations } = await normalizeRegistrations(rows, mapping, event);
  const { groups } = buildGroups(registrations, event, venue);
  const scenario = toEngineScenario(event, venue, groups);
  const waits = probeWaits(scenario);
  const base = simulate(scenario, [], { waits });
  const ensemble = runEnsemble(scenario, 10, base.worst.zone);
  const ablation = runAblation(scenario, base, waits);
  const plan = optimiseProfile(scenario, 'Balanced', waits);
  const decisionBoard = computeDecisionBoard(scenario, plan.chosen);
  return { event, scenario, base, ensemble, ablation, plan, decisionBoard };
}

describe('buildConsoleState', () => {
  beforeEach(() => {
    mockedCallJson.mockImplementation(async (_prompt, _schema, fallback) => fallback);
  });

  it('builds services only from what exists in the scenario (the large stadium sample has a real crush)', async () => {
    const input = await buildStadiumInput();
    const state = await buildConsoleState({ ...input, actionStates: {}, published: false });

    expect(state.eventId).toBe(input.event.id);
    expect(state.services.length).toBeGreaterThan(0);
    expect(state.services.every((s) => s.label.length > 0)).toBe(true);
    // no service for a zone type that doesn't exist in this venue (no food zones in the sample)
    expect(state.services.some((s) => s.id.startsWith('food'))).toBe(false);
    // some gate is under real pressure at this scale
    expect(state.statusWord).not.toBe('calm');
  });

  it('every suggested action has a 4-word-or-fewer title and a one-line why', async () => {
    const input = await buildStadiumInput();
    const state = await buildConsoleState({ ...input, actionStates: {}, published: false });
    const actions = state.services.flatMap((s) => s.actions);
    expect(actions.length).toBeGreaterThan(0);
    for (const a of actions) {
      expect(a.title.split(' ').length).toBeLessThanOrEqual(4);
      expect(a.why.length).toBeGreaterThan(0);
      expect(a.why).not.toMatch(/\d/); // the LLM mock echoes the fallback template, but real numbers are still filled in by code
    }
  });

  it('respects a passed-in approved action state and enables canPublish', async () => {
    const input = await buildStadiumInput();
    const first = await buildConsoleState({ ...input, actionStates: {}, published: false });
    const firstAction = first.services.flatMap((s) => s.actions)[0];
    expect(firstAction).toBeTruthy();

    const second = await buildConsoleState({ ...input, actionStates: { [firstAction.id]: 'approved' }, published: false });
    const matched = second.services.flatMap((s) => s.actions).find((a) => a.id === firstAction.id);
    expect(matched?.state).toBe('approved');
    expect(second.canPublish).toBe(true);
  });

  it('is deterministic given the same inputs and action states', async () => {
    const input = await buildStadiumInput();
    const a = await buildConsoleState({ ...input, actionStates: {}, published: false });
    const b = await buildConsoleState({ ...input, actionStates: {}, published: false });
    expect(a).toEqual(b);
  });
});
