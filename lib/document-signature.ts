import { z } from 'zod';

export const SIGNATURE_WIDTH = 640;
export const SIGNATURE_HEIGHT = 240;
export const MAX_SIGNATURE_STROKES = 40;
export const MAX_SIGNATURE_POINTS = 2000;
export type SignaturePoint = [number, number];
export type DrawnSignature = {
  format: 'eduo-ink-v1'; width: 640; height: 240; strokes: SignaturePoint[][];
};

// Store only bounded drawing coordinates. No uploaded SVG, scripts, pressure,
// timing, device fingerprint or handwriting recognition is involved.
export const drawnSignatureSchema = z.object({
  format: z.literal('eduo-ink-v1'), width: z.literal(SIGNATURE_WIDTH), height: z.literal(SIGNATURE_HEIGHT),
  strokes: z.array(z.array(z.tuple([
    z.number().int().min(0).max(SIGNATURE_WIDTH),
    z.number().int().min(0).max(SIGNATURE_HEIGHT),
  ])).min(2).max(MAX_SIGNATURE_POINTS)).min(1).max(MAX_SIGNATURE_STROKES),
}).strict().superRefine((drawing, ctx) => {
  let points = 0, length = 0;
  for (const stroke of drawing.strokes) {
    points += stroke.length;
    for (let i = 1; i < stroke.length; i++) length += Math.hypot(stroke[i][0] - stroke[i - 1][0], stroke[i][1] - stroke[i - 1][1]);
  }
  if (points > MAX_SIGNATURE_POINTS) ctx.addIssue({ code: 'custom', message: 'Подписът съдържа твърде много точки.' });
  if (length < 12) ctx.addIssue({ code: 'custom', message: 'Нарисувайте подпис в полето.' });
});

export const signatureDrawing = (strokes: SignaturePoint[][]): DrawnSignature => ({
  format: 'eduo-ink-v1', width: SIGNATURE_WIDTH, height: SIGNATURE_HEIGHT, strokes,
});
export const signatureHashInput = (drawing: DrawnSignature) => JSON.stringify(signatureDrawing(drawing.strokes));
export function drawnReceiptHashInput(receipt: {
  id: string; documentId: string; version: number; contentHash: string; hashFormat: string;
  name: string; at: string; signatureHash: string;
}) {
  return JSON.stringify({ format: 'eduo-drawn-receipt-v1', receiptId: receipt.id,
    documentId: receipt.documentId, version: receipt.version, contentHash: receipt.contentHash,
    hashFormat: receipt.hashFormat, method: 'drawn-signature', name: receipt.name,
    at: receipt.at, signatureHash: receipt.signatureHash });
}
export function signatureSvg(drawing: unknown) {
  const parsed = drawnSignatureSchema.safeParse(drawing);
  if (!parsed.success) return '';
  const paths = parsed.data.strokes.map(stroke => `<polyline points="${stroke.map(point => point.join(',')).join(' ')}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIGNATURE_WIDTH} ${SIGNATURE_HEIGHT}" role="img" aria-label="Рисуван подпис"><g fill="none" stroke="#24324b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`;
}
export const signatureMethodLabel = (d: Record<string, any>) =>
  (d.ackMethod || d.receipt?.method) === 'drawn-signature' ? 'Рисуван подпис' : 'Потвърждение за запознаване';
