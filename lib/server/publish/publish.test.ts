import { beforeEach, describe, expect, it, vi } from 'vitest';
import { append } from '../ledger/ledger';
import { getServiceRoleClient } from '../supabase/client';
import { publishPlan } from './publish';

vi.mock('../ledger/ledger', () => ({ append: vi.fn() }));
vi.mock('../supabase/client', () => ({ getServiceRoleClient: vi.fn() }));

const mockedAppend = vi.mocked(append);
const mockedGetClient = vi.mocked(getServiceRoleClient);

function mockSupabase(opts: { planStatus: string | null; priorPublishCount: number }) {
  return {
    from: (table: string) => {
      if (table === 'plans') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.planStatus ? { id: 'plan_1', status: opts.planStatus } : null, error: null }) }) }) }),
          update: () => ({ eq: async () => ({ error: null }) }),
        };
      }
      if (table === 'ledger_entries') {
        return { select: () => ({ eq: () => ({ eq: async () => ({ count: opts.priorPublishCount, error: null }) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe('publishPlan', () => {
  beforeEach(() => vi.clearAllMocks());

  it('publishes an approved plan and bumps the version', async () => {
    mockedGetClient.mockReturnValue(mockSupabase({ planStatus: 'approved', priorPublishCount: 0 }) as never);
    mockedAppend.mockResolvedValue({} as never);

    const result = await publishPlan('event_1', 'plan_1');
    expect(result).toEqual({ ok: true, version: 1, saveStatus: { ok: true } });
    expect(mockedAppend).toHaveBeenCalledWith('event_1', expect.objectContaining({ type: 'status_changed' }));
  });

  it('bumps the version again on a second publish', async () => {
    mockedGetClient.mockReturnValue(mockSupabase({ planStatus: 'approved', priorPublishCount: 1 }) as never);
    mockedAppend.mockResolvedValue({} as never);

    const result = await publishPlan('event_1', 'plan_1');
    expect(result.version).toBe(2);
  });

  it('refuses to publish a plan that is not approved', async () => {
    mockedGetClient.mockReturnValue(mockSupabase({ planStatus: 'draft', priorPublishCount: 0 }) as never);

    const result = await publishPlan('event_1', 'plan_1');
    expect(result.ok).toBe(false);
    expect(mockedAppend).not.toHaveBeenCalled();
  });

  it('reports plan not found', async () => {
    mockedGetClient.mockReturnValue(mockSupabase({ planStatus: null, priorPublishCount: 0 }) as never);

    const result = await publishPlan('event_1', 'missing_plan');
    expect(result).toEqual({ ok: false, reason: 'plan not found', saveStatus: { ok: true } });
  });
});
