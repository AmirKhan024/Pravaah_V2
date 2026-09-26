'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Lang } from '@/contract/schemas';
import { getTranslations, getStoredLanguage, setStoredLanguage } from '@/lib/visitor/i18n';
import { getVisitorPlan } from '@/lib/visitor/api';
import { LanguageSelector } from '@/components/visitor/LanguageSelector';
import { VisitorForm } from '@/components/visitor/VisitorForm';

export default function VisitorEntryPage() {
  const router = useRouter();
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
    travelMode: string;
    stayingAt: string;
    groupSize: number;
  }) => {
    // Call typed API
    await getVisitorPlan({
      originArea: formData.originArea,
      travelMode: formData.travelMode,
      stayingAt: formData.stayingAt,
      groupSize: formData.groupSize,
    });

    router.push('/v/plan');
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
