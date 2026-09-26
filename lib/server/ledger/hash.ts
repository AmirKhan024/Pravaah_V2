import { createHash } from 'node:crypto';

/** hash = SHA-256(prevHash + canonicalJSON(rest)) — see supabase/schema.sql's ledger_entries comment. */
export const GENESIS_HASH = '0'.repeat(64);

export interface HashableEntry {
  eventId: string;
  seq: number;
  ts: string;
  simClock: string;
  type: string;
  summary: string;
  payload: unknown;
}

/** Deterministic JSON: object keys sorted recursively, so the same logical entry always hashes the
 * same way regardless of property insertion order. */
export function canonicalJSON(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

export function computeHash(prevHash: string, entry: HashableEntry): string {
  return createHash('sha256').update(prevHash + canonicalJSON(entry)).digest('hex');
}
