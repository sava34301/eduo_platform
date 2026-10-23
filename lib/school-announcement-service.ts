import { z } from 'zod';
import { db, decrypt, encrypt, recordSnapshot } from './store';
import { schoolHome, schoolDirectorySnapshot, SchoolDirectoryError } from './school-directory-service';
import { directoryView, type SchoolDirectory, type SchoolMember } from './school-directory-data';
import { announcementReadId, announcementHashInput, type AnnouncementFields, type AnnouncementEdition, type SchoolAnnouncement, type AnnouncementRead, type SchoolAnnouncementsHome, type AnnouncementSummary } from './school-announcement-data';
import type { ClassworkNotice } from './classwork-inbox-data';
import type { ChatGPTUser } from '@/app/chatgpt-auth';

function fail(status: number, message: string): never { throw new SchoolDirectoryError(status, message); }
const uuid = z.string().uuid(), positive = z.number().int().positive(), base = { schoolId: uuid, id: uuid, directoryRevision: positive, requestId: uuid, confirmed: z.literal(true) };
const fields = z.object({ title: z.string().trim().min(3).max(180), body: z.string().trim().min(5).max(10000), priority: z.enum(['normal', 'important']), roles: z.array(z.enum(['student', 'parent', 'teacher'])).min(1).max(3).refine(v => new Set(v).size === v.length) }).strict();
const target = { ...base, revision: positive };
const schemas = {
  'announcement-save': z.object({ ...base, revision: z.number().int().min(0), classId: uuid.nullable(), fields }).strict(),
  'announcement-publish': z.object(target).strict(),
  'announcement-revise': z.object(target).strict(),
  'announcement-discard': z.object(target).strict(),
  'announcement-withdraw': z.object({ ...target, reason: z.string().trim().min(5).max(500) }).strict(),
  'announcement-read': z.object({ ...base, edition: positive, contentHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
};
const scope = (id: string) => 'eduo-school:' + id;
const activeClass = (s: SchoolDirectory, id: string) => s.classes.some(c => c.id === id && !c.archived);
const member = (s: SchoolDirectory, id: string) => s.members.find(m => m.userId === id && m.status === 'active') || fail(403, 'Необходим е активен одобрен училищен акаунт.');
function scopeEligible(s: SchoolDirectory, m: SchoolMember, a: Pick<SchoolAnnouncement, 'classId' | 'schoolYear'>) {
  if (m.status !== 'active' || a.schoolYear !== s.year || a.classId && !activeClass(s, a.classId)) return false;
  if (m.role === 'teacher') return m.classIds.some(id => activeClass(s, id) && (!a.classId || id === a.classId));
  return ['student', 'parent'].includes(m.role) && s.pupils.some(p => !p.archived && activeClass(s, p.classId) && m.pupilIds.includes(p.id) && (!a.classId || p.classId === a.classId));
}
function staffAuthority(s: SchoolDirectory, m: SchoolMember, a: SchoolAnnouncement) { return m.role === 'admin' || m.role === 'teacher' && m.userId === a.authorId && !!a.classId && activeClass(s, a.classId) && m.classIds.includes(a.classId); }
function manages(s: SchoolDirectory, m: SchoolMember, a: SchoolAnnouncement) { return s.year === a.schoolYear && (!a.classId || activeClass(s, a.classId)) && staffAuthority(s, m, a); }
function ownSlot(s: SchoolDirectory, m: SchoolMember, a: SchoolAnnouncement, e: AnnouncementEdition) { return scopeEligible(s, m, a) ? e.recipients.find(r => r.userId === m.userId && r.role === m.role) : undefined; }
function canRead(s: SchoolDirectory, m: SchoolMember, a: SchoolAnnouncement) { return staffAuthority(s, m, a) || a.editions.some(e => ownSlot(s, m, a, e)); }
function recipients(s: SchoolDirectory, a: SchoolAnnouncement, draft: AnnouncementFields) { return s.members.filter(m => m.userId !== a.authorId && draft.roles.includes(m.role as any) && scopeEligible(s, m, a)); }
function trackedSlots(s: SchoolDirectory, m: SchoolMember, a: SchoolAnnouncement, e: AnnouncementEdition) { return e.recipients.filter(r => m.role === 'admin' || staffAuthority(s, m, a) && s.members.some(other => other.userId === r.userId && other.role === r.role && scopeEligible(s, other, a))); }
async function hash(text: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join(''); }
async function seal(owner: string, record: unknown) { const bytes = await encrypt(new TextEncoder().encode(JSON.stringify(record)), owner); let raw = ''; for (const b of bytes) raw += String.fromCharCode(b); return btoa(raw); }
async function records(owner: string): Promise<SchoolAnnouncement[]> { const rows = await db().prepare('SELECT payload FROM school_records WHERE owner=? AND kind=?').bind(owner, 'school-announcement').all<{ payload: string }>(); return Promise.all(rows.results.map(async r => JSON.parse(new TextDecoder().decode(await decrypt(Uint8Array.from(atob(r.payload), c => c.charCodeAt(0)), owner))))); }
async function readIds(owner: string) { const rows = await db().prepare('SELECT id FROM school_records WHERE owner=? AND kind=?').bind(owner, 'school-announcement-read').all<{ id: string }>(); return new Set(rows.results.map(r => r.id)); }
function readReceipt(record: unknown, a: SchoolAnnouncement, e: AnnouncementEdition, slot: AnnouncementEdition['recipients'][number]): AnnouncementRead | null {
  if (!record) return null;
  const r = record as AnnouncementRead;
  if (r.kind !== 'school-announcement-read' || r.announcementId !== a.id || r.edition !== e.edition || r.userId !== slot.userId || r.contentHash !== e.contentHash) fail(409, 'Потвърждението не съответства на тази версия и получател.');
  return r;
}
function summary(s: SchoolDirectory, m: SchoolMember, a: SchoolAnnouncement, e: AnnouncementEdition | undefined, seen: Set<string>): AnnouncementSummary {
  const staff = staffAuthority(s, m, a), slots = e ? staff ? trackedSlots(s, m, a, e) : [ownSlot(s, m, a, e)!] : [], own = e && ownSlot(s, m, a, e), retained = !!e && e.edition !== a.editions.at(-1)?.edition;
  return { id: a.id, classId: a.classId, className: a.className, schoolYear: a.schoolYear, title: e?.title || a.draft!.title, priority: e?.priority || a.draft!.priority, authorName: a.authorName, revision: a.revision, edition: e?.edition || 0, status: e ? e.withdrawnAt ? 'withdrawn' : 'issued' : 'draft', updatedAt: staff ? a.updatedAt : e!.withdrawnAt || e!.at, canManage: manages(s, m, a), hasDraft: manages(s, m, a) && !!a.draft, retained, read: !!own && seen.has(announcementReadId(own.id)), expected: slots.length, completed: slots.filter(r => seen.has(announcementReadId(r.id))).length };
}
export async function schoolAnnouncementsHome(user: ChatGPTUser, schoolId?: string, selected?: string, edition?: number): Promise<SchoolAnnouncementsHome> {
  if (selected) uuid.parse(selected); if (edition !== undefined) positive.parse(edition);
  const h = await schoolHome(user, schoolId), v = h.current;
  const home: SchoolAnnouncementsHome = { writable: true, preview: false, schools: h.schools, context: v ? { school: v.school, self: v.self ? { userId: v.self.userId, name: v.self.name, role: v.self.role, status: v.self.status } : null, status: v.self?.status || v.request?.status || 'pending', classes: [], pupils: [] } : null, announcements: [], canCreate: false, capacityReached: false };
  if (!v || v.self?.status !== 'active') { if (selected) fail(403, 'Няма активен достъп до съобщението.'); return home; }
  const saved = await schoolDirectorySnapshot(v.school.id); if (!saved) fail(404, 'Училището не е намерено.');
  const s = saved.state, m = member(s, user.userId), view = directoryView(s, m.userId)!, owner = scope(s.schoolId);
  home.context = { school: view.school, self: { userId: m.userId, name: m.name, role: m.role, status: m.status }, status: 'active', classes: view.classes, pupils: view.pupils };
  const [all, seen, ledger] = await Promise.all([records(owner), readIds(owner), recordSnapshot(owner, 'school-announcement-ledger')]);
  home.capacityReached = Math.max(all.length, Number(ledger.record?.count) || 0) >= 200;
  home.canCreate = !home.capacityReached && (m.role === 'admin' || m.role === 'teacher' && m.classIds.some(id => activeClass(s, id)));
  for (const a of all.filter(a => canRead(s, m, a))) {
    const staff = staffAuthority(s, m, a), visible = a.editions.filter(e => staff || ownSlot(s, m, a, e)), latest = visible.at(-1);
    home.announcements.push(summary(s, m, a, latest, seen));
    if (selected !== a.id) continue;
    const e = edition !== undefined ? visible.find(e => e.edition === edition) : latest;
    if (edition !== undefined && !e) fail(404, 'Версията не е достъпна.');
    const own = e && ownSlot(s, m, a, e), allowed = e && staff ? trackedSlots(s, m, a, e) : [], snapshots = await Promise.all(allowed.map(r => recordSnapshot(owner, announcementReadId(r.id))));
    let ownRead: AnnouncementRead | null = null;
    if (own) ownRead = readReceipt((await recordSnapshot(owner, announcementReadId(own.id))).record, a, e!, own);
    const receiptViews = allowed.map((slot, i) => readReceipt(snapshots[i].record, a, e!, slot));
    const { recipients: hiddenRecipients, ...condition } = e || {} as AnnouncementEdition;
    const audience = a.draft && manages(s, m, a) ? recipients(s, a, a.draft) : null;
    home.detail = { announcement: summary(s, m, a, latest, seen), ...(manages(s, m, a) && a.draft ? { draft: a.draft } : {}), edition: e ? condition as Omit<AnnouncementEdition, 'recipients'> : null, history: visible.map(e => ({ edition: e.edition, title: e.title, at: e.at, withdrawn: !!e.withdrawnAt })), recipients: allowed.map((r, i) => ({ id: r.id, name: r.name, role: r.role, ...(receiptViews[i] ? { readAt: receiptViews[i]!.at } : {}) })), ...(ownRead ? { ownReadAt: ownRead.at } : {}), canAcknowledge: !!own && !ownRead && a.status === 'issued' && e === a.editions.at(-1) && !e?.withdrawnAt, ...(audience ? { audience: { total: audience.length, student: audience.filter(m => m.role === 'student').length, parent: audience.filter(m => m.role === 'parent').length, teacher: audience.filter(m => m.role === 'teacher').length } } : {}) };
  }
  home.announcements.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  if (selected && !home.detail) fail(404, 'Съобщението не е достъпно.');
  if ((await schoolDirectorySnapshot(s.schoolId))?.payload !== saved.payload) fail(409, 'Училищните права са променени. Обновете съобщенията.');
  return home;
}
async function commit(owner: string, record: { id: string; kind: string }, previous: string | null, dependencies: { id: string; payload: string | null }[], user: ChatGPTUser, name: string, action: string, ledger?: { count: number; revision: number }) {
  const now = new Date().toISOString(), payload = await seal(owner, record), args: unknown[] = [];
  const guard = dependencies.map(d => { args.push(owner, d.id, ...(d.payload === null ? [] : [d.payload])); return d.payload === null ? ' AND NOT EXISTS (SELECT 1 FROM school_records WHERE owner=? AND id=?)' : ' AND EXISTS (SELECT 1 FROM school_records WHERE owner=? AND id=? AND payload=?)'; }).join('');
  const change = previous === null ? db().prepare('INSERT OR IGNORE INTO school_records(owner,id,kind,payload,updated_at) SELECT ?,?,?,?,? WHERE 1=1' + guard).bind(owner, record.id, record.kind, payload, now, ...args) : db().prepare('UPDATE school_records SET payload=?,updated_at=? WHERE owner=? AND id=? AND payload=?' + guard).bind(payload, now, owner, record.id, previous, ...args);
  const writes = [change], success = 'EXISTS (SELECT 1 FROM school_records WHERE owner=? AND id=? AND payload=?)';
  if (ledger) { const index = { id: 'school-announcement-ledger', kind: 'school-announcement-ledger', count: ledger.count + 1, revision: ledger.revision + 1 }; writes.push(db().prepare('INSERT INTO school_records(owner,id,kind,payload,updated_at) SELECT ?,?,?,?,? WHERE ' + success + ' ON CONFLICT(owner,id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').bind(owner, index.id, index.kind, await seal(owner, index), now, owner, record.id, payload)); }
  const audit = { id: crypto.randomUUID(), kind: 'school-audit', event: action, actor: name, actorId: user.userId, at: now, detail: record.id };
  writes.push(db().prepare('INSERT INTO school_records(owner,id,kind,payload,updated_at) SELECT ?,?,?,?,? WHERE ' + success).bind(owner, audit.id, audit.kind, await seal(owner, audit), now, owner, record.id, payload));
  if ((await db().batch(writes))[0].meta.changes !== 1) fail(409, 'Съобщението или училищните права са променени. Обновете данните.');
}
export async function schoolAnnouncementCommand(user: ChatGPTUser, type: string, input: unknown): Promise<SchoolAnnouncementsHome> {
  const schema = Object.hasOwn(schemas, type) ? schemas[type as keyof typeof schemas] : null; if (!schema) fail(400, 'Непознато действие за съобщение.');
  const d: any = schema.parse(input), saved = await schoolDirectorySnapshot(d.schoolId); if (!saved) fail(404, 'Училището не е намерено.');
  const s = saved.state, m = member(s, user.userId), owner = scope(s.schoolId), snapshot = await recordSnapshot(owner, d.id), old = snapshot.record as unknown as SchoolAnnouncement | null;
  if (old && old.kind !== 'school-announcement') fail(409, 'Идентификаторът е за друг вид запис.');
  if (old && !canRead(s, m, old)) fail(404, 'Съобщението не е достъпно.');
  const { schoolId, directoryRevision, requestId, ...content } = d, fingerprint = await hash(JSON.stringify([type, content]));
  if (type === 'announcement-read') {
    if (!old) fail(404, 'Съобщението не е намерено.');
    const e = old.editions.find(e => e.edition === d.edition), slot = e && ownSlot(s, m, old, e);
    if (!e || !slot) fail(403, 'Потвърждението е само за лично адресирана версия.');
    if (d.contentHash !== e.contentHash) fail(409, 'Прегледайте точния текст на съобщението.');
    const id = announcementReadId(slot.id), prior = await recordSnapshot(owner, id), receipt = prior.record as unknown as AnnouncementRead | null;
    if (receipt) { if (receipt.kind !== 'school-announcement-read' || receipt.userId !== m.userId || receipt.requestId !== d.requestId || receipt.fingerprint !== fingerprint) fail(409, 'Версията вече има друго потвърждение.'); return schoolAnnouncementsHome(user, s.schoolId, old.id, e.edition); }
    if (s.revision !== d.directoryRevision || old.status !== 'issued' || e !== old.editions.at(-1) || e.withdrawnAt) fail(409, 'Обновете съобщението преди потвърждение.');
    const record: AnnouncementRead = { id, kind: 'school-announcement-read', announcementId: old.id, edition: e.edition, userId: m.userId, contentHash: e.contentHash, at: new Date().toISOString(), requestId: d.requestId, fingerprint };
    await commit(owner, record, null, [{ id: 'directory', payload: saved.payload }, { id: old.id, payload: snapshot.payload }], user, m.name, type);
    return schoolAnnouncementsHome(user, s.schoolId, old.id, e.edition);
  }
  if (!['teacher', 'admin'].includes(m.role)) fail(403, 'Само одобрен учител или администратор може да създава съобщения.');
  const prior = old?.operations.find(o => o.id === d.requestId);
  if (prior) { if (prior.actorId !== m.userId || prior.fingerprint !== fingerprint) fail(409, 'Заявката вече е използвана за други данни.'); return schoolAnnouncementsHome(user, s.schoolId, old!.id); }
  if (s.revision !== d.directoryRevision) fail(409, 'Училищните права са променени. Обновете данните.');
  let a: SchoolAnnouncement, ledger: { count: number; revision: number } | undefined;
  const deps = [{ id: 'directory', payload: saved.payload }] as { id: string; payload: string | null }[];
  if (!old) {
    if (type !== 'announcement-save' || d.revision !== 0) fail(404, 'Съобщението не е намерено.');
    if (d.classId === null ? m.role !== 'admin' : !activeClass(s, d.classId) || m.role !== 'admin' && !m.classIds.includes(d.classId)) fail(403, 'Изберете назначен клас. Само администратор публикува за цялото училище.');
    const index = await recordSnapshot(owner, 'school-announcement-ledger');
    if (index.record && (index.record.kind !== 'school-announcement-ledger' || !Number.isInteger(index.record.count) || index.record.count < 0)) fail(409, 'Невалиден индекс на съобщенията.');
    const count = index.record?.count ?? (await db().prepare('SELECT COUNT(*) AS n FROM school_records WHERE owner=? AND kind=?').bind(owner, 'school-announcement').first<{ n: number }>())?.n ?? 0;
    if (count >= 200) fail(409, 'Достигнат е пилотният капацитет. Историята остава достъпна.');
    ledger = { count, revision: index.record?.revision || 0 }; deps.push({ id: 'school-announcement-ledger', payload: index.payload });
    a = { id: d.id, kind: 'school-announcement', classId: d.classId, className: d.classId ? s.classes.find(c => c.id === d.classId)!.name : 'Цялото училище', schoolYear: s.year, authorId: m.userId, authorName: m.name, revision: 0, status: 'draft', updatedAt: '', editions: [], operations: [] };
  } else { if (!manages(s, m, old)) fail(403, 'Променяйте само собствено съобщение за текущ назначен клас.'); if (old.revision !== d.revision) fail(409, 'Има по-нова версия. Обновете съобщението.'); if (old.operations.length >= (type === 'announcement-withdraw' ? 60 : 59)) fail(409, 'Историята е пълна. Има резерв за оттегляне.'); a = structuredClone(old); }
  if (type === 'announcement-save') { if (a.classId !== d.classId || a.status !== 'draft' && !a.draft) fail(409, 'Обхватът е постоянен. Подгответе нова версия за промяна на текста.'); a.draft = d.fields; }
  else if (type === 'announcement-revise') { if (a.draft || !a.editions.length || a.editions.length >= 8) fail(409, 'Вече има чернова или е достигнат лимитът от версии.'); const { title, body, priority, roles } = a.editions.at(-1)!; a.draft = { title, body, priority, roles }; }
  else if (type === 'announcement-discard') { if (!a.draft || a.status === 'draft') fail(409, 'Няма отделна чернова за отказ.'); delete a.draft; }
  else if (type === 'announcement-publish') {
    if (!a.draft || a.editions.length >= 8) fail(409, 'Няма готова чернова или е достигнат лимитът от версии.');
    const members = recipients(s, a, a.draft); if (!members.length || members.length > 1000) fail(409, 'Изберете аудитория с между 1 и 1000 активни получатели.');
    const e: AnnouncementEdition = { ...a.draft, edition: a.editions.length + 1, at: new Date().toISOString(), contentHash: '', recipients: members.map(m => ({ id: crypto.randomUUID(), userId: m.userId, name: m.name, role: m.role as any })) };
    e.contentHash = await hash(announcementHashInput(s.schoolId, a, e)); a.editions.push(e); delete a.draft; a.status = 'issued';
  } else { if (a.status !== 'issued') fail(409, 'Само публикувано съобщение може да се оттегли.'); a.status = 'withdrawn'; Object.assign(a.editions.at(-1)!, { withdrawnAt: new Date().toISOString(), reason: d.reason }); }
  a.revision++; a.updatedAt = new Date().toISOString(); a.operations.push({ id: d.requestId, actorId: m.userId, fingerprint });
  if (new TextEncoder().encode(JSON.stringify(a)).length > (type === 'announcement-withdraw' ? 880000 : 850000)) fail(409, 'Историята е достигнала размера за пилота и остава запазена.');
  await commit(owner, a, snapshot.payload, deps, user, m.name, type, ledger); return schoolAnnouncementsHome(user, s.schoolId, a.id);
}
export async function schoolAnnouncementNotices(s: SchoolDirectory, m: SchoolMember): Promise<ClassworkNotice[]> {
  const owner = scope(s.schoolId), [all, seen] = await Promise.all([records(owner), readIds(owner)]);
  return all.flatMap(a => { const e = a.editions.at(-1), slot = e && ownSlot(s, m, a, e); if (!e || !slot) return []; return [{ id: `announcement:${a.id}:${e.edition}:${e.withdrawnAt ? 'withdrawn' : 'issued'}`, kind: 'announcement' as const, title: e.withdrawnAt ? 'Съобщението е оттеглено' : 'Училищно съобщение', summary: 'Отвори точната версия и отбележи изрично, когато си прочел текста.', at: e.withdrawnAt || e.at, assignmentId: '', assignmentTitle: e.title, subject: 'Съобщения', classId: a.classId || '', className: a.className, announcementId: a.id, unread: true, needsAction: a.status === 'issued' && !seen.has(announcementReadId(slot.id)) }]; });
}
