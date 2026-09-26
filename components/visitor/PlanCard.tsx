'use client';

import type { VisitorPlan } from '@/contract/schemas';
import type { TranslationDictionary } from '@/lib/visitor/i18n';
import { PlanRow } from './PlanRow';

interface PlanCardProps {
  plan: VisitorPlan;
  dict: TranslationDictionary;
  highlightedKeys?: Set<string>;
}

export function PlanCard({ plan, dict, highlightedKeys }: PlanCardProps) {
  // Stay text & sub-value
  const stayValue = plan.stay ? plan.stay.hotelName : dict.plan.none;
  const staySubValue = plan.stay && plan.stay.coach ? dict.plan.coachIncluded : undefined;

  const stayWhy = plan.stay
    ? plan.stay.coach
      ? dict.plan.whyStayCoach
      : dict.plan.whyStay
    : dict.plan.whyStayNone;

  // Travel text & sub-value
  const travelModeFormatted =
    dict.form.travelModes[plan.travel.mode as keyof typeof dict.form.travelModes] ||
    plan.travel.mode;
  const travelValue = plan.travel.departTime;
  const travelSubValue = travelModeFormatted;

  // Food text & sub-value
  const foodValue = plan.food ? plan.food.zoneName : dict.plan.none;
  const foodSubValue = plan.food ? plan.food.window : undefined;

  return (
    <div className="flex flex-col gap-3 w-full max-w-sm mx-auto p-4 rounded-2xl bg-[#141E1B] border border-gray-800 shadow-xl">
      {/* Row 1: Stay */}
      <PlanRow
        label={dict.plan.stayLabel}
        value={stayValue}
        subValue={staySubValue}
        whyText={stayWhy}
        isHighlighted={highlightedKeys?.has('stay')}
        dict={dict}
      />

      {/* Row 2: Travel */}
      <PlanRow
        label={dict.plan.travelLabel}
        value={travelValue}
        subValue={travelSubValue}
        whyText={dict.plan.whyTravel}
        isHighlighted={highlightedKeys?.has('travel')}
        dict={dict}
      />

      {/* Row 3: Gate */}
      <PlanRow
        label={dict.plan.gateLabel}
        value={plan.gate}
        whyText={dict.plan.whyGate}
        isHighlighted={highlightedKeys?.has('gate')}
        dict={dict}
      />

      {/* Row 4: Leave at */}
      <PlanRow
        label={dict.plan.leaveAtLabel}
        value={plan.leaveTime}
        whyText={dict.plan.whyLeaveAt}
        isHighlighted={highlightedKeys?.has('leaveTime')}
        dict={dict}
      />

      {/* Row 5: Eat */}
      <PlanRow
        label={dict.plan.eatLabel}
        value={foodValue}
        subValue={foodSubValue}
        whyText={dict.plan.whyEat}
        isHighlighted={highlightedKeys?.has('food')}
        dict={dict}
      />
    </div>
  );
}
