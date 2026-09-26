import { NextResponse } from 'next/server';
import { LedgerTypeSchema } from '../../../../contract/schemas';
import { append } from '../../../../lib/server/ledger/ledger';

/** Server-to-server only: caller must send the shared secret in `x-ledger-key`, matching
 * process.env.LEDGER_INTERNAL_KEY. Never echoes the key back, in a log or otherwise. */
export async function POST(request: Request) {
  const providedKey = request.headers.get('x-ledger-key');
  const expectedKey = process.env.LEDGER_INTERNAL_KEY;
  if (!expectedKey || providedKey !== expectedKey) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'expected JSON body' }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const eventId = b.eventId;
  const typeParsed = LedgerTypeSchema.safeParse(b.type);

  if (typeof eventId !== 'string' || !eventId) return NextResponse.json({ error: 'missing "eventId"' }, { status: 400 });
  if (!typeParsed.success) return NextResponse.json({ error: 'invalid "type"' }, { status: 400 });
  if (typeof b.summary !== 'string' || !b.summary) return NextResponse.json({ error: 'missing "summary"' }, { status: 400 });

  const ts = typeof b.ts === 'string' ? b.ts : new Date().toISOString();
  const simClock = typeof b.simClock === 'string' ? b.simClock : '';

  try {
    const entry = await append(eventId, { ts, simClock, type: typeParsed.data, summary: b.summary, payload: b.payload ?? null });
    return NextResponse.json({ entry });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'append failed' }, { status: 500 });
  }
}
