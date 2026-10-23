import { z } from 'zod';
import { db, decrypt, encrypt, recordSnapshot } from './store';
import { schoolHome, schoolDirectorySnapshot, SchoolDirectoryError } from './school-directory-service';
import { directoryView, type SchoolDirectory, type SchoolMember } from './school-directory-data';
import { documentCategories } from './document-data';
import { drawnSignatureSchema, signatureHashInput } from './document-signature';
import { validDate } from './platform-service';
import { MAX_SCHOOL_DOCUMENTS, MAX_DOCUMENT_EDITIONS, MAX_DOCUMENT_RECIPIENTS, MAX_DOCUMENT_OPERATIONS, schoolDocumentReceiptId, schoolDocumentDraftView, schoolDocumentEditionView, schoolDocumentHashFormat, schoolDocumentHashInput, schoolReceiptHashInput, type SchoolDocument, type SchoolDocumentEdition, type DocumentRecipient, type SchoolDocumentReceipt, type SchoolReceiptView, type SchoolDocumentsHome, type SchoolDocumentSummary } from './school-document-data';
import type { ChatGPTUser } from '@/app/chatgpt-auth';
import type { ClassworkNotice } from './classwork-inbox-data';
import { attachmentViews, type ClassAttachment } from './classwork-data';
import { prepareDocumentFiles, saveDocumentFiles, verifyDocumentFiles, cleanDocumentFiles } from './school-document-files';
import { readWorkFile } from './classwork-files';
import { workFileChoiceError } from './classwork-file-policy';

