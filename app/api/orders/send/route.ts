import { NextResponse } from 'next/server';
import { sendOrder } from '../../../../lib/server/orders/send';

const STATUS_CODE: Record<string, number> = { sent: 200, already_sent: 200, not_configured: 200, failed: 500 };

/** Body: { orderId }. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'expected JSON body' }, { status: 400 });
  }

  const orderId = (body as Record<string, unknown> | null)?.orderId;
  if (typeof orderId !== 'string' || !orderId) return NextResponse.json({ error: 'missing "orderId"' }, { status: 400 });

  const result = await sendOrder(orderId);
  return NextResponse.json(result, { status: STATUS_CODE[result.status] ?? 500 });
}
