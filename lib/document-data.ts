import type { SchoolRecord } from './school-data';
import { signatureMethodLabel, signatureSvg } from './document-signature';

export const documentCategories = ['Родителско съгласие', 'Информация', 'Декларация'] as const;
export const documentLabels: Record<string, string> = {
  draft: 'Чернова', pending: 'Очаква преглед', acknowledged: 'Потвърден', withdrawn: 'Оттеглен'
};
export const documentColor = (status: string) => status === 'acknowledged' ? 'green' : status === 'pending' ? 'orange' : 'gray';
export const documentRevision = (d: SchoolRecord) => d.revision || 0;
export const documentVersion = (d: SchoolRecord) => d.version || 1;
export function documentSnapshot(d: SchoolRecord) {
  const { title, content, category, due, status, files = [], attachments = [], version = 1,
    publishedAt, createdAt, ackName, ackAt, ackMethod, drawnSignature, contentHash, hashFormat, receipt,
    withdrawnAt, withdrawalReason } = d;
  return { title, content, category, due, status, files, attachments, version, publishedAt,
    createdAt, ackName, ackAt, ackMethod, drawnSignature, contentHash, hashFormat, receipt, withdrawnAt, withdrawalReason };
}

// Fixed property order is part of the versioned receipt format. Attachment hashes
// cover the actual decrypted bytes, not just filenames or storage references.
export function documentHashInput(id: string, d: any) {
  return JSON.stringify({ format: 'eduo-document-v1', documentId: id, version: d.version || 1,
    title: d.title, category: d.category, due: d.due || '', content: d.content, studentId: 0,
    attachments: (d.attachments || []).map((f: any) => ({ id: f.id, name: f.name, mime: f.mime, size: f.size, sha256: f.sha256 })) });
}
export function documentReceiptText(id: string, d: any) {
  const lines = ['EDUO · КОПИЕ НА ДОКУМЕНТ', `Номер: ${id}`, `Версия: ${d.version || 1}`,
    `Състояние: ${documentLabels[d.status] || d.status}`, `Заглавие: ${d.title}`,
    `Вид: ${d.category}`, `Срок: ${d.due || '—'}`, 'Получател: родител на Алекс Петров · 6. А', '', d.content, ''];
  if (d.attachments?.length) lines.push('ПРИЛОЖЕНИЯ', ...d.attachments.map((f: any) => `${f.name} · ${f.size} bytes\nSHA-256: ${f.sha256}`), '');
  if (d.ackAt) lines.push('ДЕМОНСТРАЦИОННА РАЗПИСКА', `Начин: ${signatureMethodLabel(d)}`, `Име: ${d.ackName}`, `Час: ${d.ackAt}`, `Разписка: ${d.receipt?.id || 'примерен/по-ранен запис'}`);
  if (d.drawnSignature?.sha256) lines.push(`SHA-256 на рисувания подпис: ${d.drawnSignature.sha256}`);
  if (d.receipt?.evidenceHash) lines.push(`SHA-256 на разписката: ${d.receipt.evidenceHash}`, `Формат на разписката: ${d.receipt.evidenceFormat}`);
  if (d.contentHash) lines.push(`SHA-256: ${d.contentHash}`, `Формат: ${d.hashFormat || 'legacy-content-only'}`);
  if (d.withdrawnAt) lines.push(`Оттеглен: ${d.withdrawnAt}`, `Причина: ${d.withdrawalReason}`);
  lines.push('', 'Частна пилотна среда с примерни лица. Рисуваният подпис и потвърждението за запознаване са отделни от електронното подписване чрез доставчик.');
  return lines.join('\n');
}

export function documentReceiptHtml(id: string, d: any) {
  const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const drawing = d.drawnSignature?.drawing, image = signatureSvg(drawing);
  return `<!doctype html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; form-action 'none'"><title>${escape(d.title || 'Eduo документ')}</title><style>body{font:16px/1.7 system-ui,sans-serif;color:#24324b;margin:0;padding:32px;background:#f4f6fa}main{max-width:780px;margin:auto;padding:40px;background:white;border:1px solid #dce3ef;border-radius:16px}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}h1{font-size:22px}figure{margin:32px 0 0;border-top:1px solid #dce3ef;padding-top:20px}svg{display:block;width:100%;max-width:460px;height:auto;border:1px solid #dce3ef;border-radius:12px}figcaption{margin:12px 0;font-size:14px}@media(max-width:600px){body{padding:12px}main{padding:20px}}@media print{body{padding:0;background:white}main{border:0;padding:0}figure{break-inside:avoid}}</style></head><body><main><h1>Eduo · Копие на документ</h1><pre>${escape(documentReceiptText(id, d))}</pre>${image ? `<figure>${image}<figcaption>Запазен рисуван подпис · ${escape(d.ackName || '')} · версия ${escape(String(d.version || 1))}</figcaption></figure>` : ''}</main></body></html>`;
}
