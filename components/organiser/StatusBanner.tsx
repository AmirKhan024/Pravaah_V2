import { t } from '../../lib/organiser/messages';
import type { StatusLevel } from '../../lib/organiser/types';
import { STATUS_COLOR } from './statusColor';

type Props = {
  status: StatusLevel;
};

export default function StatusBanner({ status }: Props) {
  const color = STATUS_COLOR[status];

  return (
    <div className={`rounded-2xl ${color.bg} px-6 py-8 text-center`}>
      <div className={`text-5xl font-semibold tracking-tight ${color.text}`}>{t(`status.${status}`)}</div>
    </div>
  );
}
