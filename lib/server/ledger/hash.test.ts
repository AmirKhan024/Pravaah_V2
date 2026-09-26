import { describe, expect, it } from 'vitest';
import { canonicalJSON, computeHash, GENESIS_HASH } from './hash';

describe('canonicalJSON', () => {
  it('is stable regardless of key order', () => {
    const a = { b: 1, a: 2, c: { y: 1, x: 2 } };
    const b = { a: 2, c: { x: 2, y: 1 }, b: 1 };
    expect(canonicalJSON(a)).toBe(canonicalJSON(b));
  });
});

describe('computeHash', () => {
  const entry = { eventId: 'e1', seq: 1, ts: '2026-01-01T00:00:00Z', simClock: '00:00', type: 'forecast_issued', summary: 'test', payload: null };

  it('is deterministic for the same input', () => {
    expect(computeHash(GENESIS_HASH, entry)).toBe(computeHash(GENESIS_HASH, entry));
  });

  it('changes when any field changes', () => {
    expect(computeHash(GENESIS_HASH, entry)).not.toBe(computeHash(GENESIS_HASH, { ...entry, summary: 'tampered' }));
  });

  it('changes when prevHash changes', () => {
    expect(computeHash(GENESIS_HASH, entry)).not.toBe(computeHash('a'.repeat(64), entry));
  });
});
