'use client';

import { useState } from 'react';
import type { TravelMode } from '@/contract/schemas';
import type { TranslationDictionary } from '@/lib/visitor/i18n';

interface VisitorFormProps {
  dict: TranslationDictionary;
  onSubmit: (data: {
    originArea: string;
    travelMode: TravelMode;
    stayingAt: string;
    groupSize: number;
  }) => void;
}

export function VisitorForm({ dict, onSubmit }: VisitorFormProps) {
  const [originArea, setOriginArea] = useState('');
  const [travelMode, setTravelMode] = useState<TravelMode>('train');
  const [stayingAt, setStayingAt] = useState('');
  const [groupSize, setGroupSize] = useState(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      originArea,
      travelMode,
      stayingAt,
      groupSize,
    });
  };

  const travelModes: { key: TravelMode; label: string }[] = [
    { key: 'train', label: dict.form.travelModes.train },
    { key: 'metro', label: dict.form.travelModes.metro },
    { key: 'bus', label: dict.form.travelModes.bus },
    { key: 'car', label: dict.form.travelModes.car },
    { key: 'walk', label: dict.form.travelModes.walk },
    { key: 'other', label: dict.form.travelModes.other },
  ];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full max-w-sm mx-auto">
      {/* Input 1: Coming from */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[#C9A961]">
          {dict.form.comingFrom}
        </label>
        <input
          type="text"
          value={originArea}
          onChange={(e) => setOriginArea(e.target.value)}
          placeholder={dict.form.comingFromPlaceholder}
          required
          className="min-h-[44px] px-4 rounded-xl bg-[#1A2421] border border-gray-800 text-[#E5E7EB] text-base focus:outline-none focus:border-[#C9A961]"
        />
      </div>

      {/* Input 2: How travelling */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[#C9A961]">
          {dict.form.howTravelling}
        </label>
        <div className="grid grid-cols-2 gap-2">
          {travelModes.map((mode) => (
            <button
              key={mode.key}
              type="button"
              onClick={() => setTravelMode(mode.key)}
              className={`min-h-[44px] px-3 py-2 text-sm font-medium rounded-xl border transition-colors ${
                travelMode === mode.key
                  ? 'bg-[#C9A961] text-[#101715] border-[#C9A961]'
                  : 'bg-[#1A2421] text-[#E5E7EB] border-gray-800 hover:border-gray-700'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input 3: Staying at */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[#C9A961]">
          {dict.form.stayingAt}
        </label>
        <input
          type="text"
          value={stayingAt}
          onChange={(e) => setStayingAt(e.target.value)}
          placeholder={dict.form.stayingAtPlaceholder}
          className="min-h-[44px] px-4 rounded-xl bg-[#1A2421] border border-gray-800 text-[#E5E7EB] text-base focus:outline-none focus:border-[#C9A961]"
        />
      </div>

      {/* Input 4: People in group */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[#C9A961]">
          {dict.form.peopleInGroup}
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setGroupSize(Math.max(1, groupSize - 1))}
            className="min-h-[44px] w-[44px] rounded-xl bg-[#1A2421] border border-gray-800 text-xl text-[#E5E7EB] font-bold flex items-center justify-center hover:border-[#C9A961]"
          >
            -
          </button>
          <span className="text-xl font-semibold text-[#E5E7EB] w-12 text-center">
            {groupSize}
          </span>
          <button
            type="button"
            onClick={() => setGroupSize(groupSize + 1)}
            className="min-h-[44px] w-[44px] rounded-xl bg-[#1A2421] border border-gray-800 text-xl text-[#E5E7EB] font-bold flex items-center justify-center hover:border-[#C9A961]"
          >
            +
          </button>
        </div>
      </div>

      {/* Single Main Action Button */}
      <button
        type="submit"
        className="min-h-[48px] mt-4 w-full bg-[#C9A961] text-[#101715] text-lg font-bold rounded-xl hover:bg-[#b89850] transition-colors shadow-lg shadow-[#C9A961]/10"
      >
        {dict.form.submit}
      </button>
    </form>
  );
}
