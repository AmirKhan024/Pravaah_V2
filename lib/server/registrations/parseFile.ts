import Papa from 'papaparse';

export interface ParsedFile {
  headers: string[];
  rows: Array<Record<string, string>>;
}

/** A registration file this size is already tens of thousands of rows — reject anything past it
 * rather than let an oversized upload (accidental or malicious) tie up the process. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function toStringRows(rows: Array<Record<string, unknown>>): Array<Record<string, string>> {
  return rows.map((row) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) out[k] = v == null ? '' : String(v);
    return out;
  });
}

function parseCsv(text: string): ParsedFile {
  const result = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
  return { headers: result.meta.fields ?? [], rows: toStringRows(result.data) };
}

/** Parses an uploaded registrations file. CSV only — Excel support was dropped along with the
 * `xlsx` package (a high-severity, no-fix-on-npm advisory: prototype pollution / ReDoS, relevant
 * since this accepts untrusted uploads). An .xlsx/.xls upload gets a clear, actionable error
 * instead of a silent failure. */
export async function parseRegistrationFile(file: File): Promise<ParsedFile> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`file is ${file.size} bytes, over the ${MAX_UPLOAD_BYTES}-byte limit`);
  }
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    throw new Error('Excel files are not supported. Save as CSV.');
  }
  if (!name.endsWith('.csv')) {
    throw new Error(`unsupported file type: "${file.name}" (expected .csv)`);
  }
  return parseCsv(await file.text());
}
