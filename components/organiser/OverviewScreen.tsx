import type { ConsoleState } from '../../lib/organiser/types';
import DeadlineClock from './DeadlineClock';
import PublishButton from './PublishButton';
import ServiceGrid from './ServiceGrid';
import StatusBanner from './StatusBanner';

type Props = {
  state: ConsoleState;
  onSelectService: (serviceId: string) => void;
  onPublish: () => void;
};

export default function OverviewScreen({ state, onSelectService, onPublish }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <StatusBanner status={state.statusWord} />
      <ServiceGrid services={state.services} onSelect={onSelectService} />
      <DeadlineClock deadline={state.nextDeadline} />
      <PublishButton canPublish={state.canPublish} published={state.published} onPublish={onPublish} />
    </div>
  );
}
