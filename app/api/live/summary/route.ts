import { NextResponse } from 'next/server';
import { LIVE_SUMMARY_WINDOW_MIN } from '../../../../config/server-extras';
import { checkDrift, findExpectedGateCount } from '../../../../lib/server/live/gateScanDrift';
import { getServiceRoleClient } from '../../../../lib/server/supabase/client';
import { revealIfAboveThreshold, type ZoneCount } from '../../../../lib/server/live/visitorLocation';

interface LiveReportRow {
  source: string;
  payload: Record<string, unknown>;
  time: string;
}

/** GET /api/live/summary?event=<id> — aggregated view of the last LIVE_SUMMARY_WINDOW_MIN minutes
 * of reports: staff chip counts, each gate's latest scanned count (with its drift flag), and any
 * visitor_location zone whose count has crossed the reveal threshold. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get('event');
  if (!eventId) return NextResponse.json({ error: 'missing "event"' }, { status: 400 });

  try {
    const supabase = getServiceRoleClient();
    const since = new Date(Date.now() - LIVE_SUMMARY_WINDOW_MIN * 60_000).toISOString();
    const { data, error } = await supabase
      .from('live_reports')
      .select('source,payload,time')
      .eq('event_id', eventId)
      .gte('time', since)
      .order('time', { ascending: true });
    if (error) throw error;

    const rows = (data ?? []) as LiveReportRow[];
    const staffChipCounts: Record<string, number> = {};
    const gateLatestCount = new Map<string, number>();
    const zoneReportCounts = new Map<string, number>();

    for (const row of rows) {
      if (row.source === 'staff' && Array.isArray(row.payload.chipIds)) {
        for (const chip of row.payload.chipIds as string[]) staffChipCounts[chip] = (staffChipCounts[chip] ?? 0) + 1;
      } else if (row.source === 'gate_scan' && typeof row.payload.gateId === 'string' && typeof row.payload.count === 'number') {
        gateLatestCount.set(row.payload.gateId, row.payload.count); // rows are time-ascending, so last write wins
      } else if (row.source === 'visitor_location' && typeof row.payload.zoneId === 'string') {
        zoneReportCounts.set(row.payload.zoneId, (zoneReportCounts.get(row.payload.zoneId) ?? 0) + 1);
      }
    }

    const gateScans = await Promise.all(
      [...gateLatestCount.entries()].map(async ([gateId, count]) => {
        const expected = await findExpectedGateCount(eventId, gateId);
        const { drift } = checkDrift(count, expected);
        return { gateId, count, expected, drift };
      }),
    );

    const zones = [...zoneReportCounts.entries()].map(([zoneId, count]) => revealIfAboveThreshold(zoneId, count)).filter((z): z is ZoneCount => z !== null);

    return NextResponse.json({ eventId, windowMin: LIVE_SUMMARY_WINDOW_MIN, staffChipCounts, gateScans, zones });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown error reading live reports' }, { status: 500 });
  }
}
