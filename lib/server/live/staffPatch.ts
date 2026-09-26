import { z } from 'zod';
import { STAFF_REPORT_CHIPS, STAFF_REPORT_CLAMP, type StaffReportChip } from '../../../config/server-extras';
import type { LinkMode } from '../../../engine/types';
import { callJson } from '../llm/groq';
import { emptyScenarioPatch, type ScenarioPatch } from './types';

/** Base multiplier/effect per chip, before clamping — assumption, tuned by feel not measurement. */
const CHIP_EFFECT: Record<StaffReportChip, { capMult?: Partial<Record<LinkMode, number>>; sizeMultiplier?: number }> = {
  rain: { capMult: { walk: 0.8, road: 0.85 } },
  rail_delay: { capMult: { shuttle: 0.8, road: 0.9 } },
  gates_late: { capMult: { gate: 0.7 } },
  more_people: { sizeMultiplier: STAFF_REPORT_CLAMP.maxSizeMultiplier },
  fewer_people: { sizeMultiplier: 1 / STAFF_REPORT_CLAMP.maxSizeMultiplier },
  slow_lanes: { capMult: { gate: 0.75 } },
};

function clampCapMult(value: number): number {
  return Math.min(STAFF_REPORT_CLAMP.capMultMax, Math.max(STAFF_REPORT_CLAMP.capMultMin, value));
}

function clampSizeMultiplier(value: number): number {
  const max = STAFF_REPORT_CLAMP.maxSizeMultiplier;
  return Math.min(max, Math.max(1 / max, value));
}

/** Keyword fallback used both as callJson's fallback value and directly when there's no free text. */
function keywordFallbackChips(text: string): StaffReportChip[] {
  const t = text.toLowerCase();
  const chips: StaffReportChip[] = [];
  if (t.includes('rain') || t.includes('wet')) chips.push('rain');
  if (t.includes('rail') || t.includes('train') || t.includes('metro') || t.includes('delay')) chips.push('rail_delay');
  if (t.includes('gate') && t.includes('late')) chips.push('gates_late');
  if (t.includes('more') || t.includes('crowd')) chips.push('more_people');
  if (t.includes('fewer') || t.includes('less') || t.includes('thin')) chips.push('fewer_people');
  if (t.includes('slow') || t.includes('lane')) chips.push('slow_lanes');
  return chips;
}

const ChipsSchema = z.object({ chips: z.array(z.enum(STAFF_REPORT_CHIPS)) });

/**
 * Turns typed free text into a subset of the fixed chip set — never a number, never a probability,
 * only a selection from STAFF_REPORT_CHIPS (see CLAUDE.md: the LLM maps words to words). Falls back
 * to a plain keyword match on any failure.
 */
export async function classifyStaffText(text: string): Promise<StaffReportChip[]> {
  const fallback = { chips: keywordFallbackChips(text) };
  const prompt = [
    `Classify which of these ground-condition tags apply to a staff report, from this fixed list only: ${STAFF_REPORT_CHIPS.join(', ')}.`,
    'Reply with ONLY a JSON object: { "chips": string[] }, using only tags from that list. Use an empty array if none apply.',
    `Report text: ${JSON.stringify(text.slice(0, 1000))}`,
  ].join('\n');
  const result = await callJson(prompt, ChipsSchema, fallback);
  return result.chips;
}

/** Combines explicit chip taps with whatever free text implies, then clamps into one patch. */
export function buildStaffPatch(chips: StaffReportChip[], fromTick: number): ScenarioPatch {
  const unique = [...new Set(chips)];
  if (unique.length === 0) return emptyScenarioPatch(fromTick, 'no recognised condition in this report');

  const capMult: Partial<Record<LinkMode, number>> = {};
  let sizeMultiplier = 1;

  for (const chip of unique) {
    const effect = CHIP_EFFECT[chip];
    if (effect.capMult) {
      for (const [mode, mult] of Object.entries(effect.capMult) as [LinkMode, number][]) {
        capMult[mode] = clampCapMult(Math.min(capMult[mode] ?? 1, mult));
      }
    }
    if (effect.sizeMultiplier) sizeMultiplier *= effect.sizeMultiplier;
  }
  sizeMultiplier = clampSizeMultiplier(sizeMultiplier);

  return {
    capPatch: { capMult, fromTick },
    sizeMultiplier,
    note: `staff report: ${unique.join(', ')}`,
  };
}
