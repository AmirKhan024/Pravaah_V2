'use client';

import type { TranslationDictionary } from '@/lib/visitor/i18n';

interface UpdateBannerProps {
  dict: TranslationDictionary;
  onSeeChanges: () => void;
}

export function UpdateBanner({ dict, onSeeChanges }: UpdateBannerProps) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#C9A961]/20 border border-[#C9A961] text-[#E5E7EB] w-full max-w-sm mx-auto shadow-md">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#C9A961] animate-pulse" />
        <span className="text-sm font-semibold text-[#F3F4F6]">
          {dict.banner.planUpdated}
        </span>
      </div>
      <button
        type="button"
        onClick={onSeeChanges}
        className="min-h-[44px] px-4 py-2 text-xs font-bold rounded-lg bg-[#C9A961] text-[#101715] hover:bg-[#b89850] transition-colors"
      >
        {dict.banner.seeChanges}
      </button>
    </div>
  );
}
