'use client';

import { useT } from '../../lib/organiser/messages';
import type { ConsoleState } from '../../lib/organiser/types';
import { APP_NAME } from '../../config/app';
import LanguageSwitch from './LanguageSwitch';
import { STATUS_COLOR } from './statusColor';

type Props = {
  state: ConsoleState;
  onPublish: () => void;
  onOpenGroundReport: () => void;
  onOpenOrders: () => void;
};

export default function TopBar({ state, onPublish, onOpenGroundReport, onOpenOrders }: Props) {
  const t = useT();

  return (
    <header className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-3">
      <span className="text-xs font-medium text-[#F5F5F0]/40">{APP_NAME}</span>
      <span className="text-sm font-semibold text-[#F5F5F0]">{state.eventName}</span>

      <div className="flex flex-1 flex-wrap gap-2">
        {state.services.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-xs text-[#F5F5F0]/70">
            <span className={`h-2 w-2 rounded-full ${STATUS_COLOR[s.statusColor].dot}`} />
            {s.label}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={onOpenGroundReport}
        aria-label={t('nav.ground_report')}
        title={t('nav.ground_report')}
        className="rounded-full border border-white/10 px-3 py-2 text-sm text-[#F5F5F0]/70 hover:text-[#F5F5F0]"
      >
        📝
      </button>
      <button
        type="button"
        onClick={onOpenOrders}
        aria-label={t('nav.orders')}
        title={t('nav.orders')}
        className="rounded-full border border-white/10 px-3 py-2 text-sm text-[#F5F5F0]/70 hover:text-[#F5F5F0]"
      >
        📦
      </button>

      <LanguageSwitch />

      {state.published ? (
        <a
          href={`/v?event=${state.eventId}`}
          title={t('publish.view_visitor_plan')}
          className="flex items-center gap-2 rounded-2xl bg-[#3DDC84]/15 px-4 py-2 text-sm font-semibold text-[#3DDC84]"
        >
          ✓ {t('publish.live')} v{state.publishedVersion ?? 1}
        </a>
      ) : (
        <button
          type="button"
          disabled={!state.canPublish}
          onClick={onPublish}
          className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
            state.canPublish ? 'bg-[#C9A961] text-[#101715] hover:brightness-110' : 'cursor-not-allowed bg-white/5 text-[#F5F5F0]/30'
          }`}
        >
          {state.canPublish ? t('publish.button') : t('publish.approve_first')}
        </button>
      )}
    </header>
  );
}
