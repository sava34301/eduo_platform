import { z } from 'zod';
import { env } from 'cloudflare:workers';
import { validDate } from './platform-service';
import { decrypt, getRecord, recordSnapshot, saveGuarded } from './store';
import { roles, type SchoolRecord } from './school-data';
import { documentCategories, documentHashInput, documentRevision, documentSnapshot, documentVersion } from './document-data';
import { drawnSignatureSchema, drawnReceiptHashInput, signatureHashInput } from './document-signature';

const id = z.string().min(1).max(100);
const revision = z.number().int().min(0);
const actor = z.enum(['teacher', 'admin']).default('teacher');
const fields = {
  title: z.string().trim().min(3).max(200), content: z.string().trim().min(1).max(20000),
  category: z.enum(documentCategories), due: validDate, files: z.array(id).max(3).default([])
};
const schemas: Record<string, z.ZodTypeAny> = {
  document: z.object({ ...fields, requestId: z.string().uuid(), actor }),
  'save-document-draft': z.object({ ...fields, id, revision, actor }),
  'revise-document': z.object({ id, revision, actor }),
  'discard-document-draft': z.object({ id, revision, actor }),
  'publish-document': z.object({ id, revision, actor }),
  'withdraw-document': z.object({ id, revision, reason: z.string().trim().min(5).max(1500), actor }),
  acknowledge: z.object({ id, version: z.number().int().min(1), contentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(), name: z.string().trim().min(3).max(100), accepted: z.literal(true),
    method: z.enum(['acknowledgment', 'drawn-signature', 'provider-signature']).default('acknowledgment'), signature: drawnSignatureSchema.optional()
  }).strict().superRefine((d, ctx) => {
    if (d.method === 'drawn-signature' ? !d.signature : !!d.signature) ctx.addIssue({ code: 'custom', message: 'Проверете избрания начин на потвърждение и рисувания подпис.' });
  })
};
const fail = (error: string, status = 400) => Response.json({ error }, { status });
const conflict = () => fail('Документът е променен. Обновете и прегледайте актуалната версия, преди да продължите. Попълненият текст остава във формуляра.', 409);
const digest = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource)), b => b.toString(16).padStart(2, '0')).join('');
async function fileRecords(owner: string, ids: string[]) {
  if (new Set(ids).size !== ids.length) return null;
  const files = await Promise.all(ids.map(id => getRecord(owner, id)));
  return files.every(f => f?.kind === 'file') ? files as SchoolRecord[] : null;
}
async function attachments(owner: string, files: SchoolRecord[]) {
  return Promise.all(files.map(async f => {
    let sha256 = f.sha256;
    if (!sha256) {
      const object = await env.BUCKET?.get(f.objectKey);
      if (!object) throw new Error('Attachment unavailable');
      sha256 = await digest(await decrypt(new Uint8Array(await object.arrayBuffer()), owner));
    }
    return { id: f.id, name: f.name, mime: f.mime, size: f.size, sha256 };
  }));
}
export const handlesDocument = (type: string) => Object.hasOwn(schemas, type);
export async function handleDocument(owner: string, type: string, input: unknown) {
  const parsed = schemas[type].safeParse(input);
  if (!parsed.success) return fail(type === 'acknowledge' ? 'Проверете името, версията, потвърждението и рисувания подпис.' : 'Проверете заглавието, съдържанието, срока и избраната версия.');
  const d = parsed.data, now = new Date().toISOString();
  if (type === 'acknowledge' && d.method === 'provider-signature') return fail('Електронното подписване чрез доставчик още не е свързано. Изберете рисуван подпис или само запознаване.', 409);
  const target = type === 'document' ? `document-${d.requestId}` : d.id;
  const original = await recordSnapshot(owner, target), old = original.record;
  const by = type === 'acknowledge' ? d.name : roles[d.actor as 'teacher' | 'admin'].name;
  let record: SchoolRecord, event: string;

  if (type === 'document') {
    if (old) {
      const same = old.kind === 'document' && old.status === 'draft' && ['title', 'content', 'category', 'due'].every(k => old[k] === d[k]) && JSON.stringify(old.files || []) === JSON.stringify(d.files);
      return same ? Response.json({ record: old }) : conflict();
    }
    if (!await fileRecords(owner, d.files)) return fail('Невалидни или повторени прикачени файлове.');
    record = { id: target, kind: 'document', title: d.title, content: d.content, category: d.category,
      due: d.due, files: d.files, status: 'draft', version: 1, revision: 1, studentId: 0,
      createdAt: now, updatedAt: now, createdBy: by, versions: [], events: [] };
    event = 'Създадена чернова на документ';
  } else {
    if (old?.kind !== 'document') return fail('Документът не е намерен.', 404);
    if (type === 'acknowledge') {
      if (documentVersion(old) !== d.version) return conflict();
      const drawingHash = d.signature ? await digest(new TextEncoder().encode(signatureHashInput(d.signature))) : undefined;
      if (old.status === 'acknowledged') {
        const method = old.ackMethod === 'drawn-signature' ? 'drawn-signature' : 'acknowledgment';
        return old.ackName === d.name && (!d.contentHash || old.contentHash === d.contentHash) && method === d.method && (method !== 'drawn-signature' || old.drawnSignature?.sha256 === drawingHash) ? Response.json({ record: old }) : conflict();
      }
      if (old.status !== 'pending') return fail('Тази версия не очаква потвърждение.', 409);
      if (old.contentHash && old.contentHash !== d.contentHash) return conflict();
      const attached = await fileRecords(owner, old.files || []);
      if (!attached) return fail('Приложение не е достъпно. Поискайте нова версия.', 409);
      const fileSnapshots = old.attachments || await attachments(owner, attached);
      const contentHash = old.contentHash || await digest(new TextEncoder().encode(documentHashInput(old.id, { ...old, attachments: fileSnapshots })));
      const hashFormat = old.hashFormat || (old.contentHash ? 'legacy-content-only' : 'eduo-document-v1');
      const receipt: Record<string, any> = { id: crypto.randomUUID(), documentId: old.id, version: documentVersion(old),
        contentHash, hashFormat, name: d.name, at: now, studentId: 0, method: d.method === 'drawn-signature' ? 'drawn-signature' : 'demo-acknowledgment' };
      if (drawingHash) {
        receipt.signatureHash = drawingHash;
        receipt.evidenceFormat = 'eduo-drawn-receipt-v1';
        receipt.evidenceHash = await digest(new TextEncoder().encode(drawnReceiptHashInput(receipt as any)));
      }
      record = { ...old, status: 'acknowledged', ackName: d.name, ackAt: now, ackMethod: receipt.method,
        ...(drawingHash ? { drawnSignature: { drawing: d.signature, sha256: drawingHash } } : {}),
        attachments: fileSnapshots, contentHash, hashFormat, receipt, revision: documentRevision(old) + 1, updatedAt: now };
      event = drawingHash ? 'Положен рисуван подпис върху точна версия на документ' : 'Потвърдено запознаване с точна версия на документ';
    } else {
      if (documentRevision(old) !== d.revision) return conflict();
      record = { ...old, revision: d.revision + 1, updatedAt: now };
      if (type === 'save-document-draft') {
        if (old.status !== 'draft' && !old.draft) return fail('Първо подгответе нова версия.', 409);
        if (!await fileRecords(owner, d.files)) return fail('Невалидни или повторени прикачени файлове.');
        const content = { title: d.title, content: d.content, category: d.category, due: d.due, files: d.files };
        if (old.status === 'draft') record = { ...record, ...content };
        else record.draft = { ...old.draft, ...content };
        event = 'Запазена чернова на документ';
      } else if (type === 'revise-document') {
        if (old.status === 'draft' || old.draft) return fail('Вече има чернова за редакция.', 409);
        record.draft = { title: old.title, content: old.content, category: old.category, due: old.due,
          files: old.files || [], version: documentVersion(old) + 1, startedAt: now };
        event = 'Подготвена нова версия на документ';
      } else if (type === 'discard-document-draft') {
        if (!old.draft) return fail('Няма отделна чернова за отказ.', 409);
        delete record.draft;
        event = 'Отказана чернова; предоставената версия е запазена';
      } else if (type === 'publish-document') {
        if (old.status !== 'draft' && !old.draft) return fail('Няма запазена чернова за предоставяне.', 409);
        const source = old.draft || old;
        const attached = await fileRecords(owner, source.files || []);
        if (!attached) return fail('Невалидно приложение към документа.');
        const fileSnapshots = await attachments(owner, attached);
        record = { ...record, title: source.title, content: source.content, category: source.category,
          due: source.due, files: source.files || [], attachments: fileSnapshots, version: source.version || 1,
          status: 'pending', publishedAt: now, publishedBy: by,
          versions: [...(old.versions || []), ...(old.status === 'draft' ? [] : [documentSnapshot(old)])] };
        for (const key of ['draft', 'ackName', 'ackAt', 'ackMethod', 'drawnSignature', 'receipt', 'withdrawnAt', 'withdrawalReason']) delete record[key];
        record.hashFormat = 'eduo-document-v1';
        record.contentHash = await digest(new TextEncoder().encode(documentHashInput(record.id, record)));
        event = 'Предоставена версия на документ за родителски преглед';
      } else {
        if (old.status !== 'pending') return fail('Само чакаща заявка може да бъде оттеглена.', 409);
        record = { ...record, status: 'withdrawn', withdrawnAt: now, withdrawalReason: d.reason };
        event = 'Оттеглена заявка за преглед на документ';
      }
    }
  }
  record.events = [...(record.events || []), { type, at: now, by, version: ['acknowledge', 'withdraw-document'].includes(type) ? documentVersion(record) : record.draft?.version || documentVersion(record), note: type === 'withdraw-document' ? d.reason : undefined }];
  if (new TextEncoder().encode(JSON.stringify(record)).length > 1000000) return fail('Документът е достигнал размера на историята за пилота. Запазените версии и подписи остават достъпни.', 409);
  if (!await saveGuarded(owner, record, original.payload, event)) return conflict();
  return Response.json({ record });
}
