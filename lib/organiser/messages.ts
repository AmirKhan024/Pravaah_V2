import { createContext, useCallback, useContext } from 'react';
import en from '../../messages/organiser/en.json';
import hi from '../../messages/organiser/hi.json';
import mr from '../../messages/organiser/mr.json';
import type { ConsoleLang } from './types';

/** Every leaf-string path in messages/organiser/en.json, e.g. "detail.do_it" — hi.json/mr.json
 * carry the exact same keys. */
type PathsToStringProps<T> = T extends string
  ? []
  : { [K in Extract<keyof T, string>]: [K, ...PathsToStringProps<T[K]>] }[Extract<keyof T, string>];

type Join<T extends string[]> = T extends [infer Head extends string, ...infer Rest extends string[]]
  ? Rest extends [] ? Head : `${Head}.${Join<Rest>}`
  : never;

export type MessageKey = Join<PathsToStringProps<typeof en>>;

const DICTIONARIES: Record<ConsoleLang, typeof en> = { en, hi, mr };

/** Reads one label out of messages/organiser/{lang}.json. No component may hardcode UI text. */
export function t(key: MessageKey, lang: ConsoleLang = 'en'): string {
  let node: unknown = DICTIONARIES[lang] ?? en;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return key;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : key;
}

export interface LangContextValue {
  lang: ConsoleLang;
  setLang: (lang: ConsoleLang) => void;
}

/** In-memory only (no localStorage) — resets to 'en' on reload, per the language-switch spec. */
export const LangContext = createContext<LangContextValue>({ lang: 'en', setLang: () => {} });

export function useLang(): LangContextValue {
  return useContext(LangContext);
}

/** Same t(key) call shape as every existing call site, now bound to the console's current
 * language via LangContext. */
export function useT(): (key: MessageKey) => string {
  const { lang } = useContext(LangContext);
  return useCallback((key: MessageKey) => t(key, lang), [lang]);
}
