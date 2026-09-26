import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callJson } from '../llm/groq';
import { fillTemplate, translateTemplate } from './wording';

vi.mock('../llm/groq', () => ({ callJson: vi.fn() }));
const mockedCallJson = vi.mocked(callJson);

describe('translateTemplate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the English template directly, without calling the LLM', async () => {
    const text = await translateTemplate('gate', 'en');
    expect(text).toBe('Use {GATE}');
    expect(mockedCallJson).not.toHaveBeenCalled();
  });

  it('uses a valid LLM translation that keeps the placeholder intact', async () => {
    mockedCallJson.mockResolvedValue({ text: '{GATE} वापरा' });
    const text = await translateTemplate('gate', 'mr');
    expect(text).toBe('{GATE} वापरा');
  });

  it('rejects an LLM translation containing a raw digit, falling back to the template', async () => {
    mockedCallJson.mockResolvedValue({ text: '{GATE} 1 वापरा' });
    const text = await translateTemplate('gate', 'mr');
    expect(text).toBe('{GATE} वापरा'); // config/server-extras.ts's static row
  });

  it('rejects an LLM translation that drops the placeholder, falling back to the template', async () => {
    mockedCallJson.mockResolvedValue({ text: 'गेट वापरा' });
    const text = await translateTemplate('gate', 'mr');
    expect(text).toBe('{GATE} वापरा');
  });
});

describe('fillTemplate', () => {
  it('substitutes every placeholder with its real value', () => {
    expect(fillTemplate('Use {GATE}', { GATE: 'Gate A' })).toBe('Use Gate A');
  });

  it('leaves an unmatched placeholder untouched rather than guessing', () => {
    expect(fillTemplate('Use {GATE}', {})).toBe('Use {GATE}');
  });
});
