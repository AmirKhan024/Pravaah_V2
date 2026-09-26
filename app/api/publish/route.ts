import { NextResponse } from 'next/server';
import { publishPlan } from '../../../lib/server/publish/publish';

/** Body: { eventId, planId }. Allowed only when the plan's status is "approved". */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'expected JSON body' }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const eventId = b.eventId;
  const planId = b.planId;
  if (typeof eventId !== 'string' || !eventId) return NextResponse.json({ error: 'missing "eventId"' }, { status: 400 });
  if (typeof planId !== 'string' || !planId) return NextResponse.json({ error: 'missing "planId"' }, { status: 400 });

  const result = await publishPlan(eventId, planId);
  if (!result.ok) return NextResponse.json(result, { status: result.reason === 'plan not found' ? 404 : 409 });
  return NextResponse.json(result);
}
