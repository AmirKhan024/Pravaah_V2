export type StandardRegistrationField = 'originArea' | 'travelMode' | 'hotelName' | 'groupSize' | 'gateHint';

/**
 * Fallback column-header -> standard-field synonym list, used only when the LLM call in
 * mapColumns.ts fails (network error, invalid JSON, or a mapping that doesn't validate). Matched
 * by substring against the trimmed, lowercased header. Not exhaustive by design — the LLM handles
 * headers this list has never seen; this is only the safety net.
 */
export const COLUMN_FIELD_SYNONYMS: Record<StandardRegistrationField, string[]> = {
  originArea: ['origin city', 'origin area', 'area', 'city', 'from', 'origin'],
  travelMode: ['mode of travel', 'travel mode', 'transport', 'mode'],
  hotelName: ['hotel name', 'hotel'],
  groupSize: ['group size', 'party size', 'pax', 'no of people', 'number of people'],
  gateHint: ['gate pref', 'gate preference', 'preferred gate', 'gate'],
};

/**
 * Fallback travel-mode value synonym list, used only when the LLM call in normalize.ts fails.
 * Matched by substring against the lowercased raw value, first match wins.
 */
export const TRAVEL_MODE_VALUE_SYNONYMS: Array<{ pattern: string; standard: 'train' | 'metro' | 'bus' | 'car' | 'walk' | 'other' }> = [
  { pattern: 'metro', standard: 'metro' },
  { pattern: 'train', standard: 'train' },
  { pattern: 'rail', standard: 'train' },
  { pattern: 'bus', standard: 'bus' },
  { pattern: 'cab', standard: 'car' },
  { pattern: 'taxi', standard: 'car' },
  { pattern: 'car', standard: 'car' },
  { pattern: 'drive', standard: 'car' },
  { pattern: 'self', standard: 'car' },
  { pattern: 'walk', standard: 'walk' },
];
