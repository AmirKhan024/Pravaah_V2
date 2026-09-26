import { CAPACITY_MISMATCH_TOLERANCE } from '../../../config/server-extras';
import type { Trust } from '../../../contract/schemas';

/** Plain code, no LLM — claimed vs. documented capacity, within a tolerance fraction. */
export function capacityMismatches(claimedCapacity: number, documentedCapacity: number, tolerance = CAPACITY_MISMATCH_TOLERANCE): boolean {
  if (claimedCapacity <= 0) return false;
  return Math.abs(documentedCapacity - claimedCapacity) / claimedCapacity > tolerance;
}

/** Both are YYYY-MM-DD (z.iso.date) strings — lexicographic compare is a valid date compare. */
export function isExpired(expiry: string, eventDate: string): boolean {
  return expiry < eventDate;
}

export interface MismatchInput {
  claimedCapacity: number;
  documentedCapacity: number;
  expiry: string;
  eventDate: string;
}

export function computeMismatchFlags(input: MismatchInput): string[] {
  const flags: string[] = [];
  if (capacityMismatches(input.claimedCapacity, input.documentedCapacity)) flags.push('capacity_differs_from_claimed');
  if (isExpired(input.expiry, input.eventDate)) flags.push('expired');
  return flags;
}

/** claimed -> documented only when the document raised no flags at all. Never downgrades, never
 * jumps straight to observed — a document is paperwork, not an on-the-ground measurement. */
export function upgradeTrust(currentTrust: Trust, flags: string[]): Trust {
  if (currentTrust === 'claimed' && flags.length === 0) return 'documented';
  return currentTrust;
}
