import { NextResponse } from 'next/server';
import type { CrowdGroup, Event, InterventionShape, Lang, TravelMode, Venue } from '../../../contract/schemas';
import { VisitorPlanSchema } from '../../../contract/schemas';
import { getServiceRoleClient } from '../../../lib/server/supabase/client';
import { buildVisitorPlanFields } from '../../../lib/server/visitorPlan/build';
import { matchCrowdGroup } from '../../../lib/server/visitorPlan/match';

const VALID_LANGS: Lang[] = ['mr', 'hi', 'en'];
const VALID_MODES: TravelMode[] = ['train', 'metro', 'bus', 'car', 'walk', 'other'];

/**
 * GET /api/visitor-plan?event=&registration=&from=&mode=&hotel=&group=&lang= — when `registration`
 * (a registration id) is given, its saved group_id (see buildGroups.ts/registrations.group_id) is
 * used directly, resolving one specific registrant exactly. Otherwise falls back to matching by
 * mode/hotel (see lib/server/visitorPlan/match.ts). `from` (origin) and `group` (party size) are
 * accepted but never used to match: CrowdGroups aren't keyed by either.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get('event');
  const registrationId = url.searchParams.get('registration');
  const modeParam = url.searchParams.get('mode');
  const hotelParam = url.searchParams.get('hotel');
  const langParam = url.searchParams.get('lang');
  const lang: Lang = VALID_LANGS.includes(langParam as Lang) ? (langParam as Lang) : 'en';
  const mode: TravelMode | undefined = VALID_MODES.includes(modeParam as TravelMode) ? (modeParam as TravelMode) : undefined;

  if (!eventId) return NextResponse.json({ error: 'missing "event"' }, { status: 400 });

  try {
    const supabase = getServiceRoleClient();

    const { data: planRow, error: planErr } = await supabase
      .from('plans')
      .select('id,status,data,version')
      .eq('event_id', eventId)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (planErr) throw planErr;
    if (!planRow) return NextResponse.json({ reason: 'not published' }, { status: 404 });

    const { data: eventRow, error: eventErr } = await supabase.from('events').select('data').eq('id', eventId).single();
    if (eventErr || !eventRow) throw eventErr ?? new Error('event not found');
    const event = eventRow.data as Event;

    const { data: venueRow, error: venueErr } = await supabase.from('venues').select('data').eq('id', event.venueId).single();
    if (venueErr || !venueRow) throw venueErr ?? new Error('venue not found');
    const venue = venueRow.data as Venue;

    const { data: groupRows, error: groupErr } = await supabase.from('crowd_groups').select('data').eq('event_id', eventId);
    if (groupErr) throw groupErr;
    const groups = ((groupRows ?? []) as Array<{ data: CrowdGroup }>).map((r) => r.data);

    let group: CrowdGroup | null = null;
    if (registrationId) {
      const { data: regRow } = await supabase.from('registrations').select('group_id').eq('id', registrationId).eq('event_id', eventId).maybeSingle();
      if (regRow?.group_id) group = groups.find((g) => g.id === regRow.group_id) ?? null;
    }
    if (!group) group = matchCrowdGroup(groups, event, { mode, hotel: hotelParam ?? undefined });
    if (!group) return NextResponse.json({ reason: 'no matching crowd group for this registration/mode/hotel' }, { status: 404 });

    const levers = planRow.data as InterventionShape[];
    const version = planRow.version as number;
    const fields = await buildVisitorPlanFields(group, venue, event, levers, lang);

    const visitorPlan = VisitorPlanSchema.parse({
      id: `vp_${eventId}_${group.id}_${version}`,
      eventId,
      registrationId: registrationId ?? group.id,
      stay: fields.stay,
      travel: fields.travel,
      gate: fields.gate,
      leaveTime: fields.leaveTime,
      food: fields.food,
      language: lang,
      version,
    });

    try {
      const { error: upsertErr } = await supabase
        .from('visitor_plans')
        .upsert({ id: visitorPlan.id, event_id: eventId, registration_id: visitorPlan.registrationId, version, data: visitorPlan });
      if (upsertErr) throw upsertErr;
    } catch (err) {
      console.error('[visitor-plan] save failed:', err instanceof Error ? err.message : err);
    }

    return NextResponse.json(visitorPlan);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown error building visitor plan' }, { status: 500 });
  }
}
