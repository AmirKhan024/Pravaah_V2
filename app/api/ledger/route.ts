import { NextResponse } from 'next/server';
import { getServiceRoleClient } from '../../../lib/server/supabase/client';

/** GET /api/ledger?event=<id> — the full hash-chained log for one event, oldest first. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get('event');
  if (!eventId) return NextResponse.json({ error: 'missing "event"' }, { status: 400 });

  try {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase.from('ledger_entries').select('*').eq('event_id', eventId).order('seq', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ entries: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown error reading ledger' }, { status: 500 });
  }
}
