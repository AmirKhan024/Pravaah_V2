import en from '../../messages/organiser/en.json';

/** Every leaf-string path in messages/organiser/en.json, e.g. "detail.do_it". Marathi/Hindi files
 * will be added later and swapped in behind the same t() call. */
type PathsToStringProps<T> = T extends string
  ? []
  : { [K in Extract<keyof T, string>]: [K, ...PathsToStringProps<T[K]>] }[Extract<keyof T, string>];

type Join<T extends string[]> = T extends [infer Head extends string, ...infer Rest extends string[]]
  ? Rest extends [] ? Head : `${Head}.${Join<Rest>}`
  : never;

export type MessageKey = Join<PathsToStringProps<typeof en>>;

/** Reads one label out of messages/organiser/en.json. No component may hardcode UI text. */
export function t(key: MessageKey): string {
  let node: unknown = en;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return key;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : key;
}
