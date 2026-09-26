import Papa from 'papaparse';
import * as XLSX from 'xlsx';

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

function parseExcel(buffer: ArrayBuffer): ParsedFile {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { headers, rows: toStringRows(rows) };
}

/**
 * Parses an uploaded registrations file. Known xlsx-package advisories (prototype pollution /
 * ReDoS, no fix on npm — see GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9) apply here since this
 * accepts untrusted uploads; the size cap below is the only mitigation in place so far.
 */
export async function parseRegistrationFile(file: File): Promise<ParsedFile> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`file is ${file.size} bytes, over the ${MAX_UPLOAD_BYTES}-byte limit`);
  }
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) return parseCsv(await file.text());
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return parseExcel(await file.arrayBuffer());
  throw new Error(`unsupported file type: "${file.name}" (expected .csv, .xlsx or .xls)`);
}
