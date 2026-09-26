import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  EventSchema,
  LedgerEntrySchema,
  LiveReportSchema,
  PlanSchema,
  RegistrationSchema,
  VenueDocumentSchema,
  VenueSchema,
  VisitorPlanSchema,
} from './schemas';

const samplesDir = path.join(import.meta.dirname, 'samples');
const readJSON = (name: string) => JSON.parse(readFileSync(path.join(samplesDir, name), 'utf8'));

/** Splits on plain commas — every fixture row is generated without embedded commas, so this needs
 * no quoting/escaping logic. */
function parseCSV(text: string): { header: string[]; rows: string[][] } {
  const lines = text.trim().split('\n');
  const header = lines[0].split(',');
  const rows = lines.slice(1).map((line) => line.split(','));
  return { header, rows };
}

describe('contract samples validate against their schemas', () => {
  it('venue-stadium.json is a valid Venue', () => {
    expect(() => VenueSchema.parse(readJSON('venue-stadium.json'))).not.toThrow();
  });

  it('venue-procession.json is a valid Venue', () => {
    expect(() => VenueSchema.parse(readJSON('venue-procession.json'))).not.toThrow();
  });

  it('venue-document.json is a valid VenueDocument', () => {
    expect(() => VenueDocumentSchema.parse(readJSON('venue-document.json'))).not.toThrow();
  });

  it('event-stadium.json is a valid Event', () => {
    expect(() => EventSchema.parse(readJSON('event-stadium.json'))).not.toThrow();
  });

  it('event-procession.json is a valid Event', () => {
    expect(() => EventSchema.parse(readJSON('event-procession.json'))).not.toThrow();
  });

  it('plan.json is a valid Plan', () => {
    expect(() => PlanSchema.parse(readJSON('plan.json'))).not.toThrow();
  });

  it('visitor-plan.json is a valid VisitorPlan', () => {
    expect(() => VisitorPlanSchema.parse(readJSON('visitor-plan.json'))).not.toThrow();
  });

  it('live-report.json is a valid LiveReport', () => {
    expect(() => LiveReportSchema.parse(readJSON('live-report.json'))).not.toThrow();
  });

  it('ledger-entry.json is a valid LedgerEntry', () => {
    expect(() => LedgerEntrySchema.parse(readJSON('ledger-entry.json'))).not.toThrow();
  });

  describe('registrations-stadium-small.csv (the fast, exact-count fixture)', () => {
    const { header, rows } = parseCSV(readFileSync(path.join(samplesDir, 'registrations-stadium-small.csv'), 'utf8'));

    it('has the expected messy header and ~200 rows', () => {
      expect(header).toEqual(['Full Name', 'Phone', 'Origin City', 'Mode of Travel', 'Hotel Name', 'Group Size', 'Gate Pref', 'Notes']);
      expect(rows.length).toBe(200);
    });

    it('has at least one blank cell somewhere (messy on purpose)', () => {
      expect(rows.some((r) => r.some((cell) => cell === ''))).toBe(true);
    });

    it('each row parses as a Registration.raw record', () => {
      for (const row of rows) {
        const raw = Object.fromEntries(header.map((h, i) => [h, row[i] ?? '']));
        expect(() => RegistrationSchema.shape.raw.parse(raw)).not.toThrow();
      }
    });
  });

  describe('registrations-procession-small.csv (the fast, exact-count fixture)', () => {
    const { header, rows } = parseCSV(readFileSync(path.join(samplesDir, 'registrations-procession-small.csv'), 'utf8'));

    it('has its own, differently-shaped messy header and ~200 rows', () => {
      expect(header).toEqual(['name', 'mobile', 'area', 'transport', 'group size', 'notes']);
      expect(rows.length).toBe(200);
    });

    it('has at least one blank cell somewhere (messy on purpose)', () => {
      expect(rows.some((r) => r.some((cell) => cell === ''))).toBe(true);
    });

    it('each row parses as a Registration.raw record', () => {
      for (const row of rows) {
        const raw = Object.fromEntries(header.map((h, i) => [h, row[i] ?? '']));
        expect(() => RegistrationSchema.shape.raw.parse(raw)).not.toThrow();
      }
    });
  });

  describe('registrations-stadium.csv (the large, ~20k-row fixture)', () => {
    const { header, rows } = parseCSV(readFileSync(path.join(samplesDir, 'registrations-stadium.csv'), 'utf8'));

    it('is generated at the requested scale', () => {
      expect(header).toEqual(['Full Name', 'Phone', 'Origin City', 'Mode of Travel', 'Hotel Name', 'Group Size', 'Gate Pref', 'Notes']);
      expect(rows.length).toBeGreaterThanOrEqual(19000);
      expect(rows.length).toBeLessThanOrEqual(21000);
    });

    it('has at least one blank cell somewhere (messy on purpose)', () => {
      expect(rows.some((r) => r.some((cell) => cell === ''))).toBe(true);
    });
  });

  describe('registrations-procession.csv (the large, ~10k-row fixture)', () => {
    const { header, rows } = parseCSV(readFileSync(path.join(samplesDir, 'registrations-procession.csv'), 'utf8'));

    it('is generated at the requested scale', () => {
      expect(header).toEqual(['name', 'mobile', 'area', 'transport', 'group size', 'notes']);
      expect(rows.length).toBeGreaterThanOrEqual(9500);
      expect(rows.length).toBeLessThanOrEqual(10500);
    });

    it('has at least one blank cell somewhere (messy on purpose)', () => {
      expect(rows.some((r) => r.some((cell) => cell === ''))).toBe(true);
    });
  });
});
