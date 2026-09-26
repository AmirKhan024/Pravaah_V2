export type ExtractTextOutcome = { ok: true; text: string } | { ok: false; reason: string };

/** Images are never guessed at — the LLM here is text-only (see CLAUDE.md). */
export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function isPdf(mimeType: string, fileName: string): boolean {
  return mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
}

/** Dynamic import: pdf-parse pulls in pdfjs-dist, which touches browser-only globals (DOMMatrix)
 * at module load — deferring the import until a PDF actually needs parsing keeps every other
 * caller (and every test that never uploads a PDF) free of that dependency. */
export async function extractPdfText(buffer: Buffer): Promise<ExtractTextOutcome> {
  const { PDFParse } = await import('pdf-parse');
  let parser: InstanceType<typeof PDFParse> | null = null;
  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = result.text.trim();
    if (!text) return { ok: false, reason: 'No readable text found in this PDF' };
    return { ok: true, text };
  } catch {
    return { ok: false, reason: 'Could not read this PDF' };
  } finally {
    await parser?.destroy();
  }
}
