import { VISITOR_LOCATION_MIN_ZONE_COUNT } from '../../../config/server-extras';
import { getServiceRoleClient } from '../supabase/client';

export interface ZoneCount {
  zoneId: string;
  count: number;
}

/** Strips anything but a zone id — a visitor_location report never persists coordinates, even if
 * the client sent them. Storing only a zone id is what makes the aggregate-count approach safe. */
export function sanitizeVisitorLocationPayload(payload: Record<string, unknown>): { zoneId: string } | null {
  const zoneId = payload.zoneId;
  return typeof zoneId === 'string' && zoneId ? { zoneId } : null;
}

export async function countRecentZoneReports(eventId: string, zoneId: string, sinceIso: string): Promise<number> {
  const supabase = getServiceRoleClient();
  const { count, error } = await supabase
    .from('live_reports')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('source', 'visitor_location')
    .eq('payload->>zoneId', zoneId)
    .gte('time', sinceIso);
  if (error) throw error;
  return count ?? 0;
}

/** A zone is only ever reported once at least k people are in it — below k, a single visitor's
 * presence would be identifiable, which opt-in location sharing must never allow. */
export function revealIfAboveThreshold(zoneId: string, count: number, k = VISITOR_LOCATION_MIN_ZONE_COUNT): ZoneCount | null {
  return count >= k ? { zoneId, count } : null;
}
