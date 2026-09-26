'use client';

import { useState } from 'react';
import { useT } from '../../lib/organiser/messages';
import type { GroundReportChipId, GroundReportSubmission } from '../../lib/organiser/types';
import ReportChips from './ReportChips';

type Props = {
  onSubmit: (report: GroundReportSubmission) => Promise<void>;
  onBack: () => void;
};

export default function GroundReportScreen({ onSubmit, onBack }: Props) {
  const t = useT();
  const [selected, setSelected] = useState<GroundReportChipId[]>([]);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  function toggleChip(chipId: GroundReportChipId) {
    setSelected((prev) => (prev.includes(chipId) ? prev.filter((id) => id !== chipId) : [...prev, chipId]));
  }

  async function handleSubmit() {
    await onSubmit({ chipIds: selected, note });
    setSelected([]);
    setNote('');
    setSent(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <button type="button" onClick={onBack} className="self-start text-sm text-[#F5F5F0]/60 hover:text-[#F5F5F0]">
        {`< ${t('nav.back')}`}
      </button>

      <ReportChips selected={selected} onToggle={toggleChip} />

      <textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setSent(false);
        }}
        placeholder={t('report.note_placeholder')}
        rows={3}
        className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-[#F5F5F0] placeholder:text-[#F5F5F0]/40 focus:border-[#C9A961] focus:outline-none"
      />

      <button
        type="button"
        onClick={handleSubmit}
        className="rounded-2xl bg-[#C9A961] py-4 text-lg font-semibold text-[#101715] transition hover:brightness-110"
      >
        {t('report.submit')}
      </button>

      {sent ? <p className="text-center text-sm text-[#3DDC84]">{t('report.sent')}</p> : null}
    </div>
  );
}
