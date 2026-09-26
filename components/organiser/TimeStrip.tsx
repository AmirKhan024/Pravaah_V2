import type { StatusLevel, ZoneFrame } from '../../lib/organiser/types';
import { STATUS_COLOR } from './statusColor';
import TimeSlider from './TimeSlider';

type Props = {
  frames: ZoneFrame[];
  index: number;
  onChange: (index: number) => void;
};

function worstStatus(frame: ZoneFrame): StatusLevel {
  const statuses = Object.values(frame.serviceStatus);
  if (statuses.includes('act_now')) return 'act_now';
  if (statuses.includes('watch')) return 'watch';
  return 'calm';
}

/** The evening time slider, with a thin strip behind it colored by status per minute. */
export default function TimeStrip({ frames, index, onChange }: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex h-1.5 overflow-hidden rounded-full">
        {frames.map((frame, i) => (
          <div key={i} className={STATUS_COLOR[worstStatus(frame)].dot + ' flex-1'} />
        ))}
      </div>
      <TimeSlider frames={frames} index={index} onChange={onChange} />
    </div>
  );
}
