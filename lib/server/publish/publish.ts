import type { SaveStatus } from '../../../contract/schemas';
import { append } from '../ledger/ledger';
import { getServiceRoleClient } from '../supabase/client';

export interface PublishResult {
  ok: boolean;
  reason?: string;
  version?: number;
  saveStatus: SaveStatus;
}

/**
 * The `plans`/`visitor_plans` tables carry no dedicated version counter (see summary: this would
 * be a clean schema addition). Standing in for one: every publish appends a ledger entry tagged
 * `payload.event === 'plan_published'` (see append() below) — counting those for the event *is*
 * the version number, with no new column needed.
 */
export async function getPublishVersion(eventId: string): Promise<number> {
  const supabase = getServiceRoleClient();
  const { count, error } = await supabase.from('ledger_entries').select('seq', { count: 'exact', head: true }).eq('event_id', eventId).eq('payload->>event', 'plan_published');
  if (error) throw error;
  return count ?? 0;
}

/** Allowed only when the plan's current status is "approved". Bumps the version (see
 * getPublishVersion) and appends the ledger entry that both records the decision and defines the
 * new version count. */
export async function publishPlan(eventId: string, planId: string): Promise<PublishResult> {
  try {
    const supabase = getServiceRoleClient();
    const { data: plan, error: planErr } = await supabase.from('plans').select('id,status').eq('id', planId).eq('event_id', eventId).maybeSingle();
    if (planErr) throw planErr;
    if (!plan) return { ok: false, reason: 'plan not found', saveStatus: { ok: true } };
    if (plan.status !== 'approved') {
      return { ok: false, reason: `plan status is "${plan.status}", not "approved"`, saveStatus: { ok: true } };
    }

    const version = (await getPublishVersion(eventId)) + 1;

    const { error: updateErr } = await supabase.from('plans').update({ status: 'published' }).eq('id', planId);
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
