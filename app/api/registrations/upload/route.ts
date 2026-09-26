import { NextResponse } from 'next/server';
import { EventSchema, UploadResultSchema, VenueSchema } from '../../../../contract/schemas';
import type { ColumnMapping } from '../../../../lib/server/registrations/mapColumns';
import { mapColumns } from '../../../../lib/server/registrations/mapColumns';
import { normalizeRegistrations } from '../../../../lib/server/registrations/normalize';
import { buildGroups } from '../../../../lib/server/registrations/buildGroups';
import { parseRegistrationFile } from '../../../../lib/server/registrations/parseFile';
import { getServiceRoleClient } from '../../../../lib/server/supabase/client';

function countReasons(reasons: string[]): Array<{ reason: string; count: number }> {
  const counts = new Map<string, number>();
  for (const r of reasons) counts.set(r, (counts.get(r) ?? 0) + 1);
  return [...counts.entries()].map(([reason, count]) => ({ reason, count }));
}

function assumedMappingsSummary(mapping: ColumnMapping, valueMappings: { travelMode: Record<string, string>; area: Record<string, string>; hotel: Record<string, string | null> }): string[] {
  const out: string[] = [];
  for (const [header, field] of Object.entries(mapping)) {
    if (field) out.push(`'${header}' column -> ${field}`);
  }
  for (const [raw, standard] of Object.entries(valueMappings.travelMode)) out.push(`'${raw}' -> ${standard}`);
  for (const [raw, cleaned] of Object.entries(valueMappings.area)) if (raw !== cleaned) out.push(`'${raw}' -> ${cleaned}`);
  for (const [raw, hotel] of Object.entries(valueMappings.hotel)) out.push(`'${raw}' -> ${hotel ?? '(no hotel)'}`);
  return out;
}

/**
 * CSV registrations -> CrowdGroup[]. Runs mapColumns -> normalizeRegistrations -> buildGroups,
 * then tries to save via the service-role key. supabase/schema.sql hasn't been run against a live
 * project yet, so a save failure is expected and non-fatal: the groups are still returned, with
 * saveStatus.ok = false and an error message.
 *
 * multipart/form-data fields: `file` (.csv), `event` (Event JSON), `venue` (Venue JSON).
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'expected multipart/form-data' }, { status: 400 });
  }

  const file = form.get('file');
  const eventRaw = form.get('event');
  const venueRaw = form.get('venue');
  if (!(file instanceof File)) return NextResponse.json({ error: 'missing "file"' }, { status: 400 });
  if (typeof eventRaw !== 'string') return NextResponse.json({ error: 'missing "event" (JSON string)' }, { status: 400 });
  if (typeof venueRaw !== 'string') return NextResponse.json({ error: 'missing "venue" (JSON string)' }, { status: 400 });

  let eventJson: unknown, venueJson: unknown;
  try {
    eventJson = JSON.parse(eventRaw);
    venueJson = JSON.parse(venueRaw);
  } catch {
    return NextResponse.json({ error: '"event" and "venue" must be valid JSON' }, { status: 400 });
  }
  const eventParsed = EventSchema.safeParse(eventJson);
  if (!eventParsed.success) return NextResponse.json({ error: 'invalid event', issues: eventParsed.error.issues }, { status: 400 });
  const venueParsed = VenueSchema.safeParse(venueJson);
  if (!venueParsed.success) return NextResponse.json({ error: 'invalid venue', issues: venueParsed.error.issues }, { status: 400 });
  const event = eventParsed.data;
  const venue = venueParsed.data;

  let headers: string[], rows: Array<Record<string, string>>;
  try {
    ({ headers, rows } = await parseRegistrationFile(file));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'could not parse file' }, { status: 400 });
  }

  const mapping = await mapColumns(headers, rows.slice(0, 5));
  const { registrations: normalized, dropped, valueMappings } = await normalizeRegistrations(rows, mapping, event);
  const { groups, unroutedTotal, unroutedByMode, registrations } = buildGroups(normalized, event, venue);

  let saveStatus: { ok: true } | { ok: false; error: string } = { ok: true };
  try {
    const supabase = getServiceRoleClient();
    const { error: regError } = await supabase.from('registrations').upsert(registrations.map((r) => ({ id: r.id, event_id: r.eventId, group_id: r.groupId, data: r })));
    if (regError) throw regError;
    const { error: groupError } = await supabase.from('crowd_groups').upsert(groups.map((g) => ({ id: g.id, event_id: event.id, data: g })));
    if (groupError) throw groupError;
  } catch (err) {
    const error = err instanceof Error ? err.message : 'unknown error saving to Supabase';
    saveStatus = { ok: false, error };
    console.error('[registrations/upload] save failed:', error);
  }

  const result = UploadResultSchema.parse({
    totalRows: rows.length,
    keptRows: registrations.length,
    keptPeople: registrations.reduce((s, r) => s + r.normalized.groupSize, 0),
    dropped: dropped.length,
    droppedReasons: countReasons(dropped.map((d) => d.reason)),
    groups,
    unroutedTotal,
    unroutedByMode,
    assumedMappings: assumedMappingsSummary(mapping, valueMappings),
    saveStatus,
  });

  return NextResponse.json(result);
}