function fail(status: number, message: string): never { throw new SchoolDirectoryError(status, message); }
const uuid = z.string().uuid(), positive = z.number().int().positive();
const base = { schoolId: uuid, id: uuid, directoryRevision: positive, requestId: uuid, confirmed: z.literal(true) };
const target = { ...base, revision: positive };
const fields = z.object({ title: z.string().trim().min(3).max(200), category: z.enum(documentCategories), content: z.string().trim().min(1).max(20000), due: validDate, signing: z.enum(['drawn-signature', 'acknowledgment']), pupilIds: z.array(uuid).min(1).max(100).refine(ids => new Set(ids).size === ids.length) }).strict();
const schemas = {
  'document-save': z.object({ ...base, revision: z.number().int().min(0), classId: uuid, fields, keepFileIds: z.array(uuid).max(3).refine(ids => new Set(ids).size === ids.length).optional() }).strict(),
  'document-publish': z.object(target).strict(),
  'document-revise': z.object(target).strict(),
  'document-discard': z.object(target).strict(),
  'document-withdraw': z.object({ ...target, reason: z.string().trim().min(5).max(500) }).strict(),
  'document-sign': z.object({ ...base, recipientId: uuid, edition: positive, contentHash: z.string().regex(/^[a-f0-9]{64}$/), method: z.enum(['drawn-signature', 'acknowledgment']), signature: drawnSignatureSchema.optional(), attachmentIds: z.array(uuid).max(3).optional() }).strict().superRefine((v, ctx) => {
    if (v.method === 'drawn-signature' ? !v.signature : !!v.signature) ctx.addIssue({ code: 'custom', message: 'Проверете рисувания подпис и избрания начин.' });
  }),
};
const scope = (id: string) => 'eduo-school:' + id;
const activeClass = (s: SchoolDirectory, id: string) => s.classes.some(c => c.id === id && !c.archived);
const activePupil = (s: SchoolDirectory, id: string) => s.pupils.find(p => p.id === id && !p.archived && activeClass(s, p.classId));
const member = (s: SchoolDirectory, id: string) => s.members.find(m => m.userId === id && m.status === 'active') || fail(403, 'Необходим е активен одобрен училищен акаунт.');
const staffClass = (s: SchoolDirectory, m: SchoolMember, classId: string) => activeClass(s, classId) && (m.role === 'admin' || m.role === 'teacher' && m.classIds.includes(classId));
const canManage = (s: SchoolDirectory, m: SchoolMember, d: SchoolDocument) => s.year === d.schoolYear && staffClass(s, m, d.classId) && (m.role === 'admin' || d.createdBy === m.userId);
function slots(s: SchoolDirectory, m: SchoolMember, d: SchoolDocument, e: SchoolDocumentEdition) {
  return e.recipients.filter(r => m.role === 'admin' || m.role === 'teacher' && d.createdBy === m.userId && staffClass(s, m, d.classId) && activePupil(s, r.pupilId)?.classId === d.classId || m.role === 'parent' && r.parentId === m.userId && m.pupilIds.includes(r.pupilId) && !!activePupil(s, r.pupilId));
}
function canRead(s: SchoolDirectory, m: SchoolMember, d: SchoolDocument) {
  return m.role === 'admin' || m.role === 'teacher' && d.createdBy === m.userId && staffClass(s, m, d.classId) || m.role === 'parent' && d.editions.some(e => slots(s, m, d, e).length > 0);
}
function canSign(s: SchoolDirectory, m: SchoolMember, d: SchoolDocument, e: SchoolDocumentEdition, r: DocumentRecipient) {
  return m.role === 'parent' && r.parentId === m.userId && m.pupilIds.includes(r.pupilId) && activePupil(s, r.pupilId)?.classId === d.classId && activeClass(s, d.classId) && s.year === d.schoolYear && d.status === 'issued' && e.edition === d.editions.at(-1)?.edition;
}
async function documents(owner: string): Promise<SchoolDocument[]> {
  const rows = await db().prepare('SELECT payload FROM school_records WHERE owner=? AND kind=?').bind(owner, 'school-document').all<{ payload: string }>();
  return Promise.all(rows.results.map(async r => JSON.parse(new TextDecoder().decode(await decrypt(Uint8Array.from(atob(r.payload), c => c.charCodeAt(0)), owner)))));
}
async function receiptIds(owner: string) {
  const rows = await db().prepare('SELECT id FROM school_records WHERE owner=? AND kind=?').bind(owner, 'school-document-receipt').all<{ id: string }>();
  return new Set(rows.results.filter(r => r.id.startsWith('school-doc-receipt:')).map(r => r.id.slice('school-doc-receipt:'.length)));
}
async function hash(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), n => n.toString(16).padStart(2, '0')).join(''); }
async function seal(owner: string, data: unknown) { const bytes = await encrypt(new TextEncoder().encode(JSON.stringify(data)), owner); let raw = ''; for (const b of bytes) raw += String.fromCharCode(b); return btoa(raw); }
function summary(s: SchoolDirectory, m: SchoolMember, d: SchoolDocument, signed: Set<string>): SchoolDocumentSummary {
  const e = m.role === 'parent' ? d.editions.filter(e => slots(s, m, d, e).length).at(-1) : d.editions.at(-1), recipients = e ? slots(s, m, d, e) : [];
  const retained = !!e && e.edition !== d.editions.at(-1)?.edition;
  return { id: d.id, classId: d.classId, className: d.className, schoolYear: d.schoolYear, revision: d.revision, status: m.role === 'parent' ? e?.withdrawnAt ? 'withdrawn' : 'issued' : d.status, authorName: d.authorName, updatedAt: m.role === 'parent' ? e?.withdrawnAt || e!.publishedAt : d.updatedAt, title: e?.title || d.draft?.title || '', due: e?.due || d.draft?.due || '', signing: e?.signing || d.draft!.signing, edition: e?.edition || 0, expected: recipients.length, completed: recipients.filter(r => signed.has(r.id)).length, canManage: canManage(s, m, d), hasDraft: canManage(s, m, d) && !!d.draft, retained, attachmentCount: (e ? e.attachments || [] : d.draft?.attachments || []).length };
}
const receiptView = ({ kind, parentId, requestId, fingerprint, ...view }: SchoolDocumentReceipt): SchoolReceiptView => view;

