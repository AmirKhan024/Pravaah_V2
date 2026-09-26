'use client';

import { useT } from '../../lib/organiser/messages';
import type { DisplayNumber } from '../../lib/organiser/types';
import SampleTag from './SampleTag';

type Props = {
  deadline: DisplayNumber | null;
};

export default function DeadlineClock({ deadline }: Props) {
  const t = useT();
  if (!deadline) return null;

  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-white/5 bg-white/[0.03] px-6 py-5">
      <span className="text-xs uppercase tracking-wide text-[#F5F5F0]/50">{t('overview.next_deadline')}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-6xl font-semibold tabular-nums text-[#C9A961]">{deadline.value}</span>
        {deadline.unit ? <span className="text-lg text-[#F5F5F0]/60">{deadline.unit}</span> : null}
        <SampleTag sample={deadline.sample} />
      </div>
    </div>
  );
}
