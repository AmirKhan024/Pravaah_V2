/**
 * Header names (case-insensitive, matched by substring) that identify a column as personally
 * identifying. Their VALUES are never sent to the LLM — see lib/server/registrations/mapColumns.ts
 * — the header name itself is sent as-is, since a label like "Phone" carries no PII on its own.
 */
export const PII_HEADER_SYNONYMS: string[] = [
  'full name',
  'name',
  'first name',
  'last name',
  'guest name',
  'phone',
  'mobile',
  'contact',
  'email',
  'e-mail',
  'ticket id',
  'ticket no',
  'ticket number',
  'pnr',
  'booking id',
  'booking reference',
  'aadhaar',
  'aadhar',
  'passport',
];

export const PII_REDACTION_TOKEN = '[REDACTED]';

export function isPiiHeader(header: string): boolean {
  const h = header.trim().toLowerCase();
  return PII_HEADER_SYNONYMS.some((s) => h === s || h.includes(s));
}
