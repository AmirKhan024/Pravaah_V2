import type { SaveStatus } from '../../../contract/schemas';
import { append } from '../ledger/ledger';
import { getServiceRoleClient } from '../supabase/client';

export interface PublishResult {
  ok: boolean;
  reason?: string;
  version?: number;
  saveStatus: SaveStatus;
}

/** Allowed only when the plan's current status is "approved". Bumps plans.version (a real
 * column — see supabase/schema.sql) and appends a ledger entry recording the decision. */
export async function publishPlan(eventId: string, planId: string): Promise<PublishResult> {
  try {
    const supabase = getServiceRoleClient();
    const { data: plan, error: planErr } = await supabase.from('plans').select('id,status,version').eq('id', planId).eq('event_id', eventId).maybeSingle();
    if (planErr) throw planErr;
    if (!plan) return { ok: false, reason: 'plan not found', saveStatus: { ok: true } };
    if (plan.status !== 'approved') {
      return { ok: false, reason: `plan status is "${plan.status}", not "approved"`, saveStatus: { ok: true } };
    }

    const version = (plan.version ?? 0) + 1;

    const { error: updateErr } = await supabase.from('plans').update({ status: 'published', version }).eq('id', planId);
    if (updateErr) throw updateErr;

    await append(eventId, {
      ts: new Date().toISOString(),
      simClock: '',
      type: 'status_changed',
      summary: `Plan ${planId} published (v${version})`,
      payload: { event: 'plan_published', planId, version },
    });

    return { ok: true, version, saveStatus: { ok: true } };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'unknown error publishing plan';
    console.error('[publish] failed:', error);
    return { ok: false, reason: error, saveStatus: { ok: false, error } };
  }
}