export async function schoolDocumentDownload(user: ChatGPTUser, input: { schoolId: string; documentId: string; fileId: string; edition?: number; draftRevision?: number }) {
  const d = z.object({ schoolId: uuid, documentId: uuid, fileId: uuid, edition: positive.optional(), draftRevision: positive.optional() }).strict().refine(v => (v.edition !== undefined) !== (v.draftRevision !== undefined)).parse(input);
  const saved = await schoolDirectorySnapshot(d.schoolId); if (!saved) fail(404, 'Училището не е намерено.');
  const s = saved.state, m = member(s, user.userId), owner = scope(s.schoolId), snapshot = await recordSnapshot(owner, d.documentId), doc = snapshot.record as unknown as SchoolDocument | null;
  if (doc?.kind !== 'school-document' || !canRead(s, m, doc)) fail(404, 'Документът не е достъпен.');
  let files: ClassAttachment[];
  if (d.draftRevision !== undefined) {
    if (!canManage(s, m, doc) || !doc.draft) fail(403, 'Черновите приложения са само за автора и администратора.');
    if (doc.revision !== d.draftRevision) fail(409, 'Черновата е променена. Обновете преди изтегляне.');
    files = doc.draft.attachments || [];
  } else {
    const e = doc.editions.find(e => e.edition === d.edition);
    if (!e || m.role === 'parent' && !slots(s, m, doc, e).length) fail(404, 'Версията не е достъпна.');
    files = e.attachments || [];
  }
  const file = files.find(f => f.id === d.fileId); if (!file) fail(404, 'Файлът не е част от тази версия.');
  const bytes = await readWorkFile(file, owner);
  if ((await schoolDirectorySnapshot(s.schoolId))?.payload !== saved.payload || (await recordSnapshot(owner, doc.id)).payload !== snapshot.payload) fail(409, 'Документът или училищните права са променени. Обновете преди изтегляне.');
  return { file: attachmentViews([file])[0], bytes };
}

