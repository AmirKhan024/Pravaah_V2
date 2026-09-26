'use client';

import { useT } from '../../lib/organiser/messages';

type Props = {
  sample: boolean;
  /** use "assumption" instead of "sample" for a number the head hasn't verified */
  kind?: 'sample' | 'assumption';
};

export default function SampleTag({ sample, kind = 'sample' }: Props) {
  const t = useT();
  if (!sample) return null;

  return (
    <span className="rounded-full border border-[#C9A961]/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#C9A961]">
      {t(kind === 'sample' ? 'tags.sample' : 'tags.assumption')}
    </span>
  );
}
