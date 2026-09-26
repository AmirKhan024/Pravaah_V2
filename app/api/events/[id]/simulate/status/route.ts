import { NextResponse } from 'next/server';
import { getServiceRoleClient } from '../../../../../../lib/server/supabase/client';

/**
 * GET ?id=<runId> — polls the run POST /api/events/[id]/simulate started (see that route's
 * "running" branch). No row yet under that id means the run is still going; a row means it's
 * done, and its data is the same `summary` the POST response would have carried directly.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const runId = new URL(request.url).searchParams.get('id');
  if (!runId) return NextResponse.json({ error: 'missing "id" query param' }, { status: 400 });

  let supabase;
  try {
    supabase = getServiceRoleClient();
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Supabase not configured' }, { status: 503 });
  }

  const { data, error } = await supabase.from('simulation_results').select('data').eq('id', runId).eq('event_id', eventId).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ id: runId, status: 'running' });
  return NextResponse.json({ id: runId, status: 'done', summary: data.data });
}
