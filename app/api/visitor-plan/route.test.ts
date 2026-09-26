import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublishVersion } from '../../../lib/server/publish/publish';
import { getServiceRoleClient } from '../../../lib/server/supabase/client';
import { GET } from './route';

vi.mock('../../../lib/server/publish/publish', () => ({ getPublishVersion: vi.fn() }));
vi.mock('../../../lib/server/supabase/client', () => ({ getServiceRoleClient: vi.fn() }));

const mockedGetVersion = vi.mocked(getPublishVersion);
const mockedGetClient = vi.mocked(getServiceRoleClient);

const event = {
  id: 'event_1',
  venueId: 'venue_1',
  gatesOpen: '17:00',
  showStart: '19:30',
  hotels: [],
  transportOptions: [{ id: 'opt_metro', mode: 'metro', transportPointId: 'tp_metro', timetable: [{ arrivalTime: '17:10', pulseSize: { value: 100, trust: 'claimed' } }] }],
};

const venue = { gates: [{ id: 'gate_a', name: 'Gate A', lanes: { value: 4, trust: 'claimed' }, laneRate: { value: 20, trust: 'claimed' }, forecourtAreaM2: { value: 100, trust: 'claimed' } }] };

const group = { id: 'grp_1', label: 'Metro arrivals', size: 500, mean: 60, std: 10, ps: 0.4, lang: 'en', path: ['tp_metro', 'entrance_1', 'gate_a'] };

function mockSupabase(opts: { planStatus: 'published' | null; upsertError?: Error }) {
  return {
    from: (table: string) => {
      if (table === 'plans') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: opts.planStatus ? { id: 'plan_1', status: 'published', data: [] } : null, error: null }) }) }) }),
            }),
          }),
        };
      }
      if (table === 'events') return { select: () => ({ eq: () => ({ single: async () => ({ data: { data: event }, error: null }) }) }) };
      if (table === 'venues') return { select: () => ({ eq: () => ({ single: async () => ({ data: { data: venue }, error: null }) }) }) };
      if (table === 'crowd_groups') return { select: () => ({ eq: async () => ({ data: [{ data: group }], error: null }) }) };
      if (table === 'visitor_plans') return { upsert: vi.fn().mockResolvedValue({ error: opts.upsertError ?? null }) };
      throw new Error(`unexpected table ${table}`);
    },
  };
}

function buildRequest(query: string): Request {
  return new Request(`http://localhost/api/visitor-plan?${query}`);
}

describe('GET /api/visitor-plan', () => {
  beforeEach(() => vi.clearAllMocks());

  it('404s with "not published" when the event has no published plan', async () => {
    mockedGetClient.mockReturnValue(mockSupabase({ planStatus: null }) as never);
    const res = await GET(buildRequest('event=event_1'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.reason).toBe('not published');
  });

  it('builds a deterministic visitor plan for a matching mode', async () => {
    mockedGetClient.mockReturnValue(mockSupabase({ planStatus: 'published' }) as never);
    mockedGetVersion.mockResolvedValue(1);

    const res = await GET(buildRequest('event=event_1&mode=metro&lang=en'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.gate).toBe('Use Gate A');
    expect(body.travel).toEqual({ mode: 'metro', departTime: '18:00' });
    expect(body.leaveTime).toBe('17:30'); // 60min - 30min buffer
    expect(body.version).toBe(1);
    expect(body.language).toBe('en');
  });

  it('404s when no crowd group matches the requested mode', async () => {
    mockedGetClient.mockReturnValue(mockSupabase({ planStatus: 'published' }) as never);
    mockedGetVersion.mockResolvedValue(1);

    const res = await GET(buildRequest('event=event_1&mode=bus'));
    expect(res.status).toBe(404);
  });

  it('still returns the plan when saving to Supabase fails', async () => {
    mockedGetClient.mockReturnValue(mockSupabase({ planStatus: 'published', upsertError: new Error('no connection') }) as never);
    mockedGetVersion.mockResolvedValue(1);

    const res = await GET(buildRequest('event=event_1&mode=metro'));
    expect(res.status).toBe(200);
  });
});
