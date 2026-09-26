import { NextResponse } from 'next/server';
import type { CrowdGroup, Event, InterventionShape, Lang, TravelMode, Venue } from '../../../contract/schemas';
import { VisitorPlanSchema } from '../../../contract/schemas';
import { getPublishVersion } from '../../../lib/server/publish/publish';
import { getServiceRoleClient } from '../../../lib/server/supabase/client';
import { buildVisitorPlanFields } from '../../../lib/server/visitorPlan/build';
import { matchCrowdGroup } from '../../../lib/server/visitorPlan/match';

const VALID_LANGS: Lang[] = ['mr', 'hi', 'en'];
const VALID_MODES: TravelMode[] = ['train', 'metro', 'bus', 'car', 'walk', 'other'];

/**
 * GET /api/visitor-plan?event=&from=&mode=&hotel=&group=&lang= — `from` (origin) and `group`
 * (party size) are accepted but not used to match: CrowdGroups aren't keyed by either (see
 * lib/server/visitorPlan/match.ts and buildGroups.ts's bucketKey comment). registrationId is stood
 * in with the matched group's own id — there's no durable registration->group link yet to resolve
 * one specific registrant (see branch summary).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get('event');
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
      .select('id,status,data')
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

    const group = matchCrowdGroup(groups, event, { mode, hotel: hotelParam ?? undefined });
    if (!group) return NextResponse.json({ reason: 'no matching crowd group for this mode/hotel' }, { status: 404 });

    const levers = planRow.data as InterventionShape[];
    const version = await getPublishVersion(eventId);
    const fields = await buildVisitorPlanFields(group, venue, event, levers, lang);

    const visitorPlan = VisitorPlanSchema.parse({
      id: `vp_${eventId}_${group.id}_${version}`,
      eventId,
      registrationId: group.id,
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
