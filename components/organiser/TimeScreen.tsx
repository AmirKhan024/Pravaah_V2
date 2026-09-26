'use client';

import { useState } from 'react';
import { t } from '../../lib/organiser/messages';
import type { ServiceStatus, ZoneFrame } from '../../lib/organiser/types';
import { STATUS_COLOR } from './statusColor';
import TimeSlider from './TimeSlider';
import ZoneBoard from './ZoneBoard';

type Props = {
  services: ServiceStatus[];
  frames: ZoneFrame[];
  onBack: () => void;
};

export default function TimeScreen({ services, frames, onBack }: Props) {
  const [index, setIndex] = useState(0);
  const frame = frames[index];

  return (
    <div className="flex flex-col gap-6">
      <button type="button" onClick={onBack} className="self-start text-sm text-[#F5F5F0]/60 hover:text-[#F5F5F0]">
        {`< ${t('nav.back')}`}
      </button>

      <TimeSlider frames={frames} index={index} onChange={setIndex} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {services.map((service) => {
          const forecast = frame?.serviceStatus[service.id] ?? service.statusColor;
          const color = STATUS_COLOR[forecast];
          return (
            <div key={service.id} className={`flex items-center justify-between rounded-xl ${color.bg} px-4 py-3`}>
              <span className="text-sm text-[#F5F5F0]/80">{service.label}</span>
              <span className={`h-3 w-3 rounded-full ${color.dot}`} />
            </div>
          );
        })}
      </div>

      {frame ? <ZoneBoard zones={frame.zones} /> : null}
    </div>
  );
}
