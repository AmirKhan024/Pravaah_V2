import { beforeEach, describe, expect, it, vi } from 'vitest';
import { append } from '../ledger/ledger';
import { getServiceRoleClient } from '../supabase/client';
import { publishPlan } from './publish';

vi.mock('../ledger/ledger', () => ({ append: vi.fn() }));
vi.mock('../supabase/client', () => ({ getServiceRoleClient: vi.fn() }));

const mockedAppend = vi.mocked(append);
const mockedGetClient = vi.mocked(getServiceRoleClient);

function mockSupabase(opts: { planStatus: string | null; version: number }) {
  const updates: Array<Record<string, unknown>> = [];
  return {
    updates,
    from: (table: string) => {
      if (table === 'plans') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.planStatus ? { id: 'plan_1', status: opts.planStatus, version: opts.version } : null, error: null }) }) }) }),
          update: (patch: Record<string, unknown>) => {
            updates.push(patch);
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe('publishPlan', () => {
  beforeEach(() => vi.clearAllMocks());

  it('publishes an approved plan and bumps plans.version from 0 to 1', async () => {
    const supabase = mockSupabase({ planStatus: 'approved', version: 0 });
    mockedGetClient.mockReturnValue(supabase as never);
    mockedAppend.mockResolvedValue({} as never);

    const result = await publishPlan('event_1', 'plan_1');
    expect(result).toEqual({ ok: true, version: 1, saveStatus: { ok: true } });
    expect(supabase.updates).toEqual([{ status: 'published', version: 1 }]);
    expect(mockedAppend).toHaveBeenCalledWith('event_1', expect.objectContaining({ type: 'status_changed' }));
  });

  it('bumps the version again on a second publish (real column, not a ledger count)', async () => {
    mockedGetClient.mockReturnValue(mockSupabase({ planStatus: 'approved', version: 1 }) as never);
    mockedAppend.mockResolvedValue({} as never);

    const result = await publishPlan('event_1', 'plan_1');
    expect(result.version).toBe(2);
  });

  it('refuses to publish a plan that is not approved', async () => {
    mockedGetClient.mockReturnValue(mockSupabase({ planStatus: 'draft', version: 0 }) as never);

    const result = await publishPlan('event_1', 'plan_1');
    expect(result.ok).toBe(false);
    expect(mockedAppend).not.toHaveBeenCalled();
  });

  it('reports plan not found', async () => {
    mockedGetClient.mockReturnValue(mockSupabase({ planStatus: null, version: 0 }) as never);

    const result = await publishPlan('event_1', 'missing_plan');
    expect(result).toEqual({ ok: false, reason: 'plan not found', saveStatus: { ok: true } });
  });
});
