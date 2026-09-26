import { z } from 'zod';
import { TRAVEL_MODE_VALUE_SYNONYMS } from '../../../config/registrationSynonyms';
import { RegistrationNormalizedSchema, type Event, type Registration } from '../../../contract/schemas';
import { callJson } from '../llm/groq';
import type { ColumnMapping } from './mapColumns';

export interface DroppedRow {
  row: Record<string, string>;
  reason: string;
}

export interface ValueMappings {
  travelMode: Record<string, string>;
  area: Record<string, string>;
  hotel: Record<string, string | null>;
}

export interface NormalizeResult {
  registrations: Registration[];
  dropped: DroppedRow[];
  /** every raw -> standard value mapping actually used, for the head's "assumed mappings" review */
  valueMappings: ValueMappings;
}

const TRAVEL_MODES = ['train', 'metro', 'bus', 'car', 'walk', 'other'] as const;

function headerFor(mapping: ColumnMapping, field: string): string | undefined {
  return Object.keys(mapping).find((h) => mapping[h] === field);
}

function uniqueValues(rows: Array<Record<string, string>>, header: string | undefined): string[] {
  if (!header) return [];
  const set = new Set<string>();
  for (const r of rows) {
    const v = (r[header] ?? '').trim();
    if (v) set.add(v);
  }
  return [...set];
}

function fallbackTravelModeMap(values: string[]): Record<string, (typeof TRAVEL_MODES)[number]> {
  const map: Record<string, (typeof TRAVEL_MODES)[number]> = {};
  for (const v of values) {
    const low = v.toLowerCase();
    const hit = TRAVEL_MODE_VALUE_SYNONYMS.find((s) => low.includes(s.pattern));
    map[v] = hit ? hit.standard : 'other';
  }
  return map;
}

/** Sends only the unique raw travel-mode values (never every row) to the LLM. */
async function buildTravelModeMap(values: string[]): Promise<Record<string, string>> {
  if (!values.length) return {};
  const fallback = fallbackTravelModeMap(values);
  const prompt = [
    `Map each travel-mode value to exactly one of: ${TRAVEL_MODES.join(', ')}.`,
    'Reply with ONLY a JSON object: {"<raw value>": "<standard mode>"} for every value given.',
    `Values: ${JSON.stringify(values)}`,
  ].join('\n');
  return callJson(prompt, z.record(z.string(), z.enum(TRAVEL_MODES)), fallback);
}

function fallbackCleanArea(v: string): string {
  return v
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Sends only the unique raw area-name values (never every row) to the LLM. */
async function buildAreaMap(values: string[]): Promise<Record<string, string>> {
  if (!values.length) return {};
  const fallback = Object.fromEntries(values.map((v) => [v, fallbackCleanArea(v)]));
  const prompt = [
    'Clean up each place-name value: fix casing and obvious typos, trim whitespace, but never change which place it refers to.',
    'Reply with ONLY a JSON object: {"<raw value>": "<cleaned value>"} for every value given.',
    `Values: ${JSON.stringify(values)}`,
  ].join('\n');
  return callJson(prompt, z.record(z.string(), z.string().min(1)), fallback);
}

const NO_HOTEL_VALUES = new Set(['n/a', 'na', 'none', '-', 'nil']);

/** Sends only the unique raw hotel-name values (never every row) plus the event's known hotel
 * names — never a full guest list — to the LLM. */
async function buildHotelMap(values: string[], event: Event): Promise<Record<string, string | null>> {
  if (!values.length) return {};
  const validNames = event.hotels.map((h) => h.name);
  const fallback: Record<string, string | null> = {};
  for (const v of values) {
    const low = v.trim().toLowerCase();
    if (!low || NO_HOTEL_VALUES.has(low)) {
      fallback[v] = null;
      continue;
    }
    fallback[v] = validNames.find((n) => n.toLowerCase() === low || low.includes(n.toLowerCase()) || n.toLowerCase().includes(low)) ?? null;
  }
  if (!validNames.length) return fallback;

  const prompt = [
    `Map each raw hotel-name value to exactly one of these known hotel names, or null if none plausibly match: ${JSON.stringify(validNames)}.`,
    'Reply with ONLY a JSON object: {"<raw value>": "<known hotel name>" | null} for every value given.',
    `Values: ${JSON.stringify(values)}`,
  ].join('\n');
  return callJson(prompt, z.record(z.string(), z.string().nullable()), fallback);
}

/**
 * Applies column mapping + value mapping to every row in code — the LLM only ever saw unique
 * values, never the full file. Rows whose required fields can't be determined are dropped and
 * counted with a reason; everything else is kept, even if travelMode ends up "other" (that
 * becomes an honest "unrouted" bucket downstream in buildGroups.ts, not a silent guess).
 */
export async function normalizeRegistrations(rawRows: Array<Record<string, string>>, mapping: ColumnMapping, event: Event): Promise<NormalizeResult> {
  const originAreaHeader = headerFor(mapping, 'originArea');
  const travelModeHeader = headerFor(mapping, 'travelMode');
  const hotelNameHeader = headerFor(mapping, 'hotelName');
  const groupSizeHeader = headerFor(mapping, 'groupSize');
  const gateHintHeader = headerFor(mapping, 'gateHint');

  const [travelModeMap, areaMap, hotelMap] = await Promise.all([
    buildTravelModeMap(uniqueValues(rawRows, travelModeHeader)),
    buildAreaMap(uniqueValues(rawRows, originAreaHeader)),
    buildHotelMap(uniqueValues(rawRows, hotelNameHeader), event),
  ]);
  const hotelIdByName = new Map(event.hotels.map((h) => [h.name, h.id]));

  const registrations: Registration[] = [];
  const dropped: DroppedRow[] = [];

  rawRows.forEach((row, i) => {
    const rawArea = originAreaHeader ? (row[originAreaHeader] ?? '').trim() : '';
    const rawMode = travelModeHeader ? (row[travelModeHeader] ?? '').trim() : '';
    const rawHotel = hotelNameHeader ? (row[hotelNameHeader] ?? '').trim() : '';
    const rawGroupSize = groupSizeHeader ? (row[groupSizeHeader] ?? '').trim() : '';
    const rawGateHint = gateHintHeader ? (row[gateHintHeader] ?? '').trim() : '';

    const originArea = rawArea ? (areaMap[rawArea] ?? rawArea) : '';
    if (!originArea) {
      dropped.push({ row, reason: 'missing origin area (no column mapped to it, or the value was blank)' });
      return;
    }

    const travelMode = rawMode ? (travelModeMap[rawMode] ?? 'other') : 'other';
    const hotelName = rawHotel ? (hotelMap[rawHotel] ?? null) : null;
    const hotelId = hotelName ? (hotelIdByName.get(hotelName) ?? null) : null;
    const parsedGroupSize = parseInt(rawGroupSize, 10);
    // blank/unparseable group size defaults to 1 (most registration rows are a single person) —
    // this is a default, not a fix, so it never counts as a drop
    const groupSize = Number.isFinite(parsedGroupSize) && parsedGroupSize > 0 ? parsedGroupSize : 1;
    const gateHint = rawGateHint || null;

    const check = RegistrationNormalizedSchema.safeParse({ originArea, travelMode, hotelId, groupSize, gateHint });
    if (!check.success) {
      dropped.push({ row, reason: check.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join('; ') });
      return;
    }

    registrations.push({ id: `${event.id}_reg_${i + 1}`, eventId: event.id, raw: row, normalized: check.data, groupId: null });
  });

  return { registrations, dropped, valueMappings: { travelMode: travelModeMap, area: areaMap, hotel: hotelMap } };
}
