'use client';

import type { Lang } from '@/contract/schemas';
import type { TranslationDictionary } from '@/lib/visitor/i18n';

interface LanguageSelectorProps {
  currentLang: Lang;
  onLanguageChange: (lang: Lang) => void;
  dict: TranslationDictionary;
}

export function LanguageSelector({ currentLang, onLanguageChange, dict }: LanguageSelectorProps) {
  const languages: { code: Lang; label: string }[] = [
    { code: 'mr', label: dict.langMr },
    { code: 'hi', label: dict.langHi },
    { code: 'en', label: dict.langEn },
  ];

  return (
    <div className="flex items-center justify-center gap-2 p-2">
      {languages.map(({ code, label }) => {
        const isActive = currentLang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => onLanguageChange(code)}
            className={`min-h-[44px] px-4 py-2 text-sm font-semibold rounded-lg transition-colors border ${
              isActive
                ? 'bg-[#C9A961] text-[#101715] border-[#C9A961]'
                : 'bg-transparent text-[#E5E7EB] border-gray-700 hover:border-[#C9A961]'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
