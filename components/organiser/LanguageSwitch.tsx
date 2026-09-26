'use client';

import { useLang, useT } from '../../lib/organiser/messages';
import type { ConsoleLang } from '../../lib/organiser/types';

const LANGS: ConsoleLang[] = ['en', 'hi', 'mr'];

/** mr / hi / en — one word each, in memory only (no localStorage; resets to 'en' on reload). */
export default function LanguageSwitch() {
  const t = useT();
  const { lang, setLang } = useLang();

  return (
    <div className="flex gap-1 rounded-full border border-white/10 p-0.5">
      {LANGS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLang(option)}
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
            lang === option ? 'bg-[#C9A961] text-[#101715]' : 'text-[#F5F5F0]/50 hover:text-[#F5F5F0]'
          }`}
        >
          {t(`lang.${option}`)}
        </button>
      ))}
    </div>
  );
}
