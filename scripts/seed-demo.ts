// Seeds both sample events (stadium, procession) into Supabase: venue, event, registrations
// (from the small CSV — fast, and matches what contract/contract.test.ts already validates),
// crowd groups, and a simulation result. Idempotent: every write is an upsert keyed by the
// sample's own ids, so running this twice never duplicates a row.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { toEngineScenario } from '../contract/engine-adapter';
import { EventSchema, VenueSchema } from '../contract/schemas';
import { buildGroups } from '../lib/server/registrations/buildGroups';
import { mapColumns } from '../lib/server/registrations/mapColumns';
import { normalizeRegistrations } from '../lib/server/registrations/normalize';
import { getServiceRoleClient } from '../lib/server/supabase/client';
import { probeWaits, simulate } from '../engine/simulate';

const samplesDir = path.join(import.meta.dirname, '../contract/samples');
const readJSON = (name: string) => JSON.parse(readFileSync(path.join(samplesDir, name), 'utf8'));

async function seedEvent(label: string, eventFile: string, venueFile: string, csvFile: string) {
  console.log(`--- seeding ${label} ---`);
  const supabase = getServiceRoleClient();
  const venue = VenueSchema.parse(readJSON(venueFile));
  const event = EventSchema.parse(readJSON(eventFile));

  await supabase.from('venues').upsert({ id: venue.id, name: venue.name, data: venue });
  await supabase.from('events').upsert({ id: event.id, venue_id: venue.id, name: event.name, date: event.date, data: event });
  console.log(`  venue "${venue.name}" + event "${event.name}" upserted`);

  const lines = readFileSync(path.join(samplesDir, csvFile), 'utf8').trim().split(/\r?\n/);
  const header = lines[0].split(',');
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']));
  });
  const mapping = await mapColumns(header, rows.slice(0, 5));
  const { registrations: normalized } = await normalizeRegistrations(rows, mapping, event);
  const { groups, registrations } = buildGroups(normalized, event, venue);

  if (registrations.length) await supabase.from('registrations').upsert(registrations.map((r) => ({ id: r.id, event_id: r.eventId, group_id: r.groupId, data: r })));
  if (groups.length) await supabase.from('crowd_groups').upsert(groups.map((g) => ({ id: g.id, event_id: event.id, data: g })));
  console.log(`  ${registrations.length} registrations, ${groups.length} crowd groups upserted`);

  const scenario = toEngineScenario(event, venue, groups);
  const waits = probeWaits(scenario);
  const base = simulate(scenario, [], { waits });
  await supabase.from('simulation_results').upsert({ id: `sim_${event.id}_seed`, event_id: event.id, data: { crushMin: base.crushMin, missed: base.missed, seeded: true } });
  console.log(`  simulation result upserted (crushMin=${base.crushMin})`);
}

async function main() {
  await seedEvent('stadium', 'event-stadium.json', 'venue-stadium.json', 'registrations-stadium-small.csv');
  await seedEvent('procession', 'event-procession.json', 'venue-procession.json', 'registrations-procession-small.csv');
  console.log('\ndone.');
}

main().catch((err) => {
  console.error('seed-demo failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
