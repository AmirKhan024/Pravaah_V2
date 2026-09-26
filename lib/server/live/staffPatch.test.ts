import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STAFF_REPORT_CLAMP } from '../../../config/server-extras';
import { callJson } from '../llm/groq';
import { buildStaffPatch, classifyStaffText } from './staffPatch';

vi.mock('../llm/groq', () => ({ callJson: vi.fn() }));
const mockedCallJson = vi.mocked(callJson);

describe('buildStaffPatch', () => {
  it('returns an empty, no-rerun patch for no chips', () => {
    const patch = buildStaffPatch([], 10);
    expect(patch.capPatch.capMult).toEqual({});
    expect(patch.sizeMultiplier).toBe(1);
  });

  it('clamps capMult within the configured bounds even for the most severe chip combo', () => {
    const patch = buildStaffPatch(['rain', 'gates_late', 'slow_lanes'], 10);
    for (const mult of Object.values(patch.capPatch.capMult)) {
      expect(mult).toBeGreaterThanOrEqual(STAFF_REPORT_CLAMP.capMultMin);
      expect(mult).toBeLessThanOrEqual(STAFF_REPORT_CLAMP.capMultMax);
    }
  });

  it('clamps the size multiplier for more_people/fewer_people', () => {
    const more = buildStaffPatch(['more_people'], 0);
    const fewer = buildStaffPatch(['fewer_people'], 0);
    expect(more.sizeMultiplier).toBeLessThanOrEqual(STAFF_REPORT_CLAMP.maxSizeMultiplier);
    expect(fewer.sizeMultiplier).toBeGreaterThanOrEqual(1 / STAFF_REPORT_CLAMP.maxSizeMultiplier);
  });

  it('deduplicates repeated chips', () => {
    const a = buildStaffPatch(['rain'], 0);
    const b = buildStaffPatch(['rain', 'rain'], 0);
    expect(a).toEqual(b);
  });
});

describe('classifyStaffText', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the LLM classification when it succeeds', async () => {
    mockedCallJson.mockResolvedValue({ chips: ['rain'] });
    const chips = await classifyStaffText('it is pouring outside');
    expect(chips).toEqual(['rain']);
  });

  it('falls back to keyword matching when the LLM fails', async () => {
    mockedCallJson.mockImplementation(async (_prompt, _schema, fallback) => fallback);
    const chips = await classifyStaffText('the train is delayed and gates are late');
    expect(chips).toContain('rail_delay');
    expect(chips).toContain('gates_late');
  });
});
