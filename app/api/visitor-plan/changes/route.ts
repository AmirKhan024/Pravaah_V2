import { NextResponse } from 'next/server';
import { getServiceRoleClient } from '../../../../lib/server/supabase/client';

/** GET /api/visitor-plan/changes?event=&since=<version> — every visitor_plans row for the event
 * with a version newer than `since` (default 0, i.e. everything ever published). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get('event');
  const sinceParam = url.searchParams.get('since');
  if (!eventId) return NextResponse.json({ error: 'missing "event"' }, { status: 400 });

  const since = sinceParam === null ? 0 : Number(sinceParam);
  if (!Number.isFinite(since) || since < 0) return NextResponse.json({ error: 'invalid "since"' }, { status: 400 });

  try {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase
      .from('visitor_plans')
      .select('id,registration_id,version,data')
      .eq('event_id', eventId)
      .gt('version', since)
      .order('version', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ changed: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown error reading visitor plan changes' }, { status: 500 });
  }
}
