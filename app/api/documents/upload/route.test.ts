import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callJson } from '../../../../lib/server/llm/groq';
import { getServiceRoleClient } from '../../../../lib/server/supabase/client';
import { POST, type DocumentUploadResult } from './route';

vi.mock('../../../../lib/server/llm/groq', () => ({ callJson: vi.fn() }));
vi.mock('../../../../lib/server/supabase/client', () => ({ getServiceRoleClient: vi.fn() }));

const mockedCallJson = vi.mocked(callJson);
const mockedGetClient = vi.mocked(getServiceRoleClient);

const fixturesDir = path.join(import.meta.dirname, '../../../../lib/server/documents/__fixtures__');
const readFixture = (name: string) => readFileSync(path.join(fixturesDir, name), 'utf8');

function mockSupabase(opts: { venueCapacity: number; venueTrust: 'claimed' | 'documented' | 'observed'; eventDate: string }) {
  const venuesTable = {
    select: () => ({ eq: () => ({ single: async () => ({ data: { data: { capacity: { value: opts.venueCapacity, trust: opts.venueTrust } } }, error: null }) }) }),
    update: () => ({ eq: async () => ({ error: null }) }),
  };
  const venueDocumentsTable = { upsert: vi.fn().mockResolvedValue({ error: null }) };
  const eventsTable = { select: () => ({ eq: () => ({ single: async () => ({ data: { date: opts.eventDate }, error: null }) }) }) };

  return {
    from: (table: string) => {
      if (table === 'venues') return venuesTable;
      if (table === 'venue_documents') return venueDocumentsTable;
      if (table === 'events') return eventsTable;
      throw new Error(`unexpected table ${table}`);
    },
  };
}

function buildRequest(fields: Record<string, string | File>): Request {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return new Request('http://localhost/api/documents/upload', { method: 'POST', body: form });
}

/** The LLM is mocked to read the fixture text itself with a tiny regex parser — good enough to
 * exercise mismatch/expiry logic without a live Groq call. */
function llmReadsFixtureText() {
  mockedCallJson.mockImplementation(async (prompt) => {
    const match = /Document text: "(.*)"/.exec(prompt);
    const text = match ? JSON.parse(`"${match[1]}"`) : '';
    const capacity = Number(/Approved Capacity: (\d+)/.exec(text)?.[1] ?? 0);
    const validTill = /Valid Till: (\d{4}-\d{2}-\d{2})/.exec(text)?.[1] ?? '1970-01-01';
    return { issuingAuthority: 'Maharashtra Fire Department', approvedCapacity: capacity, expiry: validTill, documentType: 'fire_noc' as const };
  });
}

describe('POST /api/documents/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upgrades trust claimed -> documented when the document matches with no mismatch', async () => {
    llmReadsFixtureText();
    mockedGetClient.mockReturnValue(mockSupabase({ venueCapacity: 55000, venueTrust: 'claimed', eventDate: '2026-11-14' }) as never);

    const res = await POST(buildRequest({ venueId: 'venue_dy_patil', eventId: 'event_stadium_final', text: readFixture('valid-fire-noc.txt') }));
    const body = (await res.json()) as DocumentUploadResult;

    expect(body.status).toBe('ok');
    expect(body.document?.mismatchFlags).toEqual([]);
    expect(body.trustUpgraded).toBe(true);
    expect(body.saveStatus.ok).toBe(true);
  });

  it('flags a capacity mismatch and does not upgrade trust', async () => {
    llmReadsFixtureText();
    mockedGetClient.mockReturnValue(mockSupabase({ venueCapacity: 55000, venueTrust: 'claimed', eventDate: '2026-11-14' }) as never);

    const res = await POST(buildRequest({ venueId: 'venue_dy_patil', eventId: 'event_stadium_final', text: readFixture('mismatched-capacity.txt') }));
    const body = (await res.json()) as DocumentUploadResult;

    expect(body.document?.mismatchFlags).toContain('capacity_differs_from_claimed');
    expect(body.trustUpgraded).toBe(false);
  });

  it('flags an expired document and does not upgrade trust', async () => {
    llmReadsFixtureText();
    mockedGetClient.mockReturnValue(mockSupabase({ venueCapacity: 55000, venueTrust: 'claimed', eventDate: '2026-11-14' }) as never);

    const res = await POST(buildRequest({ venueId: 'venue_dy_patil', eventId: 'event_stadium_final', text: readFixture('expired.txt') }));
    const body = (await res.json()) as DocumentUploadResult;

    expect(body.document?.mismatchFlags).toContain('expired');
    expect(body.trustUpgraded).toBe(false);
  });

  it('returns unreadable for an image upload, never guessing at its contents', async () => {
    const res = await POST(buildRequest({ venueId: 'v1', eventId: 'e1', file: new File(['fake'], 'cert.png', { type: 'image/png' }) }));
    const body = (await res.json()) as DocumentUploadResult;

    expect(body.status).toBe('unreadable');
    expect(body.reason).toMatch(/image/i);
  });

  it('falls back to a zero-confidence extraction when the LLM is unavailable, still flagging the mismatch', async () => {
    mockedCallJson.mockImplementation(async (_prompt, _schema, fallback) => fallback);
    mockedGetClient.mockReturnValue(mockSupabase({ venueCapacity: 55000, venueTrust: 'claimed', eventDate: '2026-11-14' }) as never);

    const res = await POST(buildRequest({ venueId: 'venue_dy_patil', eventId: 'event_stadium_final', text: readFixture('valid-fire-noc.txt') }));
    const body = (await res.json()) as DocumentUploadResult;

    expect(body.document?.mismatchFlags).toContain('capacity_differs_from_claimed');
    expect(body.trustUpgraded).toBe(false);
  });

  it('is non-fatal when Supabase is unreachable, still returning the extracted document', async () => {
    llmReadsFixtureText();
    mockedGetClient.mockReturnValue({
      from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: new Error('no connection') }) }) }) }),
    } as never);

    const res = await POST(buildRequest({ venueId: 'venue_dy_patil', eventId: 'event_stadium_final', text: readFixture('valid-fire-noc.txt') }));
    const body = (await res.json()) as DocumentUploadResult;

    expect(body.status).toBe('ok');
    expect(body.saveStatus.ok).toBe(false);
  });
});
