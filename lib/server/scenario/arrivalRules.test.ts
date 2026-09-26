import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EventSchema, VenueSchema } from '../../../contract/schemas';
import { deriveArrival, derivePath, derivePulse, findMatchingTransportOption, parseHHMM } from './arrivalRules';

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
  });

  it('finds the car option (parking-routed) added for build item 4', () => {
    expect(findMatchingTransportOption('car', event)?.id).toBe('opt_car');
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

describe('deriveArrival — anchored to showStart, per mode', () => {
  it('anchors car to config.showAnchoredArrival.car (peakBeforeShowMin=70, spreadMin=25)', () => {
    const carOption = findMatchingTransportOption('car', event)!;
    const { mean, std, withinShowWindow } = deriveArrival({ option: carOption, event });
    const gatesOpenMin = parseHHMM(event.gatesOpen);
    const showStartMin = parseHHMM(event.showStart);
    expect(mean + gatesOpenMin).toBe(showStartMin - 70);
    expect(std).toBe(25);
    expect(withinShowWindow).toBe(true);
  });

  it('never depends on the timetable\'s own entries — same anchor regardless of pulse count', () => {
    const busOption = findMatchingTransportOption('bus', event)!; // 1 timetable entry
    const trainOption = findMatchingTransportOption('train', event)!; // 2 entries, different mode
    const bus = deriveArrival({ option: busOption, event });
    // bus and car share no config values, but bus's own mean must match its OWN mode's anchor,
    // not anything derived from busOption.timetable[0].arrivalTime
    const gatesOpenMin = parseHHMM(event.gatesOpen);
    const showStartMin = parseHHMM(event.showStart);
    expect(bus.mean + gatesOpenMin).toBe(showStartMin - 100);
    expect(trainOption.timetable.length).toBeGreaterThan(1);
  });

  it('clamps into [gatesOpen, showStart] rather than ever falling outside it', () => {
    const anyOption = findMatchingTransportOption('metro', event)!;
    const { mean } = deriveArrival({ option: anyOption, event });
    const gatesOpenMin = parseHHMM(event.gatesOpen);
    const showStartMin = parseHHMM(event.showStart);
    const arrivalAtGateMin = mean + gatesOpenMin;
    expect(arrivalAtGateMin).toBeGreaterThanOrEqual(gatesOpenMin);
    expect(arrivalAtGateMin).toBeLessThanOrEqual(showStartMin);
  });

  it('is deterministic — same input, same output', () => {
    const metroOption = findMatchingTransportOption('metro', event)!;
    const a = deriveArrival({ option: metroOption, event });
    const b = deriveArrival({ option: metroOption, event });
    expect(a).toEqual(b);
  });
});

describe('derivePulse', () => {
  it('gives rail modes (train, metro) a period/width derived from timetable spacing', () => {
    const metroOption = findMatchingTransportOption('metro', event)!; // 17:10, 17:40, 18:10 -> 30min gaps
    const pulse = derivePulse(metroOption);
    expect(pulse).toEqual({ period: 30, width: 9, offset: 0 });
  });

  it('gives no pulse for a rail option with only one timetable entry (no spacing to derive)', () => {
    const trainOption = findMatchingTransportOption('train', event)!;
    // event-stadium.json's train option has 2 entries; construct a 1-entry variant to test the guard
    const oneEntry = { ...trainOption, timetable: [trainOption.timetable[0]] };
    expect(derivePulse(oneEntry)).toBeUndefined();
  });

  it('gives no pulse for a non-rail mode (bus, car, walk)', () => {
    const busOption = findMatchingTransportOption('bus', event)!;
    expect(derivePulse(busOption)).toBeUndefined();
  });
});
