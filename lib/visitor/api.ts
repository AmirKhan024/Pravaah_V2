import type { VisitorPlan } from '@/contract/schemas';
import samplePlan from '@/contract/samples/visitor-plan.json';

export interface VisitorInput {
  originArea: string;
  travelMode: string;
  stayingAt?: string | null;
  groupSize: number;
}

// Memory cache for current plan state
let currentPlan: VisitorPlan = {
  id: samplePlan.id,
  eventId: samplePlan.eventId,
  registrationId: samplePlan.registrationId,
  stay: samplePlan.stay,
  travel: {
    mode: samplePlan.travel.mode as VisitorPlan['travel']['mode'],
    departTime: samplePlan.travel.departTime,
  },
  gate: samplePlan.gate,
  leaveTime: samplePlan.leaveTime,
  food: samplePlan.food,
  language: samplePlan.language as VisitorPlan['language'],
  version: samplePlan.version,
};

const subscribers: Set<(plan: VisitorPlan) => void> = new Set();
let timerStarted = false;

function startSimulationTimer() {
  if (timerStarted) return;
  timerStarted = true;

  setTimeout(() => {
    // Simulate version 2 update after 20 seconds
    currentPlan = {
      ...currentPlan,
      version: 2,
      travel: {
        ...currentPlan.travel,
        departTime: '17:25',
      },
      leaveTime: '18:55',
    };

    subscribers.forEach((cb) => cb(currentPlan));
  }, 20000);
}

export async function getVisitorPlan(_input: VisitorInput): Promise<VisitorPlan> {
  startSimulationTimer();
  return currentPlan;
}

export function subscribeToPlanUpdates(cb: (plan: VisitorPlan) => void): () => void {
  subscribers.add(cb);
  startSimulationTimer();

  return () => {
    subscribers.delete(cb);
  };
}
