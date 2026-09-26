import { describe, expect, it } from 'vitest';
import { checkDrift } from './gateScanDrift';

describe('checkDrift', () => {
  it('reports no drift when there is no baseline yet', () => {
    expect(checkDrift(500, null)).toEqual({ drift: false, expected: null, reason: 'no baseline simulation result for this gate yet' });
  });

  it('flags drift when observed is far above expected', () => {
    const result = checkDrift(800, 500, 0.2);
    expect(result.drift).toBe(true);
  });

  it('does not flag drift within the threshold', () => {
    const result = checkDrift(540, 500, 0.2);
    expect(result.drift).toBe(false);
  });

  it('does not flag drift when baseline is zero', () => {
    expect(checkDrift(10, 0).drift).toBe(false);
  });
});
