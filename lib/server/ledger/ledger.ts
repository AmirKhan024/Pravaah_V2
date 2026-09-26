import { LedgerEntrySchema, type LedgerEntry, type LedgerType } from '../../../contract/schemas';
import { getServiceRoleClient } from '../supabase/client';
import { computeHash, GENESIS_HASH } from './hash';

export interface AppendInput {
  ts: string;
  simClock: string;
  type: LedgerType;
  summary: string;
  payload: unknown;
}

const MAX_APPEND_ATTEMPTS = 3;

interface LedgerRow {
  seq: number;
  ts: string;
  sim_clock: string;
  type: string;
  summary: string;
  payload: unknown;
  prev_hash: string;
  hash: string;
}

async function readLast(eventId: string): Promise<{ seq: number; hash: string } | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.from('ledger_entries').select('seq,hash').eq('event_id', eventId).order('seq', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ? { seq: data.seq as number, hash: data.hash as string } : null;
}

/**
 * Appends one entry to the event's hash chain. Two callers appending "at once" both read the same
 * last seq/hash and would collide on the (event_id, seq) primary key — on any insert failure this
 * re-reads the (now-advanced) last row and retries with a fresh seq, up to MAX_APPEND_ATTEMPTS.
 */
export async function append(eventId: string, input: AppendInput): Promise<LedgerEntry> {
  const supabase = getServiceRoleClient();
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_APPEND_ATTEMPTS; attempt++) {
    const last = await readLast(eventId);
    const seq = (last?.seq ?? 0) + 1;
    const prevHash = last?.hash ?? GENESIS_HASH;
    const hash = computeHash(prevHash, { eventId, seq, ts: input.ts, simClock: input.simClock, type: input.type, summary: input.summary, payload: input.payload });

    const entry = LedgerEntrySchema.parse({
      eventId,
      seq,
      ts: input.ts,
      simClock: input.simClock,
      type: input.type,
      summary: input.summary,
      payload: input.payload,
      prevHash,
      hash,
    });

    const { error } = await supabase.from('ledger_entries').insert({
      event_id: entry.eventId,
      seq: entry.seq,
      ts: entry.ts,
      sim_clock: entry.simClock,
      type: entry.type,
      summary: entry.summary,
      payload: entry.payload,
      prev_hash: entry.prevHash,
      hash: entry.hash,
    });

    if (!error) return entry;
    lastError = error;
  }
  throw lastError instanceof Error ? lastError : new Error('ledger append failed after retries');
}

export interface VerifyResult {
  ok: boolean;
  /** the first seq whose stored hash doesn't match a recomputed one, or chains to the wrong prevHash */
  brokenAtSeq: number | null;
}

export async function verify(eventId: string): Promise<VerifyResult> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.from('ledger_entries').select('*').eq('event_id', eventId).order('seq', { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as LedgerRow[];
  let expectedPrevHash = GENESIS_HASH;

  for (const row of rows) {
    if (row.prev_hash !== expectedPrevHash) return { ok: false, brokenAtSeq: row.seq };
    const recomputed = computeHash(row.prev_hash, {
      eventId,
      seq: row.seq,
      ts: row.ts,
      simClock: row.sim_clock,
      type: row.type,
      summary: row.summary,
      payload: row.payload,
    });
    if (recomputed !== row.hash) return { ok: false, brokenAtSeq: row.seq };
    expectedPrevHash = row.hash;
  }
  return { ok: true, brokenAtSeq: null };
}