export async function schoolDocumentsHome(user: ChatGPTUser, schoolId?: string, requested?: string, requestedEdition?: number): Promise<SchoolDocumentsHome> {
  if (requested) uuid.parse(requested); if (requestedEdition !== undefined) positive.parse(requestedEdition);
  const h = await schoolHome(user, schoolId), v = h.current;
  const home: SchoolDocumentsHome = { writable: true, preview: false, schools: h.schools, context: v ? { school: v.school, self: v.self ? { userId: v.self.userId, name: v.self.name, role: v.self.role, status: v.self.status } : null, status: v.self?.status || v.request?.status || 'pending', classes: [], pupils: [] } : null, documents: [], parentCounts: [], canCreate: false, capacityReached: false };
  if (!v || v.self?.status !== 'active') { if (requested) fail(403, 'Няма активен достъп до документа.'); return home; }
  const saved = await schoolDirectorySnapshot(v.school.id); if (!saved) fail(404, 'Училището не е намерено.');
  const s = saved.state, m = member(s, user.userId), view = directoryView(s, m.userId)!, owner = scope(s.schoolId);
  home.context = { school: view.school, self: { userId: m.userId, name: m.name, role: m.role, status: m.status }, status: 'active', classes: view.classes, pupils: view.pupils };
  const [all, signed, ledger] = await Promise.all([documents(owner), receiptIds(owner), recordSnapshot(owner, 'school-document-ledger')]);
  home.capacityReached = Math.max(all.length, Number(ledger.record?.count) || 0) >= MAX_SCHOOL_DOCUMENTS;
  home.canCreate = !home.capacityReached && s.classes.some(c => staffClass(s, m, c.id));
  if (m.role === 'teacher' || m.role === 'admin') home.parentCounts = view.pupils.filter(p => !p.archived && staffClass(s, m, p.classId)).map(p => ({ pupilId: p.id, count: s.members.filter(parent => parent.status === 'active' && parent.role === 'parent' && parent.pupilIds.includes(p.id)).length }));
  home.documents = all.filter(d => canRead(s, m, d)).map(d => summary(s, m, d, signed)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  if (requested) {
    const d = all.find(d => d.id === requested && canRead(s, m, d)); if (!d) fail(404, 'Документът не е достъпен за този акаунт.');
    const visible = d.editions.filter(e => m.role === 'admin' || m.role === 'teacher' || slots(s, m, d, e).length);
    const e = requestedEdition ? visible.find(e => e.edition === requestedEdition) : visible.at(-1);
    if (requestedEdition && !e) fail(404, 'Версията не е достъпна.');
    const selected = e ? slots(s, m, d, e) : [];
    const receipts = await Promise.all(selected.map(r => recordSnapshot(owner, schoolDocumentReceiptId(r.id))));
    home.detail = { document: summary(s, m, d, signed), ...(canManage(s, m, d) && d.draft ? { draft: schoolDocumentDraftView(d.draft) } : {}), edition: e ? schoolDocumentEditionView(e) : null, history: visible.map(e => ({ edition: e.edition, title: e.title, publishedAt: e.publishedAt, withdrawn: !!e.withdrawnAt, attachmentCount: (e.attachments || []).length })), recipients: selected.map(({ parentId, ...r }, i) => {
      const receipt = receipts[i].record as unknown as SchoolDocumentReceipt | null;
      if (receipt && (receipt.kind !== 'school-document-receipt' || receipt.documentId !== d.id || receipt.edition !== e!.edition || receipt.parentId !== parentId || receipt.pupilId !== r.pupilId)) fail(409, 'Разписката не съответства на заявката.');
      return { ...r, canSign: !receipt && canSign(s, m, d, e!, selected[i]), ...(receipt ? { receipt: receiptView(receipt) } : {}) };
    }) };
  }
  if ((await schoolDirectorySnapshot(s.schoolId))?.payload !== saved.payload) fail(409, 'Училищните права са променени. Обновете документите.');
  return home;
}

// No document text, drawings or other families' identities enter the inbox.
export async function schoolDocumentNotices(s: SchoolDirectory, m: SchoolMember): Promise<ClassworkNotice[]> {
  if (m.role !== 'parent') return [];
  const owner = scope(s.schoolId), [all, signed] = await Promise.all([documents(owner), receiptIds(owner)]);
  return all.filter(d => canRead(s, m, d)).flatMap(d => {
    const e = d.editions.at(-1); if (!e) return [];
    return slots(s, m, d, e).map(r => ({ id: `document:${d.id}:${e.edition}:${r.pupilId}:${d.status === 'withdrawn' ? 'withdrawn' : 'issued'}`, kind: 'document' as const, title: d.status === 'withdrawn' ? 'Документът е оттеглен' : 'Документ за родителски преглед', summary: 'Отвори точната версия и личната заявка за подпис или запознаване.', at: e.withdrawnAt || e.publishedAt, assignmentId: '', assignmentTitle: e.title, subject: 'Документи', classId: d.classId, className: d.className, documentId: d.id, pupilId: r.pupilId, pupilName: r.pupilName, unread: true, needsAction: !signed.has(r.id) && canSign(s, m, d, e, r) }));
  });
}

async function commit(owner: string, record: { id: string; kind: string }, previous: string | null, deps: { id: string; payload: string | null }[], user: ChatGPTUser, action: string, actorName: string, ledger?: { payload: string | null; count: number; revision: number }) {
  const at = new Date().toISOString(), payload = await seal(owner, record), args: unknown[] = [];
  let guard = '';
  for (const dep of deps) { guard += dep.payload === null ? ' AND NOT EXISTS (SELECT 1 FROM school_records WHERE owner=? AND id=?)' : ' AND EXISTS (SELECT 1 FROM school_records WHERE owner=? AND id=? AND payload=?)'; args.push(owner, dep.id, ...(dep.payload === null ? [] : [dep.payload])); }
  const change = previous === null ? db().prepare('INSERT OR IGNORE INTO school_records(owner,id,kind,payload,updated_at) SELECT ?,?,?,?,? WHERE 1=1' + guard).bind(owner, record.id, record.kind, payload, at, ...args) : db().prepare('UPDATE school_records SET payload=?,updated_at=? WHERE owner=? AND id=? AND payload=?' + guard).bind(payload, at, owner, record.id, previous, ...args);
  const writes = [change], exists = 'EXISTS (SELECT 1 FROM school_records WHERE owner=? AND id=? AND payload=?)';
  if (ledger) {
    const index = { id: 'school-document-ledger', kind: 'school-document-ledger', count: ledger.count + 1, revision: ledger.revision + 1 };
    writes.push(db().prepare('INSERT INTO school_records(owner,id,kind,payload,updated_at) SELECT ?,?,?,?,? WHERE ' + exists + ' ON CONFLICT(owner,id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').bind(owner, index.id, index.kind, await seal(owner, index), at, owner, record.id, payload));
  }
  const audit = { id: crypto.randomUUID(), kind: 'school-audit', event: action, actor: actorName, actorId: user.userId, at, detail: record.id };
  writes.push(db().prepare('INSERT INTO school_records(owner,id,kind,payload,updated_at) SELECT ?,?,?,?,? WHERE ' + exists).bind(owner, audit.id, audit.kind, await seal(owner, audit), at, owner, record.id, payload));
  if ((await db().batch(writes))[0].meta.changes !== 1) fail(409, 'Документът, заявката или училищните права са променени. Обновете данните.');
}

export async function schoolDocumentCommand(user: ChatGPTUser, type: string, input: unknown, uploads: File[] = []) {
  const schema = Object.hasOwn(schemas, type) ? schemas[type as keyof typeof schemas] : null; if (!schema) fail(400, 'Непознато действие за документ.');
  const d: any = schema.parse(input), saved = await schoolDirectorySnapshot(d.schoolId); if (!saved) fail(404, 'Училището не е намерено.');
  const s = saved.state, m = member(s, user.userId), owner = scope(s.schoolId), target = await recordSnapshot(owner, d.id), old = target.record as unknown as SchoolDocument | null;
  if (old && old.kind !== 'school-document') fail(409, 'Идентификаторът принадлежи на друг запис.');
  if (old && !canRead(s, m, old)) fail(404, 'Документът не е достъпен.');
  if (uploads.length && type !== 'document-save') fail(400, 'Файлове се приемат само при запазване на чернова.');
  if (type === 'document-save' && (!['teacher', 'admin'].includes(m.role) || !staffClass(s, m, d.classId))) fail(403, 'Само автор за назначен клас или администратор може да качва приложения.');
  const preparedFiles = type === 'document-save' ? await prepareDocumentFiles(uploads) : [];
  const { requestId, directoryRevision, schoolId, ...content } = d;
  const fingerprint = await hash(JSON.stringify([type, preparedFiles.length ? { ...content, uploadedFiles: preparedFiles.map(({ bytes, ...f }) => f) } : content]));
  if (type === 'document-sign') {
    if (!old) fail(404, 'Документът не е намерен.');
    const e = old.editions.find(e => e.edition === d.edition), r = e?.recipients.find(r => r.id === d.recipientId && r.parentId === m.userId);
    if (!e || !r || !slots(s, m, old, e).some(slot => slot.id === r.id)) fail(403, 'Заявката не принадлежи на разрешен родител и дете.');
    const existing = await recordSnapshot(owner, schoolDocumentReceiptId(r.id)), receipt = existing.record as unknown as SchoolDocumentReceipt | null;
    if (receipt) {
      if (receipt.kind !== 'school-document-receipt' || receipt.parentId !== m.userId || receipt.requestId !== d.requestId || receipt.fingerprint !== fingerprint) fail(409, 'За тази заявка вече има различна разписка.');
      return schoolDocumentsHome(user, s.schoolId, old.id, e.edition);
    }
    if (s.revision !== d.directoryRevision) fail(409, 'Училищните права са променени. Обновете данните.');
    if (!canSign(s, m, old, e, r)) fail(403, 'Тази версия вече не може да бъде подписана от този акаунт.');
    if (e.contentHash !== d.contentHash || e.signing !== d.method) fail(409, 'Прегледайте точната версия и изисквания начин за потвърждение.');
    const attachmentIds = (e.attachments || []).map(f => f.id);
    if (attachmentIds.length && !d.attachmentIds || d.attachmentIds && JSON.stringify(d.attachmentIds) !== JSON.stringify(attachmentIds)) fail(409, 'Прегледайте точната версия и всички нейни приложения в актуалния формуляр.');
    await verifyDocumentFiles(e.attachments || [], owner);
    const result: SchoolDocumentReceipt = { id: schoolDocumentReceiptId(r.id), kind: 'school-document-receipt', schoolId: s.schoolId, documentId: old.id, edition: e.edition, pupilId: r.pupilId, pupilName: r.pupilName, parentId: m.userId, name: m.name, at: new Date().toISOString(), method: d.method, contentHash: e.contentHash, hashFormat: schoolDocumentHashFormat(e), ...(d.signature ? { drawing: d.signature, signatureHash: await hash(signatureHashInput(d.signature)) } : {}), evidenceHash: '', evidenceFormat: 'eduo-school-receipt-v1', requestId: d.requestId, fingerprint };
    result.evidenceHash = await hash(schoolReceiptHashInput(result));
    await commit(owner, result, null, [{ id: 'directory', payload: saved.payload }, { id: old.id, payload: target.payload }], user, 'school-document-signed', m.name);
    return schoolDocumentsHome(user, s.schoolId, old.id, e.edition);
  }
  if (!['admin', 'teacher'].includes(m.role)) fail(403, 'Само одобрен учител или администратор може да подготвя документи.');
  const prior = old?.operations.find(o => o.id === d.requestId);
  if (prior) { if (prior.actorId !== m.userId || prior.fingerprint !== fingerprint) fail(409, 'Заявката вече е използвана с други данни.'); return schoolDocumentsHome(user, s.schoolId, old!.id); }
  if (s.revision !== d.directoryRevision) fail(409, 'Училищните права са променени. Обновете документите.');
  const pendingKeys: string[] = [];
  try {
  let record: SchoolDocument, ledger: { payload: string | null; count: number; revision: number } | undefined;
  const now = new Date().toISOString();
  if (!old) {
    if (type !== 'document-save' || d.revision !== 0) fail(404, 'Документът не е намерен.');
    if (!staffClass(s, m, d.classId)) fail(403, 'Изберете активен назначен клас.');
    const index = await recordSnapshot(owner, 'school-document-ledger');
    if (index.record && (index.record.kind !== 'school-document-ledger' || !Number.isInteger(index.record.count) || index.record.count < 0)) fail(409, 'Индексът на документите е невалиден.');
    const count = index.record?.count ?? (await db().prepare('SELECT COUNT(*) AS n FROM school_records WHERE owner=? AND kind=?').bind(owner, 'school-document').first<{ n: number }>())?.n ?? 0;
    if (count >= MAX_SCHOOL_DOCUMENTS) fail(409, 'Капацитетът за нови документи е достигнат. Предишните документи се запазват.');
    ledger = { payload: index.payload, count, revision: index.record?.revision || 0 };
    record = { id: d.id, kind: 'school-document', classId: d.classId, className: s.classes.find(c => c.id === d.classId)!.name, schoolYear: s.year, createdBy: m.userId, authorName: m.name, createdAt: now, updatedAt: now, revision: 0, status: 'draft', editions: [], operations: [] };
  } else {
    if (!canManage(s, m, old)) fail(403, 'Само авторът за текущ назначен клас или администратор може да промени документа.');
    if (old.revision !== d.revision) fail(409, 'Има по-нова версия на документа. Обновете преди промяна.');
    if (old.operations.length >= MAX_DOCUMENT_OPERATIONS - (type === 'document-withdraw' ? 0 : 1)) fail(409, 'Достигнат е броят промени. Историята се запазва и има резерв за оттегляне.');
    record = structuredClone(old);
  }
  if (type === 'document-save') {
    if (record.classId !== d.classId || record.status !== 'draft' && !record.draft) fail(409, 'Подгответе отделна нова версия. Класът на документа не се променя.');
    if (d.fields.pupilIds.some((id: string) => activePupil(s, id)?.classId !== record.classId)) fail(409, 'Изберете текущи активни ученици от този клас.');
    const existing = record.draft?.attachments || [], keepIds: string[] = d.keepFileIds ?? existing.map(f => f.id);
    if (keepIds.some(id => !existing.some(f => f.id === id))) fail(400, 'Запазените приложения не принадлежат на текущата чернова.');
    const retained = keepIds.map(id => existing.find(f => f.id === id)!);
    const fileError = workFileChoiceError([...retained, ...preparedFiles].map(f => ({ name: f.name, size: f.size, type: f.mime })), 'една версия');
    if (fileError) fail(400, fileError);
    record.draft = { ...d.fields, attachments: [...retained, ...await saveDocumentFiles(preparedFiles, owner, pendingKeys)] };
  } else if (type === 'document-revise') {
    if (record.draft || !record.editions.length || record.editions.length >= MAX_DOCUMENT_EDITIONS) fail(409, 'Вече има чернова или е достигнат броят версии.');
    const e = record.editions.at(-1)!;
    record.draft = { title: e.title, category: e.category, content: e.content, due: e.due, signing: e.signing, pupilIds: [...new Set(e.recipients.map(r => r.pupilId))], attachments: e.attachments || [] };
  } else if (type === 'document-discard') {
    if (!record.draft || record.status === 'draft') fail(409, 'Няма отделна чернова за отказ.');
    delete record.draft;
  } else if (type === 'document-publish') {
    if (!record.draft || record.editions.length >= MAX_DOCUMENT_EDITIONS) fail(409, 'Няма запазена чернова или е достигнат броят версии.');
    await verifyDocumentFiles(record.draft.attachments || [], owner);
    const { pupilIds, ...fields } = record.draft, recipients: DocumentRecipient[] = [];
    for (const id of pupilIds) {
      const p = activePupil(s, id); if (!p || p.classId !== record.classId) fail(409, 'Списъкът на класа е променен. Обновете черновата.');
      const parents = s.members.filter(parent => parent.role === 'parent' && parent.status === 'active' && parent.pupilIds.includes(p.id));
      if (!parents.length) fail(409, `${p.name} няма активен одобрен родител. Обновете получателите преди предоставяне.`);
      recipients.push(...parents.map(parent => ({ id: crypto.randomUUID(), pupilId: p.id, pupilName: p.name, parentId: parent.userId, parentName: parent.name })));
    }
    if (recipients.length > MAX_DOCUMENT_RECIPIENTS) fail(409, 'Разделете документа на по-малки групи до 80 родителски заявки.');
    const e: SchoolDocumentEdition = { ...fields, attachments: fields.attachments || [], hashFormat: 'eduo-school-document-v2', edition: record.editions.length + 1, recipients, recipientHash: await hash(JSON.stringify(recipients)), contentHash: '', publishedAt: now, publishedBy: m.name };
    e.contentHash = await hash(schoolDocumentHashInput(s.schoolId, record, e));
    record.editions.push(e); record.status = 'issued'; delete record.draft;
  } else {
    if (record.status !== 'issued') fail(409, 'Само предоставена заявка може да се оттегли.');
    record.status = 'withdrawn'; Object.assign(record.editions.at(-1)!, { withdrawnAt: now, withdrawalReason: d.reason });
  }
  record.revision++; record.updatedAt = now;
  record.operations.push({ id: d.requestId, actorId: m.userId, fingerprint, type, at: now, ...(d.reason ? { reason: d.reason } : {}) });
  if (new TextEncoder().encode(JSON.stringify(record)).length > (type === 'document-withdraw' ? 900000 : 880000)) fail(409, 'Историята е достигнала размера за пилота. Предишните версии се запазват.');
  await commit(owner, record, target.payload, [{ id: 'directory', payload: saved.payload }, ...(ledger ? [{ id: 'school-document-ledger', payload: ledger.payload }] : [])], user, type, m.name, ledger);
  return schoolDocumentsHome(user, s.schoolId, record.id);
  } catch (e) { await cleanDocumentFiles(owner, d.id, pendingKeys); throw e; }
}
