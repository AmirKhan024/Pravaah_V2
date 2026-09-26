'use client';

import { useState, useEffect, useRef } from 'react';
import type { VisitorPlan, Lang } from '@/contract/schemas';
import { getTranslations, getStoredLanguage, setStoredLanguage } from '@/lib/visitor/i18n';
import { getVisitorPlan, subscribeToPlanUpdates } from '@/lib/visitor/api';
import { LanguageSelector } from '@/components/visitor/LanguageSelector';
import { PlanCard } from '@/components/visitor/PlanCard';
import { UpdateBanner } from '@/components/visitor/UpdateBanner';

export default function VisitorPlanPage() {
  const [lang, setLang] = useState<Lang>('mr');
  const [mounted, setMounted] = useState(false);
  const [plan, setPlan] = useState<VisitorPlan | null>(null);
  const [pendingPlan, setPendingPlan] = useState<VisitorPlan | null>(null);
  const [hasUpdateNotice, setHasUpdateNotice] = useState(false);
  const [highlightedKeys, setHighlightedKeys] = useState<Set<string>>(new Set());

  const currentPlanRef = useRef<VisitorPlan | null>(null);
  currentPlanRef.current = plan;

  useEffect(() => {
    const initialLang = getStoredLanguage();
    setLang(initialLang);
    setMounted(true);

    getVisitorPlan({ originArea: '', travelMode: 'train', groupSize: 1 }).then((initialPlan) => {
      setPlan(initialPlan);
    });

    const unsubscribe = subscribeToPlanUpdates((updatedPlan) => {
      const current = currentPlanRef.current;
      if (current && updatedPlan.version > current.version) {
        setPendingPlan(updatedPlan);
        setHasUpdateNotice(true);
      } else {
        setPlan(updatedPlan);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLanguageChange = (newLang: Lang) => {
    setLang(newLang);
    setStoredLanguage(newLang);
  };

  const handleSeeChanges = () => {
    if (!pendingPlan || !plan) return;

    const changed = new Set<string>();

    if (JSON.stringify(pendingPlan.stay) !== JSON.stringify(plan.stay)) {
      changed.add('stay');
    }
    if (JSON.stringify(pendingPlan.travel) !== JSON.stringify(plan.travel)) {
      changed.add('travel');
    }
    if (pendingPlan.gate !== plan.gate) {
      changed.add('gate');
    }
    if (pendingPlan.leaveTime !== plan.leaveTime) {
      changed.add('leaveTime');
    }
    if (JSON.stringify(pendingPlan.food) !== JSON.stringify(plan.food)) {
      changed.add('food');
    }

    setPlan(pendingPlan);
    setPendingPlan(null);
    setHasUpdateNotice(false);
    setHighlightedKeys(changed);
  };

  if (!mounted || !plan) return null;

  const dict = getTranslations(lang);

  return (
    <main className="flex flex-col gap-5 w-full">
      <header className="flex items-center justify-between border-b border-gray-800 pb-3">
        <h1 className="text-xl font-bold text-[#C9A961] tracking-wide">
          {dict.appTitle}
        </h1>
        <LanguageSelector
          currentLang={lang}
          onLanguageChange={handleLanguageChange}
          dict={dict}
        />
      </header>

      {hasUpdateNotice && (
        <UpdateBanner dict={dict} onSeeChanges={handleSeeChanges} />
      )}

      <PlanCard
        plan={plan}
        dict={dict}
        highlightedKeys={highlightedKeys}
      />
    </main>
  );
}
