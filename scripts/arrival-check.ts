// Prints gatesOpen/showStart and, per transport mode, the derived arrival mean/std as clock
// times — a readable check that arrival estimates land where they should relative to the show.
// Usage: npx tsx scripts/arrival-check.ts [event-file] [venue-file]  (defaults: the stadium sample)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { EventSchema, VenueSchema } from '../contract/schemas';
import { deriveArrival, findMatchingTransportOption, minutesToClock, parseHHMM } from '../lib/server/scenario/arrivalRules';

const samplesDir = path.join(import.meta.dirname, '../contract/samples');
const readJSON = (name: string) => JSON.parse(readFileSync(path.join(samplesDir, name), 'utf8'));

const eventFile = process.argv[2] ?? 'event-stadium.json';
const venueFile = process.argv[3] ?? 'venue-stadium.json';

const event = EventSchema.parse(readJSON(eventFile));
const venue = VenueSchema.parse(readJSON(venueFile));

console.log(`${eventFile}: gatesOpen=${event.gatesOpen} showStart=${event.showStart}`);
const gatesOpenMin = parseHHMM(event.gatesOpen);

for (const opt of event.transportOptions) {
  const option = findMatchingTransportOption(opt.mode, event)!;
  const { mean, std, withinShowWindow } = deriveArrival({ option, venue, event });
  const meanClock = minutesToClock(gatesOpenMin + mean);
  const flag = withinShowWindow ? '' : '  <-- OUTSIDE [gatesOpen, showStart] window';
  console.log(`  ${opt.mode.padEnd(6)} mean=${meanClock}  std=${std.toFixed(1)}min${flag}`);
}
