import type { CrowdGroup, Event, InterventionShape, Lang, TravelMode, Venue } from '../../../contract/schemas';
import { minutesToClock, parseHHMM } from '../scenario/arrivalRules';
import { deriveVisitorFields } from './derive';
import { fillTemplate, translateTemplate } from './wording';

export interface BuiltVisitorPlanFields {
  gate: string;
  leaveTime: string;
  travel: { mode: TravelMode; departTime: string };
  food: { zoneName: string; window: string } | null;
  stay: { hotelName: string; coach: boolean } | null;
}

/**
 * Venue (contract/schemas.ts) has no food-zone list yet — only engine/'s internal Zone[] does, and
 * that only exists once toEngineScenario() (Step 2, unbuilt on this branch) runs. So a `food` lever
 * applies the same zone/window to every visitor plan for the event rather than a per-group zone;
 * flagged in the branch summary as a gap once Venue/engine expose real food zones.
 */
export async function buildVisitorPlanFields(group: CrowdGroup, venue: Venue, event: Event, levers: InterventionShape[], lang: Lang): Promise<BuiltVisitorPlanFields> {
  const derived = deriveVisitorFields(group, venue, event, levers);

  const [gateTemplate, foodWindowTemplate] = await Promise.all([translateTemplate('gate', lang), translateTemplate('foodWindow', lang)]);
  const gate = fillTemplate(gateTemplate, { GATE: derived.gateName });

  const foodLever = levers.find((l): l is Extract<InterventionShape, { type: 'food' }> => l.type === 'food');
  let food: BuiltVisitorPlanFields['food'] = null;
  if (foodLever) {
    const windowClock = minutesToClock(parseHHMM(event.gatesOpen) + foodLever.from);
    food = { zoneName: foodLever.zone, window: fillTemplate(foodWindowTemplate, { TIME: windowClock }) };
  }

  const option = event.transportOptions.find((o) => o.transportPointId === group.path[0]);
  const mode: TravelMode = option?.mode ?? 'walk';

  return {
    gate,
    leaveTime: derived.leaveTimeClock,
    travel: { mode, departTime: derived.travelDepartClock },
    food,
    stay: derived.stay,
  };
}
