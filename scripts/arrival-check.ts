// Prints gatesOpen/showStart and, per transport mode, the derived arrival mean/std (and rail
// pulse, if any) as clock times — a readable check that arrival estimates land where they should
// relative to the show. Usage: npx tsx scripts/arrival-check.ts [event-file]  (default: stadium)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { EventSchema } from '../contract/schemas';
import { deriveArrival, derivePulse, findMatchingTransportOption, minutesToClock, parseHHMM } from '../lib/server/scenario/arrivalRules';

const samplesDir = path.join(import.meta.dirname, '../contract/samples');
const readJSON = (name: string) => JSON.parse(readFileSync(path.join(samplesDir, name), 'utf8'));

const eventFile = process.argv[2] ?? 'event-stadium.json';
const event = EventSchema.parse(readJSON(eventFile));

console.log(`${eventFile}: gatesOpen=${event.gatesOpen} showStart=${event.showStart}`);
const gatesOpenMin = parseHHMM(event.gatesOpen);

for (const opt of event.transportOptions) {
  const option = findMatchingTransportOption(opt.mode, event)!;
  const { mean, std, withinShowWindow } = deriveArrival({ option, event });
  const meanClock = minutesToClock(gatesOpenMin + mean);
  const flag = withinShowWindow ? '' : '  <-- OUTSIDE [gatesOpen, showStart] window';
  const pulse = derivePulse(option);
  const pulseText = pulse ? `  pulse(period=${pulse.period}min, width=${pulse.width}min)` : '';
  console.log(`  ${opt.mode.padEnd(6)} mean=${meanClock}  std=${std.toFixed(1)}min${pulseText}${flag}`);
}
