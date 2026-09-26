import { describe, expect, it, vi } from 'vitest';
import { verify } from '../../../../lib/server/ledger/ledger';
import { GET } from './route';

vi.mock('../../../../lib/server/ledger/ledger', () => ({ verify: vi.fn() }));
const mockedVerify = vi.mocked(verify);

describe('GET /api/ledger/verify', () => {
  it('requires an event id', async () => {
    const res = await GET(new Request('http://localhost/api/ledger/verify'));
    expect(res.status).toBe(400);
  });

  it('returns the broken seq when tampered', async () => {
    mockedVerify.mockResolvedValue({ ok: false, brokenAtSeq: 2 });
    const res = await GET(new Request('http://localhost/api/ledger/verify?event=e1'));
    const body = await res.json();
    expect(body).toEqual({ ok: false, brokenAtSeq: 2 });
  });
});
