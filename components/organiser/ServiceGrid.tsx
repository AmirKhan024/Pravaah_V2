import type { ServiceStatus } from '../../lib/organiser/types';
import ServiceTile from './ServiceTile';

type Props = {
  services: ServiceStatus[];
  onSelect: (serviceId: string) => void;
};

export default function ServiceGrid({ services, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {services.map((service) => (
        <ServiceTile key={service.id} service={service} onSelect={onSelect} />
      ))}
    </div>
  );
}
