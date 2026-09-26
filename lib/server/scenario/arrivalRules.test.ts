import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EventSchema, VenueSchema } from '../../../contract/schemas';
import { deriveArrival, derivePath, findMatchingTransportOption, parseHHMM } from './arrivalRules';

const samplesDir = path.join(import.meta.dirname, '../../../contract/samples');
const readJSON = (name: string) => JSON.parse(readFileSync(path.join(samplesDir, name), 'utf8'));

const venue = VenueSchema.parse(readJSON('venue-stadium.json'));
const event = EventSchema.parse(readJSON('event-stadium.json'));

describe('findMatchingTransportOption', () => {
  it('finds the option for a mode the event actually offers', () => {
    expect(findMatchingTransportOption('metro', event)?.id).toBe('opt_metro');
    expect(findMatchingTransportOption('train', event)?.id).toBe('opt_train');
  });

  it('returns undefined for a mode the event has no timetable for', () => {
    expect(findMatchingTransportOption('walk', event)).toBeUndefined();
    expect(findMatchingTransportOption('car', event)).toBeUndefined();
  });
});

describe('derivePath', () => {
  const metroOption = findMatchingTransportOption('metro', event)!;

  it('walks entrance -> gate and defaults to the first listed gate', () => {
    const result = derivePath({ option: metroOption, venue, gateHint: null });
    expect(result).not.toBeNull();
    expect(result!.entranceId).toBe('entrance_north');
    expect(result!.gateId).toBe('gate_a');
    expect(result!.path).toEqual(['tp_kharghar_metro', 'entrance_north', 'gate_a']);
    expect(result!.alt).toEqual(['tp_kharghar_metro', 'entrance_north', 'gate_b']);
  });

  it('honors a gate hint that matches a gate name reachable from the entrance', () => {
    const result = derivePath({ option: metroOption, venue, gateHint: 'Gate B' });
    expect(result!.gateId).toBe('gate_b');
  });

  it('ignores a gate hint that is not reachable from the matched entrance', () => {
    const result = derivePath({ option: metroOption, venue, gateHint: 'Gate C' }); // gate_c is only on entrance_south
    expect(result!.gateId).toBe('gate_a');
  });

  it('returns null (never guesses) when the transport point is not linked to any entrance', () => {
    const orphanOption = { ...metroOption, transportPointId: 'tp_does_not_exist' };
    expect(derivePath({ option: orphanOption, venue, gateHint: null })).toBeNull();
  });
});

describe('deriveArrival', () => {
  it('uses the assumed single-pulse std for a one-entry timetable', () => {
    const busOption = findMatchingTransportOption('bus', event)!;
    expect(busOption.timetable).toHaveLength(1);
    const { std } = deriveArrival({ option: busOption, venue, event });
    expect(std).toBe(15);
  });

  it('produces a pulseSize-weighted mean between the timetable entries for a multi-entry option', () => {
    const trainOption = findMatchingTransportOption('train', event)!;
    const times = trainOption.timetable.map((t) => parseHHMM(t.arrivalTime));
    const { mean, std } = deriveArrival({ option: trainOption, venue, event });
    const gatesOpenMin = parseHHMM(event.gatesOpen);
    // mean is ticks relative to gatesOpen; undo that to sanity-check against the raw timetable window
    const arrivalAtGateMin = mean + gatesOpenMin;
    expect(arrivalAtGateMin).toBeGreaterThan(Math.min(...times));
    expect(arrivalAtGateMin).toBeLessThan(Math.max(...times) + 90); // + generous travel-time margin (road speed beyond walkLimitM)
    expect(std).toBeGreaterThan(5);
    expect(std).toBeLessThan(30);
  });

  it('is deterministic — same input, same output', () => {
    const metroOption = findMatchingTransportOption('metro', event)!;
    const a = deriveArrival({ option: metroOption, venue, event });
    const b = deriveArrival({ option: metroOption, venue, event });
    expect(a).toEqual(b);
  });
});
