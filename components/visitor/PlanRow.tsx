'use client';

import { useState } from 'react';
import type { TranslationDictionary } from '@/lib/visitor/i18n';

interface PlanRowProps {
  label: string;
  value: string;
  subValue?: string;
  whyText: string;
  isHighlighted?: boolean;
  dict: TranslationDictionary;
}

export function PlanRow({ label, value, subValue, whyText, isHighlighted, dict }: PlanRowProps) {
  const [showWhy, setShowWhy] = useState(false);

  return (
    <div
      className={`p-4 rounded-xl border transition-colors flex flex-col gap-2 ${
        isHighlighted
          ? 'bg-[#C9A961]/15 border-[#C9A961]'
          : 'bg-[#1A2421] border-gray-800/80'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-xs uppercase tracking-wider font-semibold text-[#C9A961]">
            {label}
          </span>
          <span className="text-xl font-bold text-[#F3F4F6] break-words">
            {value}
          </span>
          {subValue && (
            <span className="text-xs font-medium text-gray-400 break-words">
              {subValue}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowWhy(!showWhy)}
          className="min-h-[44px] px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-800/60 text-[#C9A961] border border-gray-700 hover:border-[#C9A961] transition-colors shrink-0"
        >
          {dict.plan.why}
        </button>
      </div>

      {showWhy && (
        <p className="text-xs text-gray-300 bg-[#101715]/60 p-2.5 rounded-lg border border-gray-800 break-words">
          {whyText}
        </p>
      )}
    </div>
  );
}
