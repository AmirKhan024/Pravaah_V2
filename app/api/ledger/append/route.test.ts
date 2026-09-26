import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { append } from '../../../../lib/server/ledger/ledger';
import { POST } from './route';

vi.mock('../../../../lib/server/ledger/ledger', () => ({ append: vi.fn() }));
const mockedAppend = vi.mocked(append);

function buildRequest(body: unknown, key?: string): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (key !== undefined) headers['x-ledger-key'] = key;
  return new Request('http://localhost/api/ledger/append', { method: 'POST', body: JSON.stringify(body), headers });
}

describe('POST /api/ledger/append', () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LEDGER_INTERNAL_KEY = 'secret-key';
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('rejects a missing or wrong shared secret, without ever echoing it back', async () => {
    const res = await POST(buildRequest({ eventId: 'e1', type: 'forecast_issued', summary: 'x' }, 'wrong'));
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).not.toContain('secret-key');
  });

  it('rejects when no key is configured at all', async () => {
    delete process.env.LEDGER_INTERNAL_KEY;
    const res = await POST(buildRequest({ eventId: 'e1', type: 'forecast_issued', summary: 'x' }, 'anything'));
    expect(res.status).toBe(401);
  });

  it('appends with a valid key', async () => {
    mockedAppend.mockResolvedValue({
      eventId: 'e1',
      seq: 1,
      ts: '2026-01-01T00:00:00Z',
      simClock: '00:00',
      type: 'forecast_issued',
      summary: 'x',
      payload: null,
      prevHash: '0'.repeat(64),
      hash: 'a'.repeat(64),
    });
    const res = await POST(buildRequest({ eventId: 'e1', type: 'forecast_issued', summary: 'x' }, 'secret-key'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entry.seq).toBe(1);
  });

  it('rejects an invalid ledger type', async () => {
    const res = await POST(buildRequest({ eventId: 'e1', type: 'not_a_real_type', summary: 'x' }, 'secret-key'));
    expect(res.status).toBe(400);
  });
});
