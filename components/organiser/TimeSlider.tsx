import type { ZoneFrame } from '../../lib/organiser/types';

type Props = {
  frames: ZoneFrame[];
  index: number;
  onChange: (index: number) => void;
};

export default function TimeSlider({ frames, index, onChange }: Props) {
  const frame = frames[index];

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-5xl font-semibold tabular-nums text-[#F5F5F0]">{frame?.timeLabel ?? '--:--'}</span>
      <input
        type="range"
        min={0}
        max={Math.max(frames.length - 1, 0)}
        value={index}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full max-w-xl cursor-pointer accent-[#C9A961]"
      />
    </div>
  );
}
