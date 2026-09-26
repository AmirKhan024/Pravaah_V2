import { buildSampleBundle } from './sample';
import type { ConsoleState, GroundReportSubmission, OrderView, StatusLevel, SubmitResult, ZoneFrame } from './types';

/** In-memory store, one entry per event, seeded lazily from lib/organiser/sample/ on first read.
 * Holds changes for the lifetime of this server/browser process — nothing here is persisted. */
type Store = {
  state: ConsoleState;
  frames: ZoneFrame[];
  orders: OrderView[];
  reports: GroundReportSubmission[];
};

const stores = new Map<string, Store>();

function severity(level: StatusLevel): number {
  return level === 'act_now' ? 2 : level === 'watch' ? 1 : 0;
}

function deescalate(level: StatusLevel): StatusLevel {
  if (level === 'act_now') return 'watch';
  if (level === 'watch') return 'calm';
  return 'calm';
}

function recompute(store: Store): void {
  let worst: StatusLevel = 'calm';
  let anyApproved = false;
  let minPendingMinutes: number | null = null;

  for (const service of store.state.services) {
    if (severity(service.statusColor) > severity(worst)) worst = service.statusColor;
    for (const action of service.actions) {
      if (action.state === 'approved') anyApproved = true;
      if (action.state === 'pending') {
        minPendingMinutes = minPendingMinutes === null ? action.minutesLeft.value : Math.min(minPendingMinutes, action.minutesLeft.value);
      }
    }
  }

  store.state.statusWord = worst;
  store.state.canPublish = anyApproved && !store.state.published;
  store.state.nextDeadline = minPendingMinutes === null ? null : { value: minPendingMinutes, unit: 'min', sample: true };
}

function getStore(eventId: string): Store | null {
  const existing = stores.get(eventId);
  if (existing) return existing;

  const bundle = buildSampleBundle(eventId);
  if (!bundle) return null;

  const store: Store = { state: bundle.state, frames: bundle.frames, orders: bundle.orders, reports: [] };
  recompute(store);
  stores.set(eventId, store);
  return store;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Real console route first; sample data (marked `sample: true`) only if that route fails. */
async function fetchConsoleState(eventId: string): Promise<ConsoleState | null> {
  try {
    const res = await fetch(`/api/events/${eventId}/console`);
    if (!res.ok) return null;
    return (await res.json()) as ConsoleState;
  } catch {
    return null;
  }
}

export async function getConsoleState(eventId: string): Promise<ConsoleState | null> {
  const real = await fetchConsoleState(eventId);
  if (real) return real;
  const store = getStore(eventId);
  return store ? clone(store.state) : null;
}

export async function getFrames(eventId: string): Promise<ZoneFrame[]> {
  const store = getStore(eventId);
  return store ? clone(store.frames) : [];
}

/** Orders sent per service so far (screen 5) — grows as publishPlan() sends new ones. */
export async function getOrders(eventId: string): Promise<OrderView[]> {
  const store = getStore(eventId);
  return store ? clone(store.orders) : [];
}

async function postConsoleAction(eventId: string, body: Record<string, unknown>): Promise<SubmitResult | null> {
  try {
    const res = await fetch(`/api/events/${eventId}/console`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const payload = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) return { ok: false, error: (payload as { error?: string })?.error ?? 'request failed' };
    return { ok: true };
  } catch {
    return null; // route unreachable — caller falls back to the sample store
  }
}

export async function approveAction(eventId: string, actionId: string): Promise<SubmitResult> {
  const real = await postConsoleAction(eventId, { action: 'approve', actionId });
  if (real) return real;

  const store = getStore(eventId);
  if (!store) return { ok: false, error: 'unknown event' };

  for (const service of store.state.services) {
    const action = service.actions.find((a) => a.id === actionId);
    if (action) {
      action.state = 'approved';
      service.statusColor = deescalate(service.statusColor);
      recompute(store);
      return { ok: true };
    }
  }
  return { ok: false, error: 'unknown action' };
}

export async function skipAction(eventId: string, actionId: string): Promise<SubmitResult> {
  const real = await postConsoleAction(eventId, { action: 'skip', actionId });
  if (real) return real;

  const store = getStore(eventId);
  if (!store) return { ok: false, error: 'unknown event' };

  for (const service of store.state.services) {
    const action = service.actions.find((a) => a.id === actionId);
    if (action) {
      action.state = 'skipped';
      recompute(store);
      return { ok: true };
    }
  }
  return { ok: false, error: 'unknown action' };
}

export async function publishPlan(eventId: string): Promise<SubmitResult> {
  const real = await postConsoleAction(eventId, { action: 'publish' });
  if (real) return real;

  const store = getStore(eventId);
  if (!store) return { ok: false, error: 'unknown event' };
  if (!store.state.canPublish) return { ok: false, error: 'nothing approved yet' };

  for (const service of store.state.services) {
    for (const action of service.actions) {
      if (action.state === 'approved') {
        store.orders.push({
          id: `order_${action.id}`,
          serviceLabel: service.label,
          text: action.title,
          status: 'sent',
          sample: true,
        });
      }
    }
  }

  store.state.published = true;
  recompute(store);
  return { ok: true };
}

export async function submitReport(eventId: string, report: GroundReportSubmission): Promise<SubmitResult> {
  const store = getStore(eventId);
  if (!store) return { ok: false, error: 'unknown event' };

  store.reports.push(report);
  return { ok: true };
}
