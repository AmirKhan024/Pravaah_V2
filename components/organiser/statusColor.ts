import type { StatusLevel } from '../../lib/organiser/types';

/** Green/amber/red — the only colors a status ever takes. Red is reserved for act_now. `hex` is
 * the same color as a literal, for SVG attributes (stroke/fill) that can't take a Tailwind class. */
export const STATUS_COLOR: Record<StatusLevel, { text: string; bg: string; ring: string; dot: string; hex: string }> = {
  calm: { text: 'text-[#3DDC84]', bg: 'bg-[#3DDC84]/12', ring: 'ring-[#3DDC84]/40', dot: 'bg-[#3DDC84]', hex: '#3DDC84' },
  watch: { text: 'text-[#F0B429]', bg: 'bg-[#F0B429]/12', ring: 'ring-[#F0B429]/40', dot: 'bg-[#F0B429]', hex: '#F0B429' },
  act_now: { text: 'text-[#E5484D]', bg: 'bg-[#E5484D]/12', ring: 'ring-[#E5484D]/40', dot: 'bg-[#E5484D]', hex: '#E5484D' },
};
