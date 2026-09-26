import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { callJson } from './groq';

const schema = z.object({ ok: z.boolean() });

function mockFetchOnce(response: Partial<Response> | (() => Promise<never>)) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (typeof response === 'function') return response();
      return response as Response;
    }),
  );
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, statusText: ok ? 'OK' : 'Error', json: async () => body } as Response;
}

describe('callJson', () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it('returns the schema-validated Groq response on success', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    mockFetchOnce(jsonResponse({ choices: [{ message: { content: JSON.stringify({ ok: true }) } }] }));
    const result = await callJson('prompt', schema, { ok: false });
    expect(result).toEqual({ ok: true });
  });

  it('retries once on a bad response, then succeeds if the retry works', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        call++;
        if (call === 1) return jsonResponse({}, false);
        return jsonResponse({ choices: [{ message: { content: JSON.stringify({ ok: true }) } }] });
      }),
    );
    const result = await callJson('prompt', schema, { ok: false });
    expect(result).toEqual({ ok: true });
    expect(call).toBe(2);
  });

  it('falls back after two failed attempts and logs both failures', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchOnce(jsonResponse({}, false));
    const result = await callJson('prompt', schema, { ok: false });
    expect(result).toEqual({ ok: false });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('falls back when the response is not schema-valid', async () => {
    process.env.GROQ_API_KEY = 'test-key';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchOnce(jsonResponse({ choices: [{ message: { content: JSON.stringify({ ok: 'not-a-boolean' }) } }] }));
    const result = await callJson('prompt', schema, { ok: false });
    expect(result).toEqual({ ok: false });
  });

  it('falls back immediately when GROQ_API_KEY is unset', async () => {
    delete process.env.GROQ_API_KEY;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await callJson('prompt', schema, { ok: false });
    expect(result).toEqual({ ok: false });
  });
});
