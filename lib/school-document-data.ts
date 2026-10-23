import { previewClasswork, type ClassworkHome } from './classwork-data';
import type { SchoolRole } from './school-directory-data';
import { signatureSvg, type DrawnSignature } from './document-signature';
import { schoolToday, plusDays } from './platform-data';
import { attachmentViews, type ClassAttachment, type ClassAttachmentView } from './classwork-data';

export const MAX_SCHOOL_DOCUMENTS = 300;
export const MAX_DOCUMENT_EDITIONS = 12;
export const MAX_DOCUMENT_RECIPIENTS = 80;
export const MAX_DOCUMENT_OPERATIONS = 80;
export const schoolDocumentReceiptId = (recipientId: string) => 'school-doc-receipt:' + recipientId;
export type SchoolDocumentFields = { title: string; category: string; content: string; due: string; signing: 'drawn-signature' | 'acknowledgment' };
export type SchoolDocumentHashFormat = 'eduo-school-document-v1' | 'eduo-school-document-v2';
export type SchoolDocumentDraft = SchoolDocumentFields & { pupilIds: string[]; attachments?: ClassAttachment[] };
export type SchoolDocumentDraftView = Omit<SchoolDocumentDraft, 'attachments'> & { attachments: ClassAttachmentView[] };
export type DocumentRecipient = { id: string; pupilId: string; pupilName: string; parentId: string; parentName: string };
export type SchoolDocumentEdition = SchoolDocumentFields & { edition: number; publishedAt: string; publishedBy: string; contentHash: string; recipientHash: string; recipients: DocumentRecipient[]; withdrawnAt?: string; withdrawalReason?: string; attachments?: ClassAttachment[]; hashFormat?: SchoolDocumentHashFormat };
export type SchoolDocumentEditionView = Omit<SchoolDocumentEdition, 'recipients' | 'attachments' | 'hashFormat'> & { attachments: ClassAttachmentView[]; hashFormat: SchoolDocumentHashFormat };
export type SchoolDocument = {
  id: string; kind: 'school-document'; classId: string; className: string; schoolYear: string;
  createdBy: string; authorName: string; createdAt: string; updatedAt: string; revision: number;
  status: 'draft' | 'issued' | 'withdrawn'; draft?: SchoolDocumentDraft;
  editions: SchoolDocumentEdition[];
  operations: { id: string; actorId: string; fingerprint: string; type: string; at: string; reason?: string }[];
};
export type SchoolDocumentReceipt = {
  id: string; kind: 'school-document-receipt'; schoolId: string; documentId: string; edition: number;
  pupilId: string; pupilName: string; parentId: string; name: string; at: string;
  method: SchoolDocumentFields['signing']; contentHash: string; hashFormat: SchoolDocumentHashFormat;
  signatureHash?: string; drawing?: DrawnSignature; evidenceHash: string; evidenceFormat: 'eduo-school-receipt-v1';
  requestId: string; fingerprint: string;
};
export type SchoolReceiptView = Omit<SchoolDocumentReceipt, 'kind' | 'parentId' | 'requestId' | 'fingerprint'>;
export type SchoolDocumentSummary = Pick<SchoolDocument, 'id' | 'classId' | 'className' | 'schoolYear' | 'revision' | 'status' | 'authorName' | 'updatedAt'> & {
  title: string; due: string; edition: number; signing: SchoolDocumentFields['signing']; expected: number; completed: number; canManage: boolean; hasDraft: boolean; retained: boolean; attachmentCount: number;
};
export type SchoolDocumentDetail = {
  document: SchoolDocumentSummary; draft?: SchoolDocumentDraftView;
  edition: SchoolDocumentEditionView | null;
  history: { edition: number; title: string; publishedAt: string; withdrawn: boolean; attachmentCount: number }[];
  recipients: (Omit<DocumentRecipient, 'parentId'> & { canSign: boolean; receipt?: SchoolReceiptView })[];
};
export type SchoolDocumentsHome = Pick<ClassworkHome, 'writable' | 'preview' | 'schools' | 'context'> & {
  documents: SchoolDocumentSummary[]; canCreate: boolean; capacityReached: boolean;
  parentCounts: { pupilId: string; count: number }[]; detail?: SchoolDocumentDetail;
};
export const schoolDocumentStatus = { draft: 'Чернова', issued: 'Предоставен', withdrawn: 'Оттеглен' };
export function schoolDocumentFileUrl(schoolId: string, documentId: string, fileId: string, source: { edition?: number; draftRevision?: number }) {
  const q = new URLSearchParams({ school: schoolId, document: documentId });
  if (source.edition !== undefined) q.set('edition', String(source.edition));
  if (source.draftRevision !== undefined) q.set('draftRevision', String(source.draftRevision));
  return `/api/school-documents/files/${encodeURIComponent(fileId)}?${q}`;
}
export const schoolDocumentHashFormat = (e: Pick<SchoolDocumentEdition, 'hashFormat'>): SchoolDocumentHashFormat => e.hashFormat || 'eduo-school-document-v1';
export const schoolDocumentDraftView = ({ attachments, ...draft }: SchoolDocumentDraft): SchoolDocumentDraftView => ({ ...draft, attachments: attachmentViews(attachments) });
export const schoolDocumentEditionView = ({ recipients, attachments, ...e }: SchoolDocumentEdition): SchoolDocumentEditionView => ({ ...e, attachments: attachmentViews(attachments), hashFormat: schoolDocumentHashFormat(e) });
// Preserve v20's exact property order and bytes; v2 additionally binds attachments.
export const schoolDocumentHashInput = (schoolId: string, doc: Pick<SchoolDocument, 'id' | 'classId' | 'schoolYear'>, edition: SchoolDocumentEdition) => JSON.stringify({
  format: schoolDocumentHashFormat(edition), schoolId, documentId: doc.id, classId: doc.classId, schoolYear: doc.schoolYear,
  edition: edition.edition, title: edition.title, category: edition.category, content: edition.content,
  due: edition.due, signing: edition.signing, recipientHash: edition.recipientHash,
  ...(schoolDocumentHashFormat(edition) === 'eduo-school-document-v2' ? { attachments: attachmentViews(edition.attachments).map(f => ({ id: f.id, name: f.name, mime: f.mime, size: f.size, sha256: f.sha256 })) } : {}),
});
export const schoolReceiptHashInput = (r: Omit<SchoolDocumentReceipt, 'evidenceHash'> | SchoolDocumentReceipt) => JSON.stringify({
  format: 'eduo-school-receipt-v1', id: r.id, schoolId: r.schoolId, documentId: r.documentId, edition: r.edition,
  pupilId: r.pupilId, pupilName: r.pupilName, parentId: r.parentId, name: r.name, at: r.at,
  method: r.method, contentHash: r.contentHash, hashFormat: r.hashFormat, signatureHash: r.signatureHash || '',
});
export function schoolDocumentCopy(schoolName: string, detail: SchoolDocumentDetail, recipientId?: string) {
  const e = detail.edition; if (!e) return '';
  const slot = detail.recipients.find(r => r.id === recipientId), receipt = slot?.receipt;
  const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const lines = [schoolName, e.title, `Документ: ${detail.document.id} · версия ${e.edition}`, `${detail.document.className} · ${detail.document.schoolYear}`, `Вид: ${e.category}`, `Срок: ${e.due}`, '', e.content, '', `SHA-256 на документа: ${e.contentHash}`, `Отпечатък на получателите: ${e.recipientHash}`];
  if (e.attachments.length) lines.push('', 'ПРИЛОЖЕНИЯ КЪМ ТАЗИ ВЕРСИЯ', ...e.attachments.map(f => `${f.name} · ${f.size} bytes\nSHA-256: ${f.sha256}`), 'Приложенията се изтеглят отделно от платформата.');
  if (slot) lines.push('', `Ученик: ${slot.pupilName}`, `Получател: ${slot.parentName}`, `Заявка: ${slot.id}`);
  if (receipt) lines.push(`Начин: ${receipt.method === 'drawn-signature' ? 'Рисуван подпис' : 'Запознаване'}`, `Потвърдил: ${receipt.name}`, `Час: ${receipt.at}`, `Разписка: ${receipt.id}`, `SHA-256 на разписката: ${receipt.evidenceHash}`, ...(receipt.signatureHash ? [`SHA-256 на подписа: ${receipt.signatureHash}`] : []));
  if (e.withdrawnAt) lines.push(`Оттеглен: ${e.withdrawnAt}`, `Причина: ${e.withdrawalReason}`);
  if (detail.document.retained || e.edition !== detail.document.edition) lines.push('Историческа версия. Не очаква нов подпис.');
  lines.push('', `Формат на отпечатъка: ${e.hashFormat}`, 'Училищен пилот. Подписване с проверен външен доставчик не е свързано.');
  const image = signatureSvg(receipt?.drawing);
  return `<!doctype html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(e.title)}</title><style>body{font:16px/1.8 system-ui,sans-serif;color:#24324b;padding:28px;margin:auto;max-width:800px}pre{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere}svg{width:100%;max-width:480px;border:1px solid #dce3ef;border-radius:12px}@media print{body{padding:0}}</style></head><body><pre>${escape(lines.join('\n'))}</pre>${image}</body></html>`;
}
export function previewSchoolDocuments(role: SchoolRole = 'teacher', selected?: string): SchoolDocumentsHome {
  const base = previewClasswork(role), staff = role === 'teacher' || role === 'admin', p = base.context!.pupils[0], now = new Date().toISOString();
  const id = '93000000-0000-4000-8000-000000000001';
  const doc: SchoolDocumentSummary = { id, classId: p.classId, className: '6. А', schoolYear: base.context!.school.year, revision: 2, status: 'issued', authorName: 'Мария Николова', updatedAt: now, title: 'Посещение в музея', due: plusDays(schoolToday(), 7), edition: 1, signing: 'drawn-signature', expected: 1, completed: 0, canManage: staff, hasDraft: false, retained: false, attachmentCount: 0 };
  const allowed = role !== 'student';
  return { writable: false, preview: true, schools: base.schools, context: base.context, documents: allowed ? [doc] : [], canCreate: staff, capacityReached: false, parentCounts: staff ? base.context!.pupils.map(p => ({ pupilId: p.id, count: 1 })) : [], ...(allowed && selected === id ? { detail: { document: doc, edition: { title: doc.title, category: 'Родителско съгласие', content: 'Предлагаме посещение в музея с класа.\n\nСборен пункт: училищният двор, 9:00 ч.\nВръщане: 13:00 ч.\n\nПрегледайте организацията и подпишете тази примерна версия.', due: doc.due, signing: 'drawn-signature', edition: 1, publishedAt: now, publishedBy: 'Мария Николова', contentHash: '0'.repeat(64), recipientHash: '1'.repeat(64), attachments: [], hashFormat: 'eduo-school-document-v2' }, history: [{ edition: 1, title: doc.title, publishedAt: now, withdrawn: false, attachmentCount: 0 }], recipients: [{ id: '93000000-0000-4000-8000-000000000002', pupilId: p.id, pupilName: p.name, parentName: 'Елена Петрова', canSign: role === 'parent' }] } } : {}) };
}
