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
  // Stay text
  const stayText = plan.stay
    ? `${plan.stay.hotelName}${plan.stay.coach ? ` • ${dict.plan.coachIncluded}` : ''}`
    : dict.plan.none;

  const stayWhy = plan.stay
    ? plan.stay.coach
      ? dict.plan.whyStayCoach
      : dict.plan.whyStay
    : dict.plan.whyStayNone;

  // Travel text (mode formatted)
  const travelModeFormatted =
    dict.form.travelModes[plan.travel.mode as keyof typeof dict.form.travelModes] ||
    plan.travel.mode;
  const travelText = `${travelModeFormatted} • ${plan.travel.departTime}`;

  // Food text
  const foodText = plan.food ? plan.food.zoneName : dict.plan.none;

  return (
    <div className="flex flex-col gap-3 w-full max-w-sm mx-auto p-4 rounded-2xl bg-[#141E1B] border border-gray-800 shadow-xl">
      {/* Row 1: Stay */}
      <PlanRow
        label={dict.plan.stayLabel}
        value={stayText}
        whyText={stayWhy}
        isHighlighted={highlightedKeys?.has('stay')}
        dict={dict}
      />

      {/* Row 2: Travel */}
      <PlanRow
        label={dict.plan.travelLabel}
        value={travelText}
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
        value={foodText}
        whyText={dict.plan.whyEat}
        isHighlighted={highlightedKeys?.has('food')}
        dict={dict}
      />
    </div>
  );
}
