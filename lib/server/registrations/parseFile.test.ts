import { describe, expect, it } from 'vitest';
import { parseRegistrationFile } from './parseFile';

describe('parseRegistrationFile', () => {
  it('parses a CSV file into headers + string rows', async () => {
    const csv = 'Origin City,Mode\nKharghar,Metro\nPanvel,Train\n';
    const file = new File([csv], 'regs.csv', { type: 'text/csv' });
    const { headers, rows } = await parseRegistrationFile(file);
    expect(headers).toEqual(['Origin City', 'Mode']);
    expect(rows).toEqual([
      { 'Origin City': 'Kharghar', Mode: 'Metro' },
      { 'Origin City': 'Panvel', Mode: 'Train' },
    ]);
  });

  it('gives a clear "Save as CSV" error for an Excel upload instead of trying to parse it', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'regs.xlsx', { type: 'application/vnd.openxmlformats' });
    await expect(parseRegistrationFile(file)).rejects.toThrow('Save as CSV');
  });

  it('rejects an unsupported extension with a clear message', async () => {
    const file = new File(['x'], 'regs.txt', { type: 'text/plain' });
    await expect(parseRegistrationFile(file)).rejects.toThrow(/expected \.csv/);
  });

  it('rejects a file over the size cap', async () => {
    const big = new File([new Uint8Array(6 * 1024 * 1024)], 'regs.csv', { type: 'text/csv' });
    await expect(parseRegistrationFile(big)).rejects.toThrow(/limit/);
  });
});
