import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toEngineScenario } from '../../../contract/engine-adapter';
import { EventSchema, VenueSchema } from '../../../contract/schemas';
import type { Scenario } from '../../../engine/types';
import { probeWaits, simulate } from '../../../engine/simulate';
import { buildGroups } from '../registrations/buildGroups';
import { mapColumns } from '../registrations/mapColumns';
import { normalizeRegistrations } from '../registrations/normalize';
import { callJson } from '../llm/groq';
import { buildFlowBoard } from './buildFlowBoard';

vi.mock('../llm/groq', () => ({ callJson: vi.fn() }));
const mockedCallJson = vi.mocked(callJson);

const samplesDir = path.join(import.meta.dirname, '../../../contract/samples');
const readJSON = (name: string) => JSON.parse(readFileSync(path.join(samplesDir, name), 'utf8'));

async function buildSampleScenario(eventFile: string, venueFile: string, csvFile: string): Promise<Scenario> {
  const event = EventSchema.parse(readJSON(eventFile));
  const venue = VenueSchema.parse(readJSON(venueFile));
  const lines = readFileSync(path.join(samplesDir, csvFile), 'utf8').trim().split(/\r?\n/);
  const header = lines[0].split(',');
  const rows = lines.slice(1).map((line) => {
    const c = line.split(',');
    return Object.fromEntries(header.map((h, i) => [h, c[i] ?? '']));
  });
  const mapping = await mapColumns(header, rows.slice(0, 5));
  const { registrations } = await normalizeRegistrations(rows, mapping, event);
  const { groups } = buildGroups(registrations, event, venue);
  return toEngineScenario(event, venue, groups);
}

/** A small, hand-built low-crowd scenario — no fixture files (contract/samples/ is owned by the
 * contract owner) — used to check buildFlowBoard on a genuinely calm evening: one gate, one
 * transport point, a cohort far too small to ever approach either's capacity. */
function calmScenario(): Scenario {
  return {
    name: 'Calm Test Evening',
    sub: 'test',
    venueLabel: 'Test Venue',
    t0Min: 0,
    horizon: 120,
    gatesOpenTick: 0,
    showStartTick: 60,
    laneRate: 40,
    lateBookings: 0,
    zones: [
      { id: 'venue', name: 'Venue', type: 'venue', lat: 0, lng: 0, capacity: 5000 },
      { id: 'gate_a', name: 'Gate A', type: 'gate', lat: 0, lng: 0, areaM2: 200, lanes: 4 },
      { id: 'tp_station', name: 'Station', type: 'transit', lat: 0, lng: 0, areaM2: 300 },
    ],
    links: [
      { id: 'link_gate_a_venue', from: 'gate_a', to: 'venue', name: 'Gate A concourse', mode: 'gate', gate: 'gate_a', ff: 2, areaM2: 150 },
      { id: 'link_tp_station_gate_a', from: 'tp_station', to: 'gate_a', name: 'Station to Gate A', mode: 'walk', cap: 200, ff: 5, areaM2: 300 },
    ],
    cohorts: [{ id: 'cohort_1', label: 'Early birds', size: 300, mean: 0, std: 20, ps: 0.5, lang: 'en', path: ['link_tp_station_gate_a', 'link_gate_a_venue'] }],
  };
}

/** Same shape as calmScenario(), but with far more transport points than FLOW_BOARD_MAX_NODES
 * allows — checks the overflow-merge backstop, not just the common case. */
