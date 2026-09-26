import { t } from '../../lib/organiser/messages';
import type { GroundReportChipId } from '../../lib/organiser/types';

const CHIP_IDS: GroundReportChipId[] = ['rain', 'rail_delay', 'gates_late', 'more_people', 'fewer_people', 'slow_lanes'];

type Props = {
  selected: GroundReportChipId[];
  onToggle: (chipId: GroundReportChipId) => void;
};

export default function ReportChips({ selected, onToggle }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {CHIP_IDS.map((chipId) => {
        const active = selected.includes(chipId);
        return (
          <button
            key={chipId}
            type="button"
            onClick={() => onToggle(chipId)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              active ? 'border-[#C9A961] bg-[#C9A961]/15 text-[#C9A961]' : 'border-white/10 text-[#F5F5F0]/70 hover:bg-white/5'
            }`}
          >
            {t(`report.chips.${chipId}`)}
          </button>
        );
      })}
    </div>
  );
}
