import type { ConsoleState, OrderView, ZoneFrame } from '../types';
import { CALM_EVENT_ID, calmConsoleState, calmFrames, calmOrders } from './calm';
import { PROCESSION_EVENT_ID, processionConsoleState, processionFrames, processionOrders } from './procession';
import { STADIUM_EVENT_ID, stadiumConsoleState, stadiumFrames, stadiumOrders } from './stadium';

export type SampleBundle = {
  state: ConsoleState;
  frames: ZoneFrame[];
  orders: OrderView[];
};

const BUILDERS: Record<string, () => SampleBundle> = {
  [STADIUM_EVENT_ID]: () => ({ state: stadiumConsoleState(), frames: stadiumFrames(), orders: stadiumOrders() }),
  [PROCESSION_EVENT_ID]: () => ({ state: processionConsoleState(), frames: processionFrames(), orders: processionOrders() }),
  [CALM_EVENT_ID]: () => ({ state: calmConsoleState(), frames: calmFrames(), orders: calmOrders() }),
};

/** The event id the console falls back to when none is given in the URL. */
export const DEFAULT_EVENT_ID = STADIUM_EVENT_ID;

export function buildSampleBundle(eventId: string): SampleBundle | null {
  const build = BUILDERS[eventId] ?? BUILDERS[DEFAULT_EVENT_ID];
  return build ? build() : null;
}

export { CALM_EVENT_ID, PROCESSION_EVENT_ID, STADIUM_EVENT_ID };
