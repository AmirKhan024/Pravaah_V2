import { t } from '../../lib/organiser/messages';
import type { MessageKey } from '../../lib/organiser/messages';

export type ConsoleScreen = 'overview' | 'service' | 'time' | 'ground' | 'orders';

const TABS: { screen: ConsoleScreen; labelKey: MessageKey }[] = [
  { screen: 'overview', labelKey: 'nav.overview' },
  { screen: 'time', labelKey: 'nav.time' },
  { screen: 'ground', labelKey: 'nav.ground_report' },
  { screen: 'orders', labelKey: 'nav.orders' },
];

type Props = {
  active: ConsoleScreen;
  onSelect: (screen: ConsoleScreen) => void;
};

export default function ConsoleNav({ active, onSelect }: Props) {
  return (
    <nav className="flex gap-1 rounded-2xl border border-white/5 bg-white/[0.03] p-1">
      {TABS.map((tab) => (
        <button
          key={tab.screen}
          type="button"
          onClick={() => onSelect(tab.screen)}
          className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition ${
            active === tab.screen || (active === 'service' && tab.screen === 'overview')
              ? 'bg-[#C9A961] text-[#101715]'
              : 'text-[#F5F5F0]/60 hover:text-[#F5F5F0]'
          }`}
        >
          {t(tab.labelKey)}
        </button>
      ))}
    </nav>
  );
}
