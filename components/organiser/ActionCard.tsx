'use client';

import { useState } from 'react';
import { t } from '../../lib/organiser/messages';
import type { SuggestedAction } from '../../lib/organiser/types';
import SampleTag from './SampleTag';

type Props = {
  action: SuggestedAction;
  onDo: (actionId: string) => void;
  onSkip: (actionId: string) => void;
};

export default function ActionCard({ action, onDo, onSkip }: Props) {
  const [showWhy, setShowWhy] = useState(false);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-white/[0.03] p-6">
      <div className="flex items-center justify-between">
        <span className="text-xl font-medium text-[#F5F5F0]">{action.title}</span>
        <SampleTag sample={action.sample} />
      </div>

      <div className="flex items-baseline gap-6">
        <span className="text-2xl font-semibold tabular-nums text-[#C9A961]">{action.costLabel}</span>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-semibold tabular-nums text-[#F5F5F0]">{action.minutesLeft.value}</span>
          <span className="text-sm text-[#F5F5F0]/60">{action.minutesLeft.unit}</span>
        </div>
      </div>

      {showWhy ? <p className="text-sm text-[#F5F5F0]/70">{action.why}</p> : null}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onDo(action.id)}
          className="flex-1 rounded-xl bg-[#C9A961] py-3 font-semibold text-[#101715] transition hover:brightness-110"
        >
          {t('detail.do_it')}
        </button>
        <button
          type="button"
          onClick={() => onSkip(action.id)}
          className="flex-1 rounded-xl border border-white/10 py-3 font-semibold text-[#F5F5F0]/80 transition hover:bg-white/5"
        >
          {t('detail.not_now')}
        </button>
        <button
          type="button"
          onClick={() => setShowWhy((v) => !v)}
          className="rounded-xl px-4 py-3 font-semibold text-[#F5F5F0]/60 underline-offset-4 hover:underline"
        >
          {t('detail.why')}
        </button>
      </div>
    </div>
  );
}
