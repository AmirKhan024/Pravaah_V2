import type { Trust } from "@/contract/schemas";
const tones: Record<Trust, string> = { claimed: "border-white/15 bg-white/10 text-white/55", documented: "border-[#C9A961]/50 bg-[#C9A961]/15 text-[#e9d49c]", observed: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" };
export function TrustBadge({ trust }: { trust: Trust }) { return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tones[trust]}`}>{trust}</span>; }
