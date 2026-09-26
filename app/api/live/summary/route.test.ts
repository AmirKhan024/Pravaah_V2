import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getServiceRoleClient } from '../../../../lib/server/supabase/client';
import { GET } from './route';

vi.mock('../../../../lib/server/supabase/client', () => ({ getServiceRoleClient: vi.fn() }));
const mockedGetClient = vi.mocked(getServiceRoleClient);

function buildRequest(eventId: string): Request {
  return new Request(`http://localhost/api/live/summary?event=${eventId}`);
}

describe('GET /api/live/summary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('aggregates staff chips, latest gate counts, and revealed zones', async () => {
    const rows = [
      { source: 'staff', payload: { chipIds: ['rain'] }, time: '2026-11-14T12:00:00Z' },
      { source: 'gate_scan', payload: { gateId: 'gate_a', count: 100 }, time: '2026-11-14T12:01:00Z' },
      { source: 'gate_scan', payload: { gateId: 'gate_a', count: 200 }, time: '2026-11-14T12:02:00Z' },
      { source: 'visitor_location', payload: { zoneId: 'zone_1' }, time: '2026-11-14T12:03:00Z' },
    ];

    mockedGetClient.mockReturnValue({
      from: (table: string) => {
        if (table === 'live_reports') {
          return { select: () => ({ eq: () => ({ gte: () => ({ order: async () => ({ data: rows, error: null }) }) }) }) };
        }
        if (table === 'ledger_entries') {
          return { select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) }) };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as never);

    const res = await GET(buildRequest('event_stadium_final'));
    const body = await res.json();

    expect(body.staffChipCounts).toEqual({ rain: 1 });
    expect(body.gateScans).toEqual([{ gateId: 'gate_a', count: 200, expected: null, drift: false }]);
    expect(body.zones).toEqual([]); // 1 report, below default k
  });

  it('requires an event id', async () => {
    const res = await GET(new Request('http://localhost/api/live/summary'));
    expect(res.status).toBe(400);
  });
});
