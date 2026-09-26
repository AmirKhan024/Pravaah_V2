import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/** Service-role client — bypasses RLS. Server-only; never import this from app/ (visitor/owner
 * routes) or components/. supabase/schema.sql has not been run against a live project yet, so
 * every caller must expect this to fail and handle it (see app/api/registrations/upload/route.ts). */
export function getServiceRoleClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY not set');
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
