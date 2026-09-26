'use client';

import { useT } from '../../lib/organiser/messages';
import type { ServiceStatus, StatusLevel } from '../../lib/organiser/types';
import ActionCard from './ActionCard';
import StatusBanner from './StatusBanner';

type Props = {
  statusWord: StatusLevel;
  services: ServiceStatus[];
  focusedServiceId: string | null;
  onDo: (actionId: string) => void;
  onSkip: (actionId: string) => void;
};

export default function NowPanel({ statusWord, services, focusedServiceId, onDo, onSkip }: Props) {
  const t = useT();
  const pool = focusedServiceId ? services.filter((s) => s.id === focusedServiceId) : services;
  const pending = pool.flatMap((s) => s.actions.filter((a) => a.state === 'pending'));
  const current = pending.sort((a, b) => a.minutesLeft.value - b.minutesLeft.value)[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <StatusBanner status={statusWord} />
      {current ? (
        <ActionCard action={current} onDo={onDo} onSkip={onSkip} />
      ) : (
        <p className="text-center text-lg text-[#F5F5F0]/50">{t('now.all_calm')}</p>
      )}
    </div>
  );
}
