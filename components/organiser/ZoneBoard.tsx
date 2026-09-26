import { t } from '../../lib/organiser/messages';
import type { ZoneCell } from '../../lib/organiser/types';
import { STATUS_COLOR } from './statusColor';

type Props = {
  zones: ZoneCell[];
};

export default function ZoneBoard({ zones }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs uppercase tracking-wide text-[#F5F5F0]/50">{t('time.zones')}</span>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {zones.map((zone) => {
          const color = STATUS_COLOR[zone.statusColor];
          return (
            <div key={zone.id} className={`flex flex-col items-center justify-center rounded-xl ${color.bg} p-4 text-center`}>
              <span className={`mb-2 h-4 w-4 rounded-full ${color.dot}`} />
              <span className="text-sm text-[#F5F5F0]/80">{zone.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
