import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getServiceRoleClient } from '../supabase/client';
import { append } from '../ledger/ledger';
import { rerunFromPatch } from './rerun';

vi.mock('../supabase/client', () => ({ getServiceRoleClient: vi.fn() }));
vi.mock('../ledger/ledger', () => ({ append: vi.fn() }));

const mockedGetClient = vi.mocked(getServiceRoleClient);
const mockedAppend = vi.mocked(append);

const samplesDir = path.join(import.meta.dirname, '../../../contract/samples');
const readJSON = (name: string) => JSON.parse(readFileSync(path.join(samplesDir, name), 'utf8'));

function mockSupabase() {
  const upserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  return {
    upserts,
    from: (table: string) => {
      if (table === 'events') return { select: () => ({ eq: () => ({ single: async () => ({ data: { data: readJSON('event-stadium.json'), venue_id: 'venue_dy_patil' }, error: null }) }) }) };
      if (table === 'venues') return { select: () => ({ eq: () => ({ single: async () => ({ data: { data: readJSON('venue-stadium.json') }, error: null }) }) }) };
      if (table === 'crowd_groups') {
        return {
          select: () => ({
            eq: async () => ({
              data: [
                { data: { id: 'grp_early', label: 'Bus arrivals', size: 100, mean: -20, std: 10, ps: 0.4, lang: 'en', path: ['tp_bus_stand', 'entrance_north', 'gate_a'] } },
                { data: { id: 'grp_late', label: 'Car arrivals', size: 100, mean: 100, std: 15, ps: 0.4, lang: 'en', path: ['tp_parking_north', 'entrance_north', 'gate_a'] } },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'console_actions') return { select: () => ({ eq: async () => ({ data: [], error: null }) }) };
      if (table === 'plans') return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) };
      if (table === 'simulation_results')
        return {
          upsert: async (row: Record<string, unknown>) => {
            upserts.push({ table, row });
            return { error: null };
          },
        };
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe('rerunFromPatch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resizes only cohorts whose mean arrival is at/after fromTick (past minutes locked)', async () => {
    const supabase = mockSupabase();
    mockedGetClient.mockReturnValue(supabase as never);
    mockedAppend.mockResolvedValue({} as never);

    const result = await rerunFromPatch('event_stadium_final', { capPatch: { capMult: {}, fromTick: 0 }, sizeMultiplier: 1.5, note: 'more people than expected' }, 'staff report: more people');

    expect(result.ok).toBe(true);
    const saved = supabase.upserts.find((u) => u.table === 'simulation_results');
    expect(saved).toBeTruthy();
    const data = saved!.row.data as { consoleState: unknown };
    expect(data.consoleState).toBeTruthy();
    expect(mockedAppend).toHaveBeenCalledWith('event_stadium_final', expect.objectContaining({ type: 'forecast_issued' }));
  });

  it('reports failure instead of throwing when Supabase is not configured', async () => {
    mockedGetClient.mockImplementation(() => {
      throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY not set');
    });
    const result = await rerunFromPatch('event_stadium_final', { capPatch: { capMult: {}, fromTick: 0 }, sizeMultiplier: 1, note: 'x' }, 'test');
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });
});
