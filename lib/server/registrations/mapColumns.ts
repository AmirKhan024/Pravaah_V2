import { z } from 'zod';
import { isPiiHeader, PII_REDACTION_TOKEN } from '../../../config/piiColumns';
import { COLUMN_FIELD_SYNONYMS, type StandardRegistrationField } from '../../../config/registrationSynonyms';
import { callJson } from '../llm/groq';

export type ColumnMapping = Record<string, StandardRegistrationField | null>;

const STANDARD_FIELDS = ['originArea', 'travelMode', 'hotelName', 'groupSize', 'gateHint'] as const satisfies readonly StandardRegistrationField[];

const MappingResponseSchema = z.record(z.string(), z.enum(STANDARD_FIELDS).nullable());

function fallbackMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const header of headers) {
    const h = header.trim().toLowerCase();
    mapping[header] = STANDARD_FIELDS.find((field) => COLUMN_FIELD_SYNONYMS[field].some((s) => h.includes(s))) ?? null;
  }
  return mapping;
}

/** Redacts PII column values before anything leaves this process — see config/piiColumns.ts. */
function maskSampleRows(headers: string[], rows: Array<Record<string, string>>): Array<Record<string, string>> {
  return rows.map((row) => {
    const masked: Record<string, string> = {};
    for (const h of headers) masked[h] = isPiiHeader(h) ? PII_REDACTION_TOKEN : (row[h] ?? '');
    return masked;
  });
}

/**
 * Maps a messy source file's column headers onto our standard Registration fields. Sends the LLM
 * only headers + up to 5 sample rows (PII columns masked) — never the full file, never a raw
 * value from a name/phone/email/ticket-id column. Falls back to config/registrationSynonyms.ts on
 * any LLM failure. A header that matches nothing (LLM says null, or no synonym matches) is kept
 * in the mapping as null — its raw column is still stored in Registration.raw, never dropped.
 */
export async function mapColumns(headers: string[], sampleRows: Array<Record<string, string>>): Promise<ColumnMapping> {
  const masked = maskSampleRows(headers, sampleRows.slice(0, 5));
  const fallback = fallbackMapping(headers);

  const prompt = [
    'You map spreadsheet column headers to a fixed set of standard fields for an event registration system.',
    `Standard fields: ${STANDARD_FIELDS.join(', ')}.`,
    'Reply with ONLY a JSON object whose keys are exactly the given headers and whose values are one of the standard field names, or null if a header matches none of them.',
    `Headers: ${JSON.stringify(headers)}`,
    `Sample rows (PII columns already redacted; for context only): ${JSON.stringify(masked)}`,
  ].join('\n');

  const result = await callJson(prompt, MappingResponseSchema, fallback);

  const complete: ColumnMapping = {};
  for (const h of headers) complete[h] = h in result ? result[h] : fallback[h];
  return complete;
}
