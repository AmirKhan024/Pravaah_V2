import { t } from '../../lib/organiser/messages';
import type { ServiceStatus } from '../../lib/organiser/types';
import ActionCard from './ActionCard';

type Props = {
  service: ServiceStatus;
  onDo: (actionId: string) => void;
  onSkip: (actionId: string) => void;
  onBack: () => void;
};

export default function ServiceDetailScreen({ service, onDo, onSkip, onBack }: Props) {
  const current = service.actions.find((action) => action.state === 'pending');

  return (
    <div className="flex flex-col gap-6">
      <button type="button" onClick={onBack} className="self-start text-sm text-[#F5F5F0]/60 hover:text-[#F5F5F0]">
        {`< ${t('nav.back')}`}
      </button>

      <h1 className="text-2xl font-semibold text-[#F5F5F0]">{service.problem}</h1>

      {current ? (
        <ActionCard action={current} onDo={onDo} onSkip={onSkip} />
      ) : (
        <p className="text-[#F5F5F0]/50">{t('detail.done')}</p>
      )}
    </div>
  );
}
