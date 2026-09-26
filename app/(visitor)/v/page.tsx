'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Lang, TravelMode } from '@/contract/schemas';
import { getTranslations, getStoredLanguage, setStoredLanguage } from '@/lib/visitor/i18n';
import { getVisitorPlan } from '@/lib/visitor/api';
import { LanguageSelector } from '@/components/visitor/LanguageSelector';
import { VisitorForm } from '@/components/visitor/VisitorForm';

export default function VisitorEntryPage() {
  return (
    <Suspense fallback={null}>
      <VisitorEntryPageInner />
    </Suspense>
  );
}

function VisitorEntryPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get('event') ?? '';

  const [lang, setLang] = useState<Lang>('mr');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLang(getStoredLanguage());
    setMounted(true);
  }, []);

  const handleLanguageChange = (newLang: Lang) => {
    setLang(newLang);
    setStoredLanguage(newLang);
  };

  const handleFormSubmit = async (formData: {
    originArea: string;
    travelMode: TravelMode;
    stayingAt: string;
    groupSize: number;
  }) => {
    await getVisitorPlan({
      eventId,
      originArea: formData.originArea,
      travelMode: formData.travelMode,
      stayingAt: formData.stayingAt,
      groupSize: formData.groupSize,
      lang,
    });

    router.push(
      `/v/plan?event=${encodeURIComponent(eventId)}&mode=${formData.travelMode}${
        formData.stayingAt ? `&hotel=${encodeURIComponent(formData.stayingAt)}` : ''
      }`
    );
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
    <main className="flex flex-col gap-6 w-full max-w-[360px] mx-auto">
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

      <VisitorForm dict={dict} onSubmit={handleFormSubmit} />
    </main>
  );
}
