import { getServiceRoleClient } from '../supabase/client';

export type EventOption = { id: string; name: string; venueName: string };

type EventRow = { id: string; name: string; venues: { name: string } | { name: string }[] | null };

/**
 * Every event with its venue's name, newest first — feeds the home page's event picker. Server-
 * only (see lib/server/supabase/client.ts); app/page.tsx calls this instead of importing
 * getServiceRoleClient() directly. An empty list (no Supabase configured, or no events yet) is a
 * valid, silent result — the picker just shows nothing to choose.
 */
export async function listEvents(): Promise<EventOption[]> {
  let supabase;
  try {
    supabase = getServiceRoleClient();
  } catch {
    return [];
  }

  const { data, error } = await supabase.from('events').select('id, name, venues(name)').order('created_at', { ascending: false }).returns<EventRow[]>();
  if (error || !data) return [];

  return data.map((row) => {
    const venue = Array.isArray(row.venues) ? row.venues[0] : row.venues;
    return { id: row.id, name: row.name, venueName: venue?.name ?? '' };
  });
}
