import { describe, expect, it, vi } from 'vitest';
import { getServiceRoleClient } from '../../../lib/server/supabase/client';
import { GET } from './route';

vi.mock('../../../lib/server/supabase/client', () => ({ getServiceRoleClient: vi.fn() }));
const mockedGetClient = vi.mocked(getServiceRoleClient);

describe('GET /api/orders', () => {
  it('requires an event id', async () => {
    const res = await GET(new Request('http://localhost/api/orders'));
    expect(res.status).toBe(400);
  });

  it('returns orders for the event, joined through plans', async () => {
    const rows = [{ id: 'order_1', plan_id: 'plan_1', service: 'gate', text: 'Brief 2 stewards', status: 'sent' }];
    const eq = vi.fn().mockResolvedValue({ data: rows, error: null });
    mockedGetClient.mockReturnValue({ from: () => ({ select: () => ({ eq }) }) } as never);

    const res = await GET(new Request('http://localhost/api/orders?event=event_1'));
    const body = await res.json();

    expect(eq).toHaveBeenCalledWith('plans.event_id', 'event_1');
    expect(body.orders).toEqual([{ id: 'order_1', planId: 'plan_1', service: 'gate', text: 'Brief 2 stewards', status: 'sent' }]);
  });
});
