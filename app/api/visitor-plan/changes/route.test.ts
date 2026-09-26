import { describe, expect, it, vi } from 'vitest';
import { getServiceRoleClient } from '../../../../lib/server/supabase/client';
import { GET } from './route';

vi.mock('../../../../lib/server/supabase/client', () => ({ getServiceRoleClient: vi.fn() }));
const mockedGetClient = vi.mocked(getServiceRoleClient);

describe('GET /api/visitor-plan/changes', () => {
  it('requires an event id', async () => {
    const res = await GET(new Request('http://localhost/api/visitor-plan/changes'));
    expect(res.status).toBe(400);
  });

  it('returns rows newer than "since"', async () => {
    const rows = [{ id: 'vp_1', registration_id: 'grp_1', version: 2, data: {} }];
    mockedGetClient.mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ gt: () => ({ order: async () => ({ data: rows, error: null }) }) }) }) }),
    } as never);

    const res = await GET(new Request('http://localhost/api/visitor-plan/changes?event=e1&since=1'));
    const body = await res.json();
    expect(body.changed).toEqual(rows);
  });
});
