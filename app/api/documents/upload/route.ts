import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { DOCUMENT_MAX_BYTES } from '../../../../config/server-extras';
import { VenueDocumentSchema, type SaveStatus, type VenueDocument } from '../../../../contract/schemas';
import { extractPdfText, isImageMimeType, isPdf } from '../../../../lib/server/documents/extractText';
import { extractDocumentFields } from '../../../../lib/server/documents/llm';
import { computeMismatchFlags, upgradeTrust } from '../../../../lib/server/documents/mismatch';
import { getServiceRoleClient } from '../../../../lib/server/supabase/client';

export interface DocumentUploadResult {
  status: 'ok' | 'unreadable';
  reason?: string;
  document?: VenueDocument;
  trustUpgraded?: boolean;
  saveStatus: SaveStatus;
}

function unreadable(reason: string): DocumentUploadResult {
  return { status: 'unreadable', reason, saveStatus: { ok: true } };
}

/**
 * multipart/form-data: `venueId`, `eventId` (both required), and either `file` (PDF, max 5MB) or
 * `text` (pasted document text). Never guesses at an image — returns "unreadable" instead.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'expected multipart/form-data' }, { status: 400 });
  }

  const venueId = form.get('venueId');
  const eventId = form.get('eventId');
  const file = form.get('file');
  const pastedText = form.get('text');

  if (typeof venueId !== 'string' || !venueId) return NextResponse.json({ error: 'missing "venueId"' }, { status: 400 });
  if (typeof eventId !== 'string' || !eventId) return NextResponse.json({ error: 'missing "eventId"' }, { status: 400 });
  if (!(file instanceof File) && typeof pastedText !== 'string') {
    return NextResponse.json({ error: 'provide either "file" or "text"' }, { status: 400 });
  }

  let text: string;
  if (file instanceof File) {
    if (file.size > DOCUMENT_MAX_BYTES) return NextResponse.json({ error: 'file exceeds 5MB' }, { status: 400 });
    if (isImageMimeType(file.type)) return NextResponse.json(unreadable('Images are not readable — upload a PDF or paste the text'));
    if (!isPdf(file.type, file.name)) return NextResponse.json(unreadable('Unsupported file type — upload a PDF or paste the text'));

    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await extractPdfText(buffer);
    if (!extracted.ok) return NextResponse.json(unreadable(extracted.reason));
    text = extracted.text;
  } else {
    text = String(pastedText).trim();
    if (!text) return NextResponse.json(unreadable('No readable text found'));
  }

  const { result: fields } = await extractDocumentFields(text);

  let flags: string[] = [];
  let trustUpgraded = false;
  let saveStatus: SaveStatus = { ok: true };

  try {
    const supabase = getServiceRoleClient();
    const [{ data: venueRow, error: venueErr }, { data: eventRow, error: eventErr }] = await Promise.all([
      supabase.from('venues').select('data').eq('id', venueId).single(),
      supabase.from('events').select('date').eq('id', eventId).single(),
    ]);
    if (venueErr) throw venueErr;
    if (eventErr) throw eventErr;

    const venueData = venueRow.data as { capacity: { value: number; trust: 'claimed' | 'documented' | 'observed' } };
    const eventDate = String(eventRow.date);

    flags = computeMismatchFlags({
      claimedCapacity: venueData.capacity.value,
      documentedCapacity: fields.approvedCapacity,
      expiry: fields.expiry,
      eventDate,
    });

    const newTrust = upgradeTrust(venueData.capacity.trust, flags);
    trustUpgraded = newTrust !== venueData.capacity.trust;

    const document = VenueDocumentSchema.parse({
      id: randomUUID(),
      venueId,
      type: fields.documentType,
      fileUrl: null,
      extractedFields: { capacity: fields.approvedCapacity, issued_to: fields.issuingAuthority, valid_till: fields.expiry },
      expiry: fields.expiry,
      mismatchFlags: flags,
    } satisfies VenueDocument);

    if (trustUpgraded) venueData.capacity.trust = newTrust;

    const { error: docErr } = await supabase.from('venue_documents').upsert({ id: document.id, venue_id: venueId, type: document.type, data: document });
    if (docErr) throw docErr;
    if (trustUpgraded) {
      const { error: updateErr } = await supabase.from('venues').update({ data: venueData }).eq('id', venueId);
      if (updateErr) throw updateErr;
    }

    return NextResponse.json({ status: 'ok', document, trustUpgraded, saveStatus } satisfies DocumentUploadResult);
  } catch (err) {
    const error = err instanceof Error ? err.message : 'unknown error reading venue/event or saving document';
    saveStatus = { ok: false, error };
    console.error('[documents/upload] failed:', error);

    const document = VenueDocumentSchema.parse({
      id: randomUUID(),
      venueId,
      type: fields.documentType,
      fileUrl: null,
      extractedFields: { capacity: fields.approvedCapacity, issued_to: fields.issuingAuthority, valid_till: fields.expiry },
      expiry: fields.expiry,
      mismatchFlags: flags,
    } satisfies VenueDocument);

    return NextResponse.json({ status: 'ok', document, trustUpgraded: false, saveStatus } satisfies DocumentUploadResult);
  }
}
