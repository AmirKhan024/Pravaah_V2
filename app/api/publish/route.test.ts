import { describe, expect, it, vi } from 'vitest';
import { publishPlan } from '../../../lib/server/publish/publish';
import { POST } from './route';

vi.mock('../../../lib/server/publish/publish', () => ({ publishPlan: vi.fn() }));
const mockedPublish = vi.mocked(publishPlan);

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/publish', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
}

describe('POST /api/publish', () => {
  it('requires eventId and planId', async () => {
    const res = await POST(buildRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns the new version on success', async () => {
    mockedPublish.mockResolvedValue({ ok: true, version: 1, saveStatus: { ok: true } });
    const res = await POST(buildRequest({ eventId: 'e1', planId: 'p1' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.version).toBe(1);
  });

  it('returns 409 when the plan is not approved', async () => {
    mockedPublish.mockResolvedValue({ ok: false, reason: 'plan status is "draft", not "approved"', saveStatus: { ok: true } });
    const res = await POST(buildRequest({ eventId: 'e1', planId: 'p1' }));
    expect(res.status).toBe(409);
  });

  it('returns 404 when the plan does not exist', async () => {
    mockedPublish.mockResolvedValue({ ok: false, reason: 'plan not found', saveStatus: { ok: true } });
    const res = await POST(buildRequest({ eventId: 'e1', planId: 'missing' }));
    expect(res.status).toBe(404);
  });
});
