import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { LIVE_SUMMARY_WINDOW_MIN } from '../../../../config/server-extras';
import { LiveReportSchema, type SaveStatus } from '../../../../contract/schemas';
import { applyReport } from '../../../../lib/server/live/replan';
import { getServiceRoleClient } from '../../../../lib/server/supabase/client';
import { countRecentZoneReports, revealIfAboveThreshold, sanitizeVisitorLocationPayload } from '../../../../lib/server/live/visitorLocation';

/** Body: { eventId, source: 'gate_scan'|'staff'|'visitor_location', payload, time? (ISO, defaults to now) }. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'expected JSON body' }, { status: 400 });
  }

  const bodyObj = (body ?? {}) as Record<string, unknown>;
  const eventId = bodyObj.eventId;
  const source = bodyObj.source;
  const payloadIn = bodyObj.payload;

  if (typeof eventId !== 'string' || !eventId) return NextResponse.json({ error: 'missing "eventId"' }, { status: 400 });
  if (source !== 'gate_scan' && source !== 'staff' && source !== 'visitor_location') {
    return NextResponse.json({ error: 'invalid "source"' }, { status: 400 });
  }
  if (typeof payloadIn !== 'object' || payloadIn === null) return NextResponse.json({ error: 'missing "payload"' }, { status: 400 });

  let payload = payloadIn as Record<string, unknown>;

  // visitor_location: opt-in only, and never persists anything but a zone id — no coordinates ever.
  if (source === 'visitor_location') {
    if (payload.optedIn !== true) return NextResponse.json({ error: 'visitor_location requires opt-in ("optedIn": true)' }, { status: 400 });
    const sanitized = sanitizeVisitorLocationPayload(payload);
    if (!sanitized) return NextResponse.json({ error: 'missing "zoneId"' }, { status: 400 });
    payload = sanitized;
  }

  const time = typeof bodyObj.time === 'string' ? bodyObj.time : new Date().toISOString();
  const parsedReport = LiveReportSchema.safeParse({ id: randomUUID(), eventId, source, payload, time });
  if (!parsedReport.success) return NextResponse.json({ error: 'invalid report', issues: parsedReport.error.issues }, { status: 400 });
  const report = parsedReport.data;

  let saveStatus: SaveStatus = { ok: true };
  try {
    const supabase = getServiceRoleClient();
    const { error } = await supabase.from('live_reports').insert({ id: report.id, event_id: eventId, source, payload, time });
    if (error) throw error;
  } catch (err) {
    const error = err instanceof Error ? err.message : 'unknown error saving live report';
    saveStatus = { ok: false, error };
    console.error('[live/report] save failed:', error);
  }

  if (source === 'visitor_location') {
    const zoneId = (payload as { zoneId: string }).zoneId;
    let zone = null;
    try {
      const since = new Date(Date.now() - LIVE_SUMMARY_WINDOW_MIN * 60_000).toISOString();
      const count = await countRecentZoneReports(eventId, zoneId, since);
      zone = revealIfAboveThreshold(zoneId, count);
    } catch (err) {
      console.error('[live/report] zone count failed:', err instanceof Error ? err.message : err);
    }
    return NextResponse.json({ report, zone, saveStatus });
  }

  const { patch, needsRerun, detail } = await applyReport(eventId, report);

  if (source === 'gate_scan') return NextResponse.json({ report, drift: needsRerun, detail, saveStatus });
  return NextResponse.json({ report, patch, needsRerun, detail, saveStatus });
}
