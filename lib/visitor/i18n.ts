import enDict from '@/messages/visitor/en.json';
import hiDict from '@/messages/visitor/hi.json';
import mrDict from '@/messages/visitor/mr.json';
import type { Lang } from '@/contract/schemas';

export type TranslationDictionary = typeof enDict;

const dictionaries: Record<Lang, TranslationDictionary> = {
  en: enDict,
  hi: hiDict,
  mr: mrDict,
};

export function getTranslations(lang: Lang): TranslationDictionary {
  return dictionaries[lang] || dictionaries.en;
}

export const LANGUAGE_KEY = 'pravaah_visitor_lang';

export function getStoredLanguage(): Lang {
  if (typeof window === 'undefined') return 'mr';
  const stored = localStorage.getItem(LANGUAGE_KEY);
  if (stored === 'en' || stored === 'hi' || stored === 'mr') {
    return stored;
  }
  return 'mr'; // default language
}

export function setStoredLanguage(lang: Lang) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LANGUAGE_KEY, lang);
  }
}
