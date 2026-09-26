import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callJson } from '../../../../lib/server/llm/groq';
import { getServiceRoleClient } from '../../../../lib/server/supabase/client';
import { POST } from './route';

vi.mock('../../../../lib/server/llm/groq', () => ({ callJson: vi.fn() }));
vi.mock('../../../../lib/server/supabase/client', () => ({ getServiceRoleClient: vi.fn() }));

const mockedCallJson = vi.mocked(callJson);
const mockedGetClient = vi.mocked(getServiceRoleClient);

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/live/report', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
}

/** A single stand-in client whose tables all resolve to harmless defaults, so any code path that
 * touches Supabase (insert, events lookup for tick, simulation_results lookup for drift baseline,
 * zone count) has something reasonable to chain against. */
function baseSupabaseMock(overrides: { simulationResultData?: unknown; zoneCount?: number } = {}) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  return {
    from: (table: string) => {
      if (table === 'live_reports') {
        return {
          insert,
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  gte: async () => ({ count: overrides.zoneCount ?? 0, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'events') {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: { data: { gatesOpen: '17:00' } }, error: null }) }) }) };
      }
      if (table === 'simulation_results') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: overrides.simulationResultData ? { data: overrides.simulationResultData } : null, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    _insert: insert,
  };
}

describe('POST /api/live/report', () => {
  beforeEach(() => vi.clearAllMocks());

  it('turns a staff chip report into a clamped ScenarioPatch and flags a rerun', async () => {
    mockedGetClient.mockReturnValue(baseSupabaseMock() as never);
    const res = await POST(buildRequest({ eventId: 'event_stadium_final', source: 'staff', payload: { chipIds: ['rain'] } }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.needsRerun).toBe(true);
    expect(body.patch.capPatch.capMult.walk).toBeLessThan(1);
    expect(body.saveStatus.ok).toBe(true);
  });

  it('classifies free text via the LLM when no chip is given', async () => {
    mockedCallJson.mockResolvedValue({ chips: ['gates_late'] });
    mockedGetClient.mockReturnValue(baseSupabaseMock() as never);
    const res = await POST(buildRequest({ eventId: 'event_stadium_final', source: 'staff', payload: { text: 'gates opened very late today' } }));
    const body = await res.json();

    expect(body.needsRerun).toBe(true);
    expect(body.patch.note).toContain('gates_late');
  });

  it('flags drift on a gate_scan far from the last saved simulation result', async () => {
    mockedGetClient.mockReturnValue(baseSupabaseMock({ simulationResultData: { expectedCountsPerGate: { gate_a: 500 } } }) as never);
    const res = await POST(buildRequest({ eventId: 'event_stadium_final', source: 'gate_scan', payload: { gateId: 'gate_a', count: 900 } }));
    const body = await res.json();

    expect(body.drift).toBe(true);
  });

  it('does not flag drift with no baseline yet', async () => {
    mockedGetClient.mockReturnValue(baseSupabaseMock() as never);
    const res = await POST(buildRequest({ eventId: 'event_stadium_final', source: 'gate_scan', payload: { gateId: 'gate_a', count: 900 } }));
    const body = await res.json();

    expect(body.drift).toBe(false);
  });

  it('rejects visitor_location without explicit opt-in', async () => {
    const res = await POST(buildRequest({ eventId: 'event_stadium_final', source: 'visitor_location', payload: { zoneId: 'zone_1', optedIn: false } }));
    expect(res.status).toBe(400);
  });

  it('never persists coordinates for visitor_location, and only reveals a zone at/above k', async () => {
    const supabase = baseSupabaseMock({ zoneCount: 2 });
    mockedGetClient.mockReturnValue(supabase as never);
    const res = await POST(
      buildRequest({ eventId: 'event_stadium_final', source: 'visitor_location', payload: { zoneId: 'zone_1', optedIn: true, lat: 19.05, lng: 73.03 } }),
    );
    const body = await res.json();

    expect(supabase._insert).toHaveBeenCalledWith(expect.objectContaining({ payload: { zoneId: 'zone_1' } }));
    expect(body.zone).toBeNull(); // count (2) below default k
  });

  it('reveals a zone once its count reaches k', async () => {
    const supabase = baseSupabaseMock({ zoneCount: 10 });
    mockedGetClient.mockReturnValue(supabase as never);
    const res = await POST(buildRequest({ eventId: 'event_stadium_final', source: 'visitor_location', payload: { zoneId: 'zone_1', optedIn: true } }));
    const body = await res.json();

    expect(body.zone).toEqual({ zoneId: 'zone_1', count: 10 });
  });
});
