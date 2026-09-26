import { z } from 'zod';
import { GATE_SCAN_DRIFT_THRESHOLD } from '../../../config/server-extras';
import { getServiceRoleClient } from '../supabase/client';

const SimulationResultPayloadSchema = z
  .object({
    /** gateId -> expected arrivals for the window this gate_scan report covers. Not yet written by
     * app/api/events/[id]/simulate/route.ts's summary (see branch summary) — absent means "no
     * baseline yet", never a drift, until that route's summary grows this field. */
    expectedCountsPerGate: z.record(z.string(), z.number()).optional(),
  })
  .passthrough();

export interface DriftCheckResult {
  drift: boolean;
  expected: number | null;
  reason: string;
}

/** Baseline = the latest row in simulation_results for the event (see
 * app/api/events/[id]/simulate/route.ts — the actual "last saved simulation result"). Missing or
 * malformed data means "no baseline yet", never a drift. */
export async function findExpectedGateCount(eventId: string, gateId: string): Promise<number | null> {
  try {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase
      .from('simulation_results')
      .select('data')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;

    const parsed = SimulationResultPayloadSchema.safeParse(data.data);
    if (!parsed.success) return null;
    return parsed.data.expectedCountsPerGate?.[gateId] ?? null;
  } catch {
    return null;
  }
}

export function checkDrift(observedCount: number, expectedCount: number | null, threshold = GATE_SCAN_DRIFT_THRESHOLD): DriftCheckResult {
  if (expectedCount === null) return { drift: false, expected: null, reason: 'no baseline simulation result for this gate yet' };
  if (expectedCount <= 0) return { drift: false, expected: expectedCount, reason: 'baseline is zero, cannot compute a ratio' };

  const diffRatio = Math.abs(observedCount - expectedCount) / expectedCount;
  const drift = diffRatio > threshold;
  return { drift, expected: expectedCount, reason: drift ? `observed count is ${Math.round(diffRatio * 100)}% off the last simulation` : 'within expected range' };
}
