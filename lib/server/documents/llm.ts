import { z } from 'zod';
import { VenueDocumentTypeSchema } from '../../../contract/schemas';
import { callJson } from '../llm/groq';

const ExtractedDocumentSchema = z.object({
  issuingAuthority: z.string(),
  approvedCapacity: z.number().int().nonnegative(),
  expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD'),
  documentType: VenueDocumentTypeSchema,
});
export type ExtractedDocument = z.infer<typeof ExtractedDocumentSchema>;

/** Never trusted blind — computeMismatchFlags() and upgradeTrust() (mismatch.ts) always re-check
 * this against the claimed venue data in plain code before any trust label changes. */
const FALLBACK_DOCUMENT: ExtractedDocument = { issuingAuthority: 'unknown', approvedCapacity: 0, expiry: '1970-01-01', documentType: 'fire_noc' };

/**
 * Reads a venue document's free text (fire NOC / occupancy certificate) into structured fields.
 * This is "reading a messy file" (CLAUDE.md's allowed LLM use), not the engine computing a
 * number — the extracted capacity is never used directly, only compared against the claimed
 * value in plain code.
 */
export async function extractDocumentFields(text: string): Promise<{ result: ExtractedDocument; usedFallback: boolean }> {
  const prompt = [
    'You read an official venue safety document (a fire NOC or occupancy certificate) and extract structured facts.',
    'Reply with ONLY a JSON object with exactly these keys:',
    '- issuingAuthority: string, the authority that issued the document',
    '- approvedCapacity: integer, the maximum occupancy/capacity the document approves',
    '- expiry: string, the document\'s expiry/valid-till date as YYYY-MM-DD',
    '- documentType: either "fire_noc" or "occupancy_cert"',
    'If a fact is not present in the text, make your best reasonable reading of it; never invent an authority name that is not in the text.',
    `Document text: ${JSON.stringify(text.slice(0, 6000))}`,
  ].join('\n');

  const result = await callJson(prompt, ExtractedDocumentSchema, FALLBACK_DOCUMENT);
  return { result, usedFallback: result === FALLBACK_DOCUMENT };
}
