import type { CrowdGroup, Event, TravelMode } from '../../../contract/schemas';

export interface VisitorQuery {
  mode?: TravelMode;
  hotel?: string;
}

/**
 * Matches a visitor's own mode/hotel against the event's CrowdGroups. Origin ("from") is
 * deliberately not used for matching — lib/server/registrations/buildGroups.ts's bucketKey never
 * put it in the group key in the first place (every origin sharing a mode produces the same
 * group), so it can't distinguish one here either.
 *
 * group.path[0] is the transportPointId the group was routed from (see
 * lib/server/scenario/arrivalRules.ts's derivePath) — that ties back to exactly one
 * EventTransportOption, and so to exactly one mode.
 */
export function matchCrowdGroup(groups: CrowdGroup[], event: Event, query: VisitorQuery): CrowdGroup | null {
  const byMode = groups.filter((g) => {
    if (!query.mode) return true;
    const option = event.transportOptions.find((o) => o.transportPointId === g.path[0]);
    return option?.mode === query.mode;
  });

  const withHotel = query.hotel ? byMode.filter((g) => g.label.toLowerCase().includes(query.hotel!.toLowerCase())) : [];
  const pool = withHotel.length > 0 ? withHotel : byMode;
  if (pool.length === 0) return null;

  // most representative pick when several groups still match: the largest one
  return [...pool].sort((a, b) => b.size - a.size)[0];
}
