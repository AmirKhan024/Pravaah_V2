import { ARRIVAL_ASSUMPTIONS } from '../../../config/arrivalAssumptions';
import type { CrowdGroup, Event, Registration, TravelMode, Venue } from '../../../contract/schemas';
import { deriveArrival, derivePath, findMatchingTransportOption } from '../scenario/arrivalRules';

export interface UnroutedByMode {
  mode: TravelMode;
  size: number;
  reason: string;
}

export interface BuildGroupsResult {
  groups: CrowdGroup[];
  unroutedTotal: number;
  unroutedByMode: UnroutedByMode[];
}

interface Bucket {
  key: string;
  originArea: string;
  travelMode: TravelMode;
  hotelId: string | null;
  gateHint: string | null;
  registrations: Registration[];
}

/** A routed bucket, before the small-group merge pass. */
interface Candidate {
  size: number;
  mean: number;
  std: number;
  travelMode: TravelMode;
  gateId: string;
  path: string[];
  alt?: string[];
  label: string;
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

function toCrowdGroup(id: string, c: Pick<Candidate, 'size' | 'mean' | 'std' | 'path' | 'alt' | 'label'>): CrowdGroup {
  const A = ARRIVAL_ASSUMPTIONS;
  return {
    id,
    label: c.label,
    size: c.size,
    mean: c.mean,
    std: c.std,
    ps: A.defaultNudgeAcceptance,
    lang: A.defaultLang,
    path: c.path,
    ...(c.alt ? { alt: c.alt } : {}),
  };
}

/**
 * Pure and deterministic — no LLM, no network, no randomness. Same (registrations, event, venue)
 * always produces the same result. Groups by origin area + mode + hotel + gate hint; mean/std/
 * path come from lib/server/scenario/arrivalRules.ts, the same functions Step 2's
 * toEngineScenario() will call — never a number invented here.
 *
 * After the initial grouping, any group below config's minGroupSize is folded into an
 * "Other <mode> to <gate>" group, keyed by (mode, gate, arrival window) so a merge never blends
 * arrivals that are actually far apart in time. Total people is preserved exactly — merging only
 * changes how many lines the result has, never who's counted.
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

  const candidates: Candidate[] = [];
  const unroutedByModeMap = new Map<string, UnroutedByMode>(); // key: mode + '||' + reason

  const addUnrouted = (mode: TravelMode, size: number, reason: string) => {
    const key = `${mode}||${reason}`;
    const existing = unroutedByModeMap.get(key);
    if (existing) existing.size += size;
    else unroutedByModeMap.set(key, { mode, size, reason });
  };

  for (const b of buckets.values()) {
    const size = b.registrations.reduce((sum, r) => sum + r.normalized.groupSize, 0);

    const option = findMatchingTransportOption(b.travelMode, event);
    if (!option) {
      addUnrouted(b.travelMode, size, `no transport option for travel mode "${b.travelMode}"`);
      continue;
    }
    const path = derivePath({ option, venue, gateHint: b.gateHint });
    if (!path) {
      addUnrouted(b.travelMode, size, `transport point "${option.transportPointId}" is not linked to any venue entrance`);
      continue;
    }
    const { mean, std } = deriveArrival({ option, venue, event });
    const hotelName = b.hotelId ? (event.hotels.find((h) => h.id === b.hotelId)?.name ?? b.hotelId) : null;

    candidates.push({
      size,
      mean,
      std,
      travelMode: b.travelMode,
      gateId: path.gateId,
      path: path.path,
      alt: path.alt,
      label: `${labelForMode(b.travelMode)} from ${b.originArea}${hotelName ? ' (' + hotelName + ')' : ''}`,
    });
  }

  const A = ARRIVAL_ASSUMPTIONS;
  const big = candidates.filter((c) => c.size >= A.minGroupSize);
  const small = candidates.filter((c) => c.size < A.minGroupSize);

  const merged = new Map<string, { travelMode: TravelMode; gateId: string; members: Candidate[] }>();
  for (const c of small) {
    const windowIndex = Math.floor(c.mean / A.mergeWindowMin);
    const key = `${c.travelMode}||${c.gateId}||${windowIndex}`;
    let m = merged.get(key);
    if (!m) {
      m = { travelMode: c.travelMode, gateId: c.gateId, members: [] };
      merged.set(key, m);
    }
    m.members.push(c);
  }

  const gateName = (gateId: string) => venue.gates.find((g) => g.id === gateId)?.name ?? gateId;

  const groups: CrowdGroup[] = [
    ...big.map((c, i) => toCrowdGroup(`grp_${i}_${slug(c.label)}`, c)),
    ...[...merged.values()].map((cluster, i) => {
      const size = cluster.members.reduce((s, m) => s + m.size, 0);
      const mean = cluster.members.reduce((s, m) => s + m.mean * m.size, 0) / size;
      // pooled variance across the merged subgroups: average of each member's own variance plus
      // its mean's own squared distance from the combined mean, weighted by size
      const variance = cluster.members.reduce((s, m) => s + m.size * (m.std ** 2 + (m.mean - mean) ** 2), 0) / size;
      const std = Math.max(Math.sqrt(variance), A.minStdMin);
      // representative path: the largest contributing member's, so the "Other" group still
      // points somewhere real rather than an arbitrary first entry
      const representative = [...cluster.members].sort((a, b) => b.size - a.size)[0];
      return toCrowdGroup(`grp_other_${i}_${slug(cluster.travelMode + '_' + cluster.gateId)}`, {
        size,
        mean,
        std,
        path: representative.path,
        alt: representative.alt,
        label: `Other ${labelForMode(cluster.travelMode).replace(' arrivals', '').toLowerCase()} to ${gateName(cluster.gateId)}`,
      });
    }),
  ];

  const unroutedByMode = [...unroutedByModeMap.values()];
  return { groups, unroutedTotal: unroutedByMode.reduce((s, u) => s + u.size, 0), unroutedByMode };
}
