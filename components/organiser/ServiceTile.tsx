import type { ServiceStatus } from '../../lib/organiser/types';
import SampleTag from './SampleTag';
import { STATUS_COLOR } from './statusColor';

type Props = {
  service: ServiceStatus;
  onSelect: (serviceId: string) => void;
};

export default function ServiceTile({ service, onSelect }: Props) {
  const color = STATUS_COLOR[service.statusColor];

  return (
    <button
      type="button"
      onClick={() => onSelect(service.id)}
      className={`flex flex-col items-start gap-3 rounded-2xl border border-white/5 ${color.bg} p-5 text-left transition hover:brightness-110`}
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-lg font-medium text-[#F5F5F0]">{service.label}</span>
        <span className={`h-3 w-3 rounded-full ${color.dot}`} />
      </div>
      {service.headline ? (
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums text-[#F5F5F0]">{service.headline.value}</span>
          {service.headline.unit ? <span className="text-sm text-[#F5F5F0]/60">{service.headline.unit}</span> : null}
          <SampleTag sample={service.headline.sample} />
        </div>
      ) : null}
    </button>
  );
}
