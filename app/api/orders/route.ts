import { NextResponse } from 'next/server';
import { getServiceRoleClient } from '../../../lib/server/supabase/client';

/** GET /api/orders?event=<id> — orders has no event_id column of its own; reached via plan_id -> plans.event_id. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get('event');
  if (!eventId) return NextResponse.json({ error: 'missing "event"' }, { status: 400 });

  try {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase.from('orders').select('id,plan_id,service,text,status,plans!inner(event_id)').eq('plans.event_id', eventId);
    if (error) throw error;

    const orders = (data ?? []).map((row: { id: string; plan_id: string; service: string; text: string; status: string }) => ({
      id: row.id,
      planId: row.plan_id,
      service: row.service,
      text: row.text,
      status: row.status,
    }));
    return NextResponse.json({ orders });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown error reading orders' }, { status: 500 });
  }
}
