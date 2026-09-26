'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

    router.push(`/v/plan?event=${encodeURIComponent(eventId)}&mode=${formData.travelMode}${formData.stayingAt ? `&hotel=${encodeURIComponent(formData.stayingAt)}` : ''}`);
  };

  if (!mounted) return null;

  const dict = getTranslations(lang);

  return (
    <main className="flex flex-col gap-6 w-full">
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

      <VisitorForm dict={dict} onSubmit={handleFormSubmit} />
    </main>
  );
}
