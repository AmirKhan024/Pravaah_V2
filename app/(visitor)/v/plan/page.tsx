'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { VisitorPlan, Lang, TravelMode } from '@/contract/schemas';
import { getTranslations, getStoredLanguage, setStoredLanguage } from '@/lib/visitor/i18n';
import { getVisitorPlan, subscribeToPlanUpdates } from '@/lib/visitor/api';
import { LanguageSelector } from '@/components/visitor/LanguageSelector';
import { PlanCard } from '@/components/visitor/PlanCard';
import { UpdateBanner } from '@/components/visitor/UpdateBanner';

export default function VisitorPlanPage() {
  return (
    <Suspense fallback={null}>
      <VisitorPlanPageInner />
    </Suspense>
  );
}

function VisitorPlanPageInner() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('event') ?? '';
  const mode = (searchParams.get('mode') as TravelMode) || 'train';
  const hotel = searchParams.get('hotel') ?? undefined;

  const [lang, setLang] = useState<Lang>('mr');
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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

    if (!eventId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);

    getVisitorPlan({
      eventId,
      originArea: '',
      travelMode: mode,
      stayingAt: hotel,
      groupSize: 1,
      lang: initialLang,
    })
      .then((initialPlan) => {
        setPlan(initialPlan);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, mode, hotel]);

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

  if (!mounted) return null;

  const dict = getTranslations(lang);

  if (!eventId) {
    return (
      <main className="flex flex-col gap-6 w-full max-w-[360px] mx-auto">
        <header className="flex items-center justify-between border-b border-gray-800 pb-3">
          <Link
            href="/"
            className="min-h-[44px] inline-flex items-center text-xs font-semibold text-gray-400 hover:text-[#C9A961]"
          >
            ← {dict.states.back}
          </Link>
          <LanguageSelector
            currentLang={lang}
            onLanguageChange={handleLanguageChange}
            dict={dict}
          />
        </header>

        <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-[#141E1B] border border-gray-800 text-center gap-4">
          <span className="text-lg font-bold text-[#F3F4F6]">
            {dict.states.pickEvent}
          </span>
          <Link
            href="/"
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#C9A961] text-[#101715] font-bold text-sm inline-flex items-center justify-center"
          >
            {dict.states.pickEvent}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-5 w-full max-w-[360px] mx-auto">
      <header className="flex items-center justify-between border-b border-gray-800 pb-3">
        <div className="flex flex-col">
          <Link
            href="/"
            className="min-h-[44px] inline-flex items-center text-xs font-semibold text-gray-400 hover:text-[#C9A961]"
          >
            ← {dict.states.back}
          </Link>
          <h1 className="text-lg font-bold text-[#C9A961] tracking-wide">
            {dict.appTitle}
          </h1>
        </div>
        <LanguageSelector
          currentLang={lang}
          onLanguageChange={handleLanguageChange}
          dict={dict}
        />
      </header>

      {loading && (
        <div className="flex items-center justify-center p-8 rounded-2xl bg-[#141E1B] border border-gray-800 text-[#C9A961] font-bold text-base">
          {dict.states.loading}
        </div>
      )}

      {error && !loading && (
        <div className="flex items-center justify-center p-8 rounded-2xl bg-[#141E1B] border border-gray-800 text-red-400 font-bold text-base">
          {dict.states.error}
        </div>
      )}

      {!loading && !error && !plan && (
        <div className="flex items-center justify-center p-8 rounded-2xl bg-[#141E1B] border border-gray-800 text-gray-400 font-bold text-base">
          {dict.states.empty}
        </div>
      )}

      {!loading && !error && plan && (
        <>
          {hasUpdateNotice && (
            <UpdateBanner dict={dict} onSeeChanges={handleSeeChanges} />
          )}

          <PlanCard
            plan={plan}
            dict={dict}
            highlightedKeys={highlightedKeys}
          />
        </>
      )}
    </main>
  );
}
