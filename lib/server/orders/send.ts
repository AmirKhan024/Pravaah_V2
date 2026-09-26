import { ORDER_TELEGRAM_TIMEOUT_MS } from '../../../config/server-extras';
import { append } from '../ledger/ledger';
import { getServiceRoleClient } from '../supabase/client';

export type SendOrderResult = { status: 'sent' } | { status: 'already_sent' } | { status: 'not_configured' } | { status: 'failed'; error: string };

async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('not_configured');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ORDER_TELEGRAM_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Telegram request failed: ${res.status}`);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * The one path an Order (contract/schemas.ts) is ever sent through — staff/service orders only,
 * never crowd-facing text; text is already built from the plan lever with numbers taken from data,
 * never the LLM (see whoever builds Order.text upstream). Idempotent: an order already "sent" or
 * "confirmed" is never re-sent, and this marks the row "sent" in Supabase before returning, so a
 * retried call after a successful send always sees `already_sent` rather than sending twice.
 */
export async function sendOrder(orderId: string): Promise<SendOrderResult> {
  const supabase = getServiceRoleClient();

  const { data: orderRow, error } = await supabase.from('orders').select('id,plan_id,service,text,status').eq('id', orderId).maybeSingle();
  if (error) return { status: 'failed', error: error.message };
  if (!orderRow) return { status: 'failed', error: 'order not found' };
  if (orderRow.status === 'sent' || orderRow.status === 'confirmed') return { status: 'already_sent' };

  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return { status: 'not_configured' };

  try {
    await sendTelegramMessage(orderRow.text);
  } catch (err) {
    return { status: 'failed', error: err instanceof Error ? err.message : 'unknown Telegram error' };
  }

  const { error: updateErr } = await supabase.from('orders').update({ status: 'sent' }).eq('id', orderId);
  if (updateErr) return { status: 'failed', error: updateErr.message };

  // orders has no event_id column of its own — it's reached via plan_id -> plans.event_id.
  const { data: planRow } = await supabase.from('plans').select('event_id').eq('id', orderRow.plan_id).maybeSingle();
  if (planRow?.event_id) {
    try {
      await append(planRow.event_id, {
        ts: new Date().toISOString(),
        simClock: '',
        type: 'orders_sent',
        summary: `Order ${orderId} sent (${orderRow.service})`,
        payload: { orderId, service: orderRow.service },
      });
    } catch (err) {
      console.error('[orders/send] ledger append failed:', err instanceof Error ? err.message : err);
    }
  }

  return { status: 'sent' };
}
