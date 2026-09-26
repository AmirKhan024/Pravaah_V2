import type { z } from 'zod';

/**
 * One JSON call to Groq gpt-oss-120b. The caller supplies a zod schema and a fallback value;
 * this never throws and never returns anything that isn't schema-valid. Retries once on any
 * failure (network error, non-JSON content, schema mismatch), logs every failure, then returns
 * the fallback. The LLM never produces a number here — every caller only ever asks it to map
 * words to words (see CLAUDE.md).
 */
export async function callJson<T>(prompt: string, schema: z.ZodType<T>, fallback: T): Promise<T> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const content = await requestGroq(prompt);
      const parsed = schema.parse(JSON.parse(content));
      return parsed;
    } catch (err) {
      console.error(`[groq.callJson] attempt ${attempt} failed:`, err instanceof Error ? err.message : err);
    }
  }
  console.error('[groq.callJson] both attempts failed, using fallback');
  return fallback;
}

async function requestGroq(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Groq request failed: ${res.status} ${res.statusText}`);

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq response had no content');
  return content;
}
