import type { CapPatch } from '../../../engine/types';

/**
 * What one live report implies for the next simulation run. Reuses engine's own CapPatch verbatim
 * (see engine/types.ts SimOptions.patch) for the capacity side; `sizeMultiplier` covers what a
 * capMult alone can't express ("more people" / "fewer people" aren't a link capacity change).
 * Never contains a raw LLM number — every value here comes from config/server-extras.ts's
 * STAFF_REPORT_CLAMP table, only ever selected (never invented) by the LLM/chip.
 */
export interface ScenarioPatch {
  capPatch: CapPatch;
  /** assumption: clamped crowd-size multiplier this report implies, 1 = no change */
  sizeMultiplier: number;
  note: string;
}

export function emptyScenarioPatch(fromTick: number, note: string): ScenarioPatch {
  return { capPatch: { capMult: {}, fromTick }, sizeMultiplier: 1, note };
}
