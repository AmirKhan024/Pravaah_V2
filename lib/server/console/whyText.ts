import { z } from 'zod';
import { callJson } from '../llm/groq';

const PLACEHOLDER_RE = /\{[A-Z0-9]+\}/g;
const DIGIT_RE = /\d/;
const WordingSchema = z.object({ text: z.string() });

function placeholdersIn(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER_RE)].map((m) => m[0]).sort();
}

/** Never a raw digit, same placeholder tokens as the template — same safety rule as
 * lib/server/visitorPlan/wording.ts, applied to wording polish instead of translation. */
function isSafe(candidate: string, template: string): boolean {
  if (DIGIT_RE.test(candidate)) return false;
  const expected = placeholdersIn(template);
  const actual = placeholdersIn(candidate);
  return expected.length === actual.length && expected.every((p, i) => p === actual[i]);
}

/**
 * One "Why?" line for a console action: code writes the template with real numbers already
 * replaced by {PLACEHOLDER} tokens (see buildConsoleState.ts's callers), the LLM only smooths the
 * English phrasing around those tokens, never seeing or producing a digit. Falls back to the
 * template filled in as-is (still a correct sentence, just plainer) on any failure.
 */
export async function buildWhyText(template: string, values: Record<string, string>): Promise<string> {
  const fallback = fillPlaceholders(template, values);
  const prompt = [
    'Rewrite this one sentence to read more naturally, in plain English, for someone running an event.',
    'Keep every {PLACEHOLDER} token exactly as-is, untranslated, unchanged, same position count.',
    'Never write a digit. Keep it one short sentence. Reply with ONLY a JSON object: { "text": string }.',
    `Sentence: ${JSON.stringify(template)}`,
  ].join('\n');

  const result = await callJson(prompt, WordingSchema, { text: template });
  const wording = isSafe(result.text, template) ? result.text : template;
  return fillPlaceholders(wording, values);
}

function fillPlaceholders(template: string, values: Record<string, string>): string {
  return template.replace(PLACEHOLDER_RE, (token) => values[token.slice(1, -1)] ?? token);
}
