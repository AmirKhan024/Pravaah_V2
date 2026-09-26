import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callJson } from '../llm/groq';
import { mapColumns } from './mapColumns';

vi.mock('../llm/groq', () => ({ callJson: vi.fn() }));
const mockedCallJson = vi.mocked(callJson);

describe('mapColumns', () => {
  beforeEach(() => vi.clearAllMocks());

  const headers = ['Full Name', 'Phone', 'Origin City', 'Mode of Travel', 'Hotel Name', 'Group Size', 'Gate Pref', 'Notes'];
  const sampleRows = [{ 'Full Name': 'Rahul Sharma', Phone: '9812345678', 'Origin City': 'Kharghar', 'Mode of Travel': 'Metro', 'Hotel Name': 'Kharghar Grand', 'Group Size': '2', 'Gate Pref': '', Notes: '' }];

  it('never sends PII column values to the LLM, only masked placeholders', async () => {
    mockedCallJson.mockResolvedValue({});
    await mapColumns(headers, sampleRows);
    const prompt = mockedCallJson.mock.calls[0][0];
    expect(prompt).not.toContain('Rahul Sharma');
    expect(prompt).not.toContain('9812345678');
    expect(prompt).toContain('[REDACTED]');
    expect(prompt).toContain('Kharghar'); // non-PII value still visible
  });

  it('uses the LLM mapping when it succeeds', async () => {
    mockedCallJson.mockResolvedValue({
      'Full Name': null,
      Phone: null,
      'Origin City': 'originArea',
      'Mode of Travel': 'travelMode',
      'Hotel Name': 'hotelName',
      'Group Size': 'groupSize',
      'Gate Pref': 'gateHint',
      Notes: null,
    });
    const mapping = await mapColumns(headers, sampleRows);
    expect(mapping['Origin City']).toBe('originArea');
    expect(mapping['Mode of Travel']).toBe('travelMode');
    expect(mapping['Full Name']).toBeNull();
  });

  it('falls back to the synonym list when the LLM fails (never drops a header)', async () => {
    mockedCallJson.mockImplementation(async (_prompt, _schema, fallback) => fallback);
    const mapping = await mapColumns(headers, sampleRows);
    expect(mapping['Origin City']).toBe('originArea');
    expect(mapping['Mode of Travel']).toBe('travelMode');
    expect(mapping['Hotel Name']).toBe('hotelName');
    expect(mapping['Group Size']).toBe('groupSize');
    expect(mapping['Gate Pref']).toBe('gateHint');
    expect(mapping['Full Name']).toBeNull();
    expect(mapping.Phone).toBeNull();
    expect(mapping.Notes).toBeNull();
    expect(Object.keys(mapping).sort()).toEqual([...headers].sort());
  });

  it('keeps every header in the mapping even if the LLM only returns some of them', async () => {
    mockedCallJson.mockResolvedValue({ 'Origin City': 'originArea' });
    const mapping = await mapColumns(headers, sampleRows);
    expect(Object.keys(mapping)).toEqual(expect.arrayContaining(headers));
    expect(mapping['Mode of Travel']).toBe('travelMode'); // patched from the synonym fallback
  });
});
