import { NextResponse } from 'next/server';
import { verify } from '../../../../lib/server/ledger/ledger';

/** GET /api/ledger/verify?event=<id> — recomputes the hash chain; { ok: false, brokenAtSeq } names
 * the first tampered/broken entry. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get('event');
  if (!eventId) return NextResponse.json({ error: 'missing "event"' }, { status: 400 });

  try {
    const result = await verify(eventId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown error verifying ledger' }, { status: 500 });
  }
}
