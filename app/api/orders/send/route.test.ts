import { describe, expect, it, vi } from 'vitest';
import { sendOrder } from '../../../../lib/server/orders/send';
import { POST } from './route';

vi.mock('../../../../lib/server/orders/send', () => ({ sendOrder: vi.fn() }));
const mockedSendOrder = vi.mocked(sendOrder);

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/orders/send', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
}

describe('POST /api/orders/send', () => {
  it('requires an orderId', async () => {
    const res = await POST(buildRequest({}));
    expect(res.status).toBe(400);
  });

  it('proxies sendOrder\'s result', async () => {
    mockedSendOrder.mockResolvedValue({ status: 'sent' });
    const res = await POST(buildRequest({ orderId: 'order_1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'sent' });
  });

  it('returns 500 on failure', async () => {
    mockedSendOrder.mockResolvedValue({ status: 'failed', error: 'boom' });
    const res = await POST(buildRequest({ orderId: 'order_1' }));
    expect(res.status).toBe(500);
  });
});
