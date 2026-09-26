import type { Lang, TravelMode, VisitorPlan } from '@/contract/schemas';
import samplePlan from '@/contract/samples/visitor-plan.json';

export interface VisitorInput {
  eventId: string;
  originArea: string;
  travelMode: TravelMode;
  stayingAt?: string | null;
  groupSize: number;
  lang?: Lang;
}

const FALLBACK_PLAN: VisitorPlan = {
  id: samplePlan.id,
  eventId: samplePlan.eventId,
  registrationId: samplePlan.registrationId,
  stay: samplePlan.stay,
  travel: { mode: samplePlan.travel.mode as VisitorPlan['travel']['mode'], departTime: samplePlan.travel.departTime },
  gate: samplePlan.gate,
  leaveTime: samplePlan.leaveTime,
  food: samplePlan.food,
  language: samplePlan.language as VisitorPlan['language'],
  version: samplePlan.version,
};

let currentPlan: VisitorPlan = FALLBACK_PLAN;
const subscribers: Set<(plan: VisitorPlan) => void> = new Set();

/** Real /api/visitor-plan first; the labeled sample plan only if that route fails (no event given,
 * network error, or no matching crowd group yet). */
export async function getVisitorPlan(input: VisitorInput): Promise<VisitorPlan> {
  try {
    const params = new URLSearchParams({ event: input.eventId, mode: input.travelMode, lang: input.lang ?? 'en' });
    if (input.stayingAt) params.set('hotel', input.stayingAt);
    const res = await fetch(`/api/visitor-plan?${params.toString()}`);
    if (res.ok) {
      currentPlan = await res.json();
      return currentPlan;
    }
  } catch {
    // fall through to the sample plan below
  }
  currentPlan = FALLBACK_PLAN;
  return currentPlan;
}

/** Simulated update, sample data only — no live poll of the real endpoint yet (a later step). */
let timerStarted = false;
function startSimulationTimer() {
  if (timerStarted) return;
  timerStarted = true;
  setTimeout(() => {
    const updated = { ...currentPlan, version: currentPlan.version + 1, travel: { ...currentPlan.travel, departTime: '17:25' }, leaveTime: '18:55' };
    currentPlan = updated;
    subscribers.forEach((cb) => cb(updated));
  }, 20000);
}

export function subscribeToPlanUpdates(cb: (plan: VisitorPlan) => void): () => void {
  subscribers.add(cb);
  startSimulationTimer();
  return () => subscribers.delete(cb);
}
