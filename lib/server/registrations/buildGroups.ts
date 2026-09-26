import { ARRIVAL_ASSUMPTIONS } from '../../../config/arrivalAssumptions';
import type { CrowdGroup, Event, Registration, Venue } from '../../../contract/schemas';
import { deriveArrival, derivePath, findMatchingTransportOption } from '../scenario/arrivalRules';

export interface UnroutedBucket {
  key: string;
  registrationIds: string[];
  size: number;
  reason: string;
}

export interface BuildGroupsResult {
  groups: CrowdGroup[];
  unrouted: UnroutedBucket[];
}

interface Bucket {
  key: string;
  originArea: string;
  travelMode: Registration['normalized']['travelMode'];
  hotelId: string | null;
  gateHint: string | null;
  registrations: Registration[];
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'x';

function bucketKey(r: Registration): string {
  const n = r.normalized;
  return [n.originArea.trim().toLowerCase(), n.travelMode, n.hotelId ?? 'none', (n.gateHint ?? 'none').toLowerCase()].join('||');
}

function labelForMode(mode: string): string {
  switch (mode) {
    case 'train':
      return 'Train arrivals';
    case 'metro':
      return 'Metro arrivals';
    case 'bus':
      return 'Bus arrivals';
    case 'car':
      return 'Car arrivals';
    case 'walk':
      return 'Walk-in arrivals';
    default:
      return 'Arrivals';
  }
}

/**
 * Pure and deterministic — no LLM, no network, no randomness. Same (registrations, event, venue)
 * always produces the same CrowdGroup[]. Groups by origin area + mode + hotel + gate hint; mean/
 * std/path come from lib/server/scenario/arrivalRules.ts, the same functions Step 2's
 * toEngineScenario() will call — never a number invented here.
 */
export function buildGroups(registrations: Registration[], event: Event, venue: Venue): BuildGroupsResult {
  const buckets = new Map<string, Bucket>();
  for (const r of registrations) {
    const key = bucketKey(r);
    let b = buckets.get(key);
    if (!b) {
      b = { key, originArea: r.normalized.originArea, travelMode: r.normalized.travelMode, hotelId: r.normalized.hotelId, gateHint: r.normalized.gateHint, registrations: [] };
      buckets.set(key, b);
    }
    b.registrations.push(r);
  }

  const groups: CrowdGroup[] = [];
  const unrouted: UnroutedBucket[] = [];

  for (const b of buckets.values()) {
    const size = b.registrations.reduce((sum, r) => sum + r.normalized.groupSize, 0);
    const registrationIds = b.registrations.map((r) => r.id);

    const option = findMatchingTransportOption(b.travelMode, event);
    if (!option) {
      unrouted.push({ key: b.key, registrationIds, size, reason: `no transport option for travel mode "${b.travelMode}"` });
      continue;
    }

    const path = derivePath({ option, venue, gateHint: b.gateHint });
    if (!path) {
      unrouted.push({ key: b.key, registrationIds, size, reason: `transport point "${option.transportPointId}" is not linked to any venue entrance` });
      continue;
    }

    const { mean, std } = deriveArrival({ option, venue, event });
    const hotelName = b.hotelId ? (event.hotels.find((h) => h.id === b.hotelId)?.name ?? b.hotelId) : null;

    groups.push({
      id: 'grp_' + slug(b.key),
      label: `${labelForMode(b.travelMode)} from ${b.originArea}${hotelName ? ' (' + hotelName + ')' : ''}`,
      size,
      mean,
      std,
      ps: ARRIVAL_ASSUMPTIONS.defaultNudgeAcceptance,
      lang: ARRIVAL_ASSUMPTIONS.defaultLang,
      path: path.path,
      ...(path.alt ? { alt: path.alt } : {}),
    });
  }

  return { groups, unrouted };
}
