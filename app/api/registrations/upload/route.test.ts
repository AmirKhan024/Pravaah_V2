import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callJson } from '../../../../lib/server/llm/groq';
import { getServiceRoleClient } from '../../../../lib/server/supabase/client';
import { POST } from './route';

vi.mock('../../../../lib/server/llm/groq', () => ({ callJson: vi.fn() }));
vi.mock('../../../../lib/server/supabase/client', () => ({ getServiceRoleClient: vi.fn() }));

const mockedCallJson = vi.mocked(callJson);
const mockedGetClient = vi.mocked(getServiceRoleClient);

const samplesDir = path.join(import.meta.dirname, '../../../../contract/samples');
const readText = (name: string) => readFileSync(path.join(samplesDir, name), 'utf8');
const readJSONText = (name: string) => readText(name);

function upsertOk() {
  return { upsert: vi.fn().mockResolvedValue({ error: null }) };
}

function buildRequest(fileName: string, csv: string, eventJson: string, venueJson: string): Request {
  const form = new FormData();
  form.set('file', new File([csv], fileName, { type: 'text/csv' }));
  form.set('event', eventJson);
  form.set('venue', venueJson);
  return new Request('http://localhost/api/registrations/upload', { method: 'POST', body: form });
}

describe('POST /api/registrations/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // simulate the LLM being unavailable everywhere — every call must still produce usable groups
    // via the config/registrationSynonyms.ts fallback (see build item 3's "LLM failure" requirement)
    mockedCallJson.mockImplementation(async (_prompt, _schema, fallback) => fallback);
    mockedGetClient.mockReturnValue({ from: () => upsertOk() } as never);
  });

  it('processes the messy stadium CSV end to end and produces groups even with the LLM unavailable', async () => {
    const csv = readText('registrations-stadium.csv');
    const event = readJSONText('event-stadium.json');
    const venue = readJSONText('venue-stadium.json');
    const res = await POST(buildRequest('registrations-stadium.csv', csv, event, venue));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.totalRows).toBe(200);
    expect(body.keptRows).toBeGreaterThan(0);
    expect(body.groups.length).toBeGreaterThan(0);
    expect(body.groups.every((g: { path: string[] }) => g.path.length > 0)).toBe(true);
    const groupTotal = body.groups.reduce((s: number, g: { size: number }) => s + g.size, 0);
    const unroutedTotal = body.unroutedTotal as number;
    expect(groupTotal + unroutedTotal).toBe(body.keptPeople);
    expect(body.saved).toBe(true);
  });

  it('processes the messy procession CSV end to end with zero code changes', async () => {
    const csv = readText('registrations-procession.csv');
    const event = readJSONText('event-procession.json');
    const venue = readJSONText('venue-procession.json');
    const res = await POST(buildRequest('registrations-procession.csv', csv, event, venue));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.totalRows).toBe(200);
    expect(body.keptRows).toBeGreaterThan(0);
    expect(body.groups.length).toBeGreaterThan(0);
    expect(body.groups.every((g: { path: string[] }) => g.path.length > 0)).toBe(true);
  });

  it('still returns usable groups when the Supabase save fails, and says so', async () => {
    mockedGetClient.mockImplementation(() => {
      throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY not set');
    });
    const csv = readText('registrations-stadium.csv');
    const event = readJSONText('event-stadium.json');
    const venue = readJSONText('venue-stadium.json');
    const res = await POST(buildRequest('registrations-stadium.csv', csv, event, venue));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.groups.length).toBeGreaterThan(0);
    expect(body.saved).toBe(false);
    expect(body.saveError).toBeTruthy();
  });

  it('includes an "assumed mappings" review list the head can read (e.g. header -> field, value -> value)', async () => {
    const csv = readText('registrations-stadium.csv');
    const event = readJSONText('event-stadium.json');
    const venue = readJSONText('venue-stadium.json');
    const res = await POST(buildRequest('registrations-stadium.csv', csv, event, venue));
    const body = await res.json();
    expect(Array.isArray(body.assumedMappings)).toBe(true);
    expect(body.assumedMappings.some((m: string) => m.includes('->'))).toBe(true);
  });

  it('rejects a request with an invalid event', async () => {
    const csv = readText('registrations-stadium.csv');
    const venue = readJSONText('venue-stadium.json');
    const res = await POST(buildRequest('registrations-stadium.csv', csv, JSON.stringify({ not: 'an event' }), venue));
    expect(res.status).toBe(400);
  });
});
