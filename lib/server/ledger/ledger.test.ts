import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getServiceRoleClient } from '../supabase/client';
import { append, verify } from './ledger';

vi.mock('../supabase/client', () => ({ getServiceRoleClient: vi.fn() }));
const mockedGetClient = vi.mocked(getServiceRoleClient);

interface Row {
  event_id: string;
  seq: number;
  ts: string;
  sim_clock: string;
  type: string;
  summary: string;
  payload: unknown;
  prev_hash: string;
  hash: string;
}

/** An in-memory stand-in for the ledger_entries table — enough of the supabase-js chain shape for
 * append()'s read-last/insert and verify()'s full-scan. */
function makeFakeLedger(initialRows: Row[] = []) {
  const rows: Row[] = [...initialRows];
  const client = {
    rows,
    from: (table: string) => {
      if (table !== 'ledger_entries') throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: (_col: string, eventId: string) => {
            const filtered = () => rows.filter((r) => r.event_id === eventId);
            const order = (_col2: string, opts: { ascending: boolean }) => {
              const sorted = () => [...filtered()].sort((a, b) => (opts.ascending ? a.seq - b.seq : b.seq - a.seq));
              return {
                limit: () => ({ maybeSingle: async () => ({ data: sorted()[0] ?? null, error: null }) }),
                then: (resolve: (v: { data: Row[]; error: null }) => void) => resolve({ data: sorted(), error: null }),
              };
            };
            return { order };
          },
        }),
        insert: async (row: Row) => {
          if (rows.some((r) => r.event_id === row.event_id && r.seq === row.seq)) {
            return { error: new Error('duplicate key value violates unique constraint "ledger_entries_pkey"') };
          }
          rows.push(row);
          return { error: null };
        },
      };
    },
  };
  return client;
}

describe('append / verify', () => {
  beforeEach(() => vi.clearAllMocks());

  it('chains seq/prevHash across successive appends', async () => {
    const fake = makeFakeLedger();
    mockedGetClient.mockReturnValue(fake as never);

    const e1 = await append('event_1', { ts: '2026-01-01T00:00:00Z', simClock: '00:00', type: 'forecast_issued', summary: 'first', payload: null });
    const e2 = await append('event_1', { ts: '2026-01-01T00:01:00Z', simClock: '00:01', type: 'warning_raised', summary: 'second', payload: { a: 1 } });

    expect(e1.seq).toBe(1);
    expect(e2.seq).toBe(2);
    expect(e2.prevHash).toBe(e1.hash);

    const result = await verify('event_1');
    expect(result).toEqual({ ok: true, brokenAtSeq: null });
  });

  it('retries on a colliding seq (two writers at once) and still lands on a fresh one', async () => {
    const fake = makeFakeLedger();
    let insertCalls = 0;
    const racingClient = {
      from: (table: string) => {
        const base = fake.from(table);
        return {
          select: base.select,
          insert: async (row: Row) => {
            insertCalls++;
            if (insertCalls === 1) {
              // the "other writer" commits seq 1 first, so this attempt's seq 1 insert collides
              fake.rows.push({ ...row, seq: 1 });
              return { error: new Error('duplicate key value violates unique constraint') };
            }
            return base.insert(row);
          },
        };
      },
    };
    mockedGetClient.mockReturnValue(racingClient as never);

    const entry = await append('event_1', { ts: '2026-01-01T00:00:00Z', simClock: '00:00', type: 'forecast_issued', summary: 'raced', payload: null });
    expect(entry.seq).toBe(2); // seq 1 was taken by the simulated concurrent writer
    expect(insertCalls).toBe(2);
  });

  it('verify finds the first tampered entry', async () => {
    const fake = makeFakeLedger();
    mockedGetClient.mockReturnValue(fake as never);

    await append('event_1', { ts: '2026-01-01T00:00:00Z', simClock: '00:00', type: 'forecast_issued', summary: 'first', payload: null });
    await append('event_1', { ts: '2026-01-01T00:01:00Z', simClock: '00:01', type: 'warning_raised', summary: 'second', payload: null });
    await append('event_1', { ts: '2026-01-01T00:02:00Z', simClock: '00:02', type: 'plan_approved', summary: 'third', payload: null });

    fake.rows[1].summary = 'tampered!';

    const result = await verify('event_1');
    expect(result.ok).toBe(false);
    expect(result.brokenAtSeq).toBe(2);
  });
});
