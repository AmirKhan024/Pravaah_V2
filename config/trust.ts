import type { Trust } from '../contract/schemas';

/**
 * The ONLY place a trust level turns into a number. engine/ has no concept of trust — only a
 * plain `estimated?: boolean` on Zone/Link (see engine/types.ts) — so toEngineScenario() (see
 * contract/engine-adapter.ts) is the only caller of this table: every "claimed" or "documented"
 * value gets multiplied down before it becomes a plain engine number, and every value that isn't
 * "observed" sets the engine's `estimated: true`. No other file may apply a discount of its own.
 *
 * Each number below is an assumption, not a measurement — label it "assumption" wherever it
 * surfaces in the UI.
 */
export const TRUST_CAPACITY_DISCOUNT: Record<Trust, number> = {
  claimed: 0.6, // assumption: an unverified head-count is trusted for 60% of stated capacity
  documented: 0.85, // assumption: a certificate/paperwork trail earns 85% credit
  observed: 1.0, // measured on the ground — full credit, never discounted
};

export function discountedCapacity(value: number, trust: Trust): number {
  return value * TRUST_CAPACITY_DISCOUNT[trust];
}

/** Only "observed" data is exempt from the engine's `estimated: true` flag. */
export function isEstimated(trust: Trust): boolean {
  return trust !== 'observed';
}
