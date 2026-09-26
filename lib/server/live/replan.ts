import type { LiveReport } from '../../../contract/schemas';
import type { StaffReportChip } from '../../../config/server-extras';
import { parseHHMM } from '../scenario/arrivalRules';
import { getServiceRoleClient } from '../supabase/client';
import { checkDrift, findExpectedGateCount } from './gateScanDrift';
import { buildStaffPatch, classifyStaffText } from './staffPatch';
import { emptyScenarioPatch, type ScenarioPatch } from './types';

export interface ApplyReportResult {
  patch: ScenarioPatch;
  needsRerun: boolean;
  detail: string;
}

/** Best-effort tick (minutes since gatesOpen) for a report's timestamp — assumes the report time
 * and the event's gatesOpen are in the same wall-clock timezone (no timezone conversion attempted).
 * Falls back to tick 0 if the event can't be read. */
async function tickForReport(eventId: string, reportTimeIso: string): Promise<number> {
  try {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase.from('events').select('data').eq('id', eventId).single();
    if (error || !data) return 0;
    const gatesOpen = (data.data as { gatesOpen: string }).gatesOpen;
    const gatesOpenMin = parseHHMM(gatesOpen);
    const reportDate = new Date(reportTimeIso);
    const reportMin = reportDate.getUTCHours() * 60 + reportDate.getUTCMinutes();
    return Math.max(0, reportMin - gatesOpenMin);
  } catch {
    return 0;
  }
}

/**
 * The single place a LiveReport turns into a ScenarioPatch. Never runs the engine — only decides
 * what the next simulation run should account for, and whether one is warranted at all. Another
 * developer wires the actual re-run.
 */
export async function applyReport(eventId: string, report: LiveReport): Promise<ApplyReportResult> {
  const fromTick = await tickForReport(eventId, report.time);

  if (report.source === 'staff') {
    const payload = report.payload as { chipIds?: unknown; text?: unknown };
    const explicit = Array.isArray(payload.chipIds) ? (payload.chipIds as StaffReportChip[]) : [];
    const fromText = typeof payload.text === 'string' && payload.text.trim() ? await classifyStaffText(payload.text) : [];
    const patch = buildStaffPatch([...explicit, ...fromText], fromTick);
    const needsRerun = patch.note !== 'no recognised condition in this report';
    return { patch, needsRerun, detail: patch.note };
  }

  if (report.source === 'gate_scan') {
    const payload = report.payload as { gateId?: unknown; count?: unknown };
    if (typeof payload.gateId !== 'string' || typeof payload.count !== 'number') {
      const detail = 'malformed gate_scan payload';
      return { patch: emptyScenarioPatch(fromTick, detail), needsRerun: false, detail };
    }
    const expected = await findExpectedGateCount(eventId, payload.gateId);
    const { drift, reason } = checkDrift(payload.count, expected);
    return { patch: emptyScenarioPatch(fromTick, reason), needsRerun: drift, detail: reason };
  }

  // visitor_location is informational only (zone counts) — it never implies a scenario patch by itself
  const detail = 'visitor_location is informational only';
  return { patch: emptyScenarioPatch(fromTick, detail), needsRerun: false, detail };
}