function manyOriginsScenario(): Scenario {
  const stations = Array.from({ length: 30 }, (_, i) => `tp_${i}`);
  return {
    name: 'Many Origins Test',
    sub: 'test',
    venueLabel: 'Test Venue',
    t0Min: 0,
    horizon: 60,
    gatesOpenTick: 0,
    showStartTick: 30,
    laneRate: 40,
    lateBookings: 0,
    zones: [
      { id: 'venue', name: 'Venue', type: 'venue', lat: 0, lng: 0, capacity: 50000 },
      { id: 'gate_a', name: 'Gate A', type: 'gate', lat: 0, lng: 0, areaM2: 200, lanes: 4 },
      ...stations.map((id) => ({ id, name: id, type: 'transit' as const, lat: 0, lng: 0, areaM2: 100 })),
    ],
    links: [
      { id: 'link_gate_a_venue', from: 'gate_a', to: 'venue', name: 'Gate A concourse', mode: 'gate' as const, gate: 'gate_a', ff: 2, areaM2: 150 },
      ...stations.map((id) => ({ id: `link_${id}_gate_a`, from: id, to: 'gate_a', name: `${id} to Gate A`, mode: 'walk' as const, cap: 50, ff: 5, areaM2: 100 })),
    ],
    cohorts: stations.map((id, i) => ({ id: `cohort_${i}`, label: id, size: 10, mean: 0, std: 20, ps: 0.5, lang: 'en' as const, path: [`link_${id}_gate_a`, 'link_gate_a_venue'] })),
  };
}

function assertValidBoard(board: ReturnType<typeof buildFlowBoard>) {
  expect(board.nodes.length).toBeGreaterThan(0);
  expect(board.nodes.length).toBeLessThanOrEqual(25);
  const nodeIds = new Set(board.nodes.map((n) => n.id));
  expect(nodeIds.size).toBe(board.nodes.length); // no duplicate node ids
  for (const link of board.links) {
    expect(nodeIds.has(link.from)).toBe(true);
    expect(nodeIds.has(link.to)).toBe(true);
  }
  expect(board.frames.length).toBeGreaterThan(0);
  for (const frame of board.frames) {
    for (const id of Object.keys(frame.nodes)) expect(nodeIds.has(id)).toBe(true);
    for (const id of Object.keys(frame.links)) expect(board.links.some((l) => l.id === id)).toBe(true);
  }
}

describe('buildFlowBoard', () => {
  beforeEach(() => {
    mockedCallJson.mockImplementation(async (_prompt, _schema, fallback) => fallback);
  });

  it('produces a valid board for the stadium sample', async () => {
    const scenario = await buildSampleScenario('event-stadium.json', 'venue-stadium.json', 'registrations-stadium-small.csv');
    const waits = probeWaits(scenario);
    const base = simulate(scenario, [], { waits });
    assertValidBoard(buildFlowBoard(scenario, base));
  });

  it('produces a valid board for the procession sample', async () => {
    const scenario = await buildSampleScenario('event-procession.json', 'venue-procession.json', 'registrations-procession-small.csv');
    const waits = probeWaits(scenario);
    const base = simulate(scenario, [], { waits });
    assertValidBoard(buildFlowBoard(scenario, base));
  });

  it('produces a valid, all-calm board for a genuinely calm evening', () => {
    const scenario = calmScenario();
    const waits = probeWaits(scenario);
    const base = simulate(scenario, [], { waits });
    const board = buildFlowBoard(scenario, base);
    assertValidBoard(board);
    for (const frame of board.frames) {
      for (const n of Object.values(frame.nodes)) expect(n.status).toBe('calm');
      for (const l of Object.values(frame.links)) expect(l.status).toBe('calm');
    }
  });

  it('one frame every 5 simulated minutes, up to the scenario horizon', () => {
    const scenario = calmScenario();
    const waits = probeWaits(scenario);
    const base = simulate(scenario, [], { waits });
    const board = buildFlowBoard(scenario, base);
    expect(board.frames.map((f) => f.minute)).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115]);
  });

  it('caps at 25 nodes by folding overflow transport points into one node', () => {
    const scenario = manyOriginsScenario();
    const waits = probeWaits(scenario);
    const base = simulate(scenario, [], { waits });
    assertValidBoard(buildFlowBoard(scenario, base));
  });
});
