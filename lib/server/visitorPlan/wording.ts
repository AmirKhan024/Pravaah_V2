import { z } from 'zod';
import { VISITOR_PLAN_TEMPLATES, type VisitorPlanTemplateField } from '../../../config/server-extras';
import type { Lang } from '../../../contract/schemas';
import { callJson } from '../llm/groq';

const PLACEHOLDER_RE = /\{[A-Z]+\}/g;
const DIGIT_RE = /\d/;

const TranslationSchema = z.object({ text: z.string() });

function placeholdersIn(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER_RE)].map((m) => m[0]).sort();
}

/** Never a raw digit, and the exact same placeholder tokens as the source template — anything
 * else is rejected in favour of the static template row (see config/server-extras.ts). */
function isSafeTranslation(candidate: string, template: string): boolean {
  if (DIGIT_RE.test(candidate)) return false;
  const expected = placeholdersIn(template);
  const actual = placeholdersIn(candidate);
  return expected.length === actual.length && expected.every((p, i) => p === actual[i]);
}

const LANG_NAME: Record<Lang, string> = { en: 'English', hi: 'Hindi', mr: 'Marathi' };

/**
 * Translates one fixed English template — its {PLACEHOLDER} tokens, never real data — into `lang`.
 * Real gate names/times are substituted in afterward by fillTemplate(), so the LLM never sees a
 * digit, a time, or a venue-specific value.
 */
export async function translateTemplate(field: VisitorPlanTemplateField, lang: Lang): Promise<string> {
  const enTemplate = VISITOR_PLAN_TEMPLATES.en[field];
  if (lang === 'en') return enTemplate;
  const fallbackTemplate = VISITOR_PLAN_TEMPLATES[lang][field];

  const prompt = [
    `Translate this short UI phrase from English to ${LANG_NAME[lang]}.`,
    'Keep every {PLACEHOLDER} token exactly as-is, untranslated, in the same position, unchanged.',
    'Never write a digit. Reply with ONLY a JSON object: { "text": string }.',
    `Phrase: ${JSON.stringify(enTemplate)}`,
  ].join('\n');

  const result = await callJson(prompt, TranslationSchema, { text: fallbackTemplate });
  return isSafeTranslation(result.text, enTemplate) ? result.text : fallbackTemplate;
}

export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(PLACEHOLDER_RE, (token) => values[token.slice(1, -1)] ?? token);
}
