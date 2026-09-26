import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { append } from '../ledger/ledger';
import { getServiceRoleClient } from '../supabase/client';
import { sendOrder } from './send';

vi.mock('../ledger/ledger', () => ({ append: vi.fn() }));
vi.mock('../supabase/client', () => ({ getServiceRoleClient: vi.fn() }));

const mockedAppend = vi.mocked(append);
const mockedGetClient = vi.mocked(getServiceRoleClient);

function mockSupabase(order: { status: string } | null, opts: { updateError?: Error } = {}) {
  const update = vi.fn().mockReturnValue({ eq: async () => ({ error: opts.updateError ?? null }) });
  return {
    from: (table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: order ? { id: 'order_1', plan_id: 'plan_1', service: 'gate', text: 'Brief 2 stewards', ...order } : null, error: null }) }) }),
          update,
        };
      }
      if (table === 'plans') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { event_id: 'event_1' }, error: null }) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
    _update: update,
  };
}

describe('sendOrder', () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = 'token';
    process.env.TELEGRAM_CHAT_ID = 'chat';
  });
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it('sends via the Telegram API, marks the order sent, and appends a ledger entry', async () => {
    const supabase = mockSupabase({ status: 'pending' });
    mockedGetClient.mockReturnValue(supabase as never);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true } as Response));

    const result = await sendOrder('order_1');

    expect(result).toEqual({ status: 'sent' });
    expect(supabase._update).toHaveBeenCalledWith({ status: 'sent' });
    expect(mockedAppend).toHaveBeenCalledWith('event_1', expect.objectContaining({ type: 'orders_sent' }));
  });

  it('never sends twice — an already-sent order is a no-op', async () => {
    mockedGetClient.mockReturnValue(mockSupabase({ status: 'sent' }) as never);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await sendOrder('order_1');
    expect(result).toEqual({ status: 'already_sent' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns not_configured and does nothing when the Telegram env is missing', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    mockedGetClient.mockReturnValue(mockSupabase({ status: 'pending' }) as never);
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await sendOrder('order_1');
    expect(result).toEqual({ status: 'not_configured' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports failure without marking sent when the Telegram call fails', async () => {
    const supabase = mockSupabase({ status: 'pending' });
    mockedGetClient.mockReturnValue(supabase as never);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response));

    const result = await sendOrder('order_1');
    expect(result.status).toBe('failed');
    expect(supabase._update).not.toHaveBeenCalled();
  });

  it('reports order not found', async () => {
    mockedGetClient.mockReturnValue(mockSupabase(null) as never);
    const result = await sendOrder('missing');
    expect(result).toEqual({ status: 'failed', error: 'order not found' });
  });
});
