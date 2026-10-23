import { z } from 'zod';
import { db, encrypt, decrypt, recordSnapshot } from './store';
import { schoolHome, schoolDirectorySnapshot, SchoolDirectoryError } from './school-directory-service';
import { directoryView, type SchoolDirectory, type SchoolMember } from './school-directory-data';
import { schoolToday } from './platform-data';
import { validDate } from './platform-service';
import { submissionView, workStatus, assignmentCondition, attachmentViews, revisionView, type ClassAssignment, type ClassSubmission, type ClassworkHome, type ClassReview, type AssignmentRevision } from './classwork-data';
import { prepareWorkFiles, sameWorkFiles, saveWorkFiles, cleanUncommittedWorkFiles, readWorkFile } from './classwork-files';
import { workFileChoiceError } from './classwork-file-policy';
import { taskNotices, inboxWindow, INBOX_READ_LIMIT, type ClassworkInboxHome, type ClassworkInboxState } from './classwork-inbox-data';
import { gradebookInboxNotices } from './school-gradebook-service';
import { attendanceInboxNotices } from './school-attendance-service';
import { schoolAnnouncementNotices } from './school-announcement-service';
import { schoolDocumentNotices } from './school-document-service';
import type { ChatGPTUser } from '@/app/chatgpt-auth';

function fail(status: number, message: string): never { throw new SchoolDirectoryError(status, message); }
const id = z.string().uuid(), version = z.number().int().min(0), directoryRevision = z.number().int().positive();
const base = { schoolId: id, directoryRevision };
const criterion = z.object({ id, title: z.string().trim().min(3).max(100), description: z.string().trim().max(500), maxPoints: z.number().int().min(1).max(100) });
const assignmentFields = { classId: id, title: z.string().trim().min(3).max(200), subject: z.string().trim().min(2).max(120), description: z.string().trim().min(5).max(20000), due: validDate, criteria: z.array(criterion).max(6) };
const schemas = {
  'assignment-save': z.object({ ...base, id, version, ...assignmentFields, requestId: id.optional(), keepFileIds: z.array(id).max(3).optional() }),
  'assignment-state': z.object({ ...base, id, version, action: z.enum(['publish', 'archive', 'restore']), confirmed: z.literal(true), reason: z.string().trim().max(500).default('') }),
  'submit': z.object({ ...base, assignmentId: id, assignmentVersion: version, version, requestId: id, body: z.string().trim().max(20000), aiUse: z.boolean() }),
  'review': z.object({ ...base, assignmentId: id, pupilId: id, version, requestId: id, status: z.enum(['reviewed', 'revision']), feedback: z.string().trim().min(1).max(3000), scores: z.array(z.object({ id, points: z.number().int().min(0).max(100), note: z.string().trim().max(500) })).max(6) }),
} as const;
const scope = (schoolId: string) => 'eduo-school:' + schoolId;
const submissionId = (assignmentId: string, pupilId: string) => 'class-work:' + assignmentId + ':' + pupilId;
async function seal(owner: string, record: unknown) { const bytes = await encrypt(new TextEncoder().encode(JSON.stringify(record)), owner); let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
async function records<T>(owner: string, kind: string): Promise<T[]> {
  const rows = await db().prepare('SELECT payload FROM school_records WHERE owner=? AND kind=?').bind(owner, kind).all<{ payload: string }>();
  return Promise.all(rows.results.map(async r => JSON.parse(new TextDecoder().decode(await decrypt(Uint8Array.from(atob(r.payload), c => c.charCodeAt(0)), owner)))));
}
function member(s: SchoolDirectory, userId: string) { const m = s.members.find(x => x.userId === userId && x.status === 'active'); if (!m) fail(403, 'Необходим е активен одобрен училищен акаунт.'); return m; }
function staffClass(s: SchoolDirectory, m: SchoolMember, classId: string) { return !!s.classes.find(c => c.id === classId && !c.archived) && (m.role === 'admin' || m.role === 'teacher' && m.classIds.includes(classId)); }
function manages(s: SchoolDirectory, m: SchoolMember, a: ClassAssignment) { return staffClass(s, m, a.classId) && (m.role === 'admin' || a.createdBy === m.userId); }
function ownPupils(s: SchoolDirectory, m: SchoolMember) { return s.pupils.filter(p => !p.archived && s.classes.some(c => c.id === p.classId && !c.archived) && m.pupilIds.includes(p.id)); }
function visibleSubmissions(s: SchoolDirectory, m: SchoolMember, a: ClassAssignment, submissions: ClassSubmission[]) {
  if (m.role === 'admin') return submissions.filter(x => x.assignmentId === a.id);
  const pupilIds = ['student', 'parent'].includes(m.role) ? ownPupils(s, m).map(p => p.id) : s.pupils.filter(p => !p.archived && p.classId === a.classId).map(p => p.id);
  return submissions.filter(x => x.assignmentId === a.id && pupilIds.includes(x.pupilId));
}
function visible(s: SchoolDirectory, m: SchoolMember, a: ClassAssignment, submissions: ClassSubmission[]) {
  if (m.role === 'admin') return true;
  if (m.role === 'teacher') return staffClass(s, m, a.classId) && (a.status === 'published' || a.createdBy === m.userId);
  return a.status === 'published' && (ownPupils(s, m).some(p => p.classId === a.classId) || visibleSubmissions(s, m, a, submissions).length > 0);
}
function currentTaskFiles(s: SchoolDirectory, m: SchoolMember, a: ClassAssignment) {
  return m.role === 'admin' || m.role === 'teacher' && staffClass(s, m, a.classId) || ['student', 'parent'].includes(m.role) && a.status === 'published' && ownPupils(s, m).some(p => p.classId === a.classId);
}
function visibleTaskHistory(s: SchoolDirectory, m: SchoolMember, a: ClassAssignment) {
  return (a.history || []).filter(h => m.role === 'admin' || m.role === 'teacher' && staffClass(s, m, h.classId) && (h.status === 'published' || a.createdBy === m.userId) || ['student', 'parent'].includes(m.role) && a.status === 'published' && h.status === 'published' && ownPupils(s, m).some(p => p.classId === h.classId && p.classId === a.classId));
}
function taskHistory(a: ClassAssignment): AssignmentRevision[] {
  if ((a.history?.length || 0) >= 40) fail(409, 'Достигнат е лимитът от 40 по-ранни версии на домашното. Историята се запазва.');
  return [...(a.history || []), { ...assignmentCondition(a), classId: a.classId, status: a.status, archived: a.archived, savedAt: a.updatedAt, ...(a.saveRequest ? { saveRequest: a.saveRequest } : {}) }];
}
async function assignmentFingerprint(d: any, files: Awaited<ReturnType<typeof prepareWorkFiles>>) {
  const intent = { version: d.version, classId: d.classId, title: d.title, subject: d.subject, description: d.description, due: d.due, criteria: d.criteria, keepFileIds: d.keepFileIds ?? null, files: files.map(({ bytes, ...f }) => f) };
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(intent)));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

export async function classworkHome(user: ChatGPTUser, schoolId?: string, assignmentId?: string): Promise<ClassworkHome> {
  const h = await schoolHome(user, schoolId), v = h.current;
  const empty: ClassworkHome = { writable: true, preview: false, schools: h.schools, context: v ? { school: v.school, self: v.self ? { userId: v.self.userId, name: v.self.name, role: v.self.role, status: v.self.status } : null, status: v.self?.status || v.request?.status || 'pending', classes: v.classes, pupils: v.pupils } : null, assignments: [] };
  if (!v || v.self?.status !== 'active') { if (assignmentId) fail(403, 'Няма активен достъп до тази работа.'); return empty; }
  if (assignmentId) id.parse(assignmentId);
  const saved = await schoolDirectorySnapshot(v.school.id); if (!saved) fail(404, 'Училището не е намерено.');
  const s = saved.state, m = member(s, user.userId), owner = scope(s.schoolId);
  // Reproject after the directory reread so a concurrent scope change does not
  // leave the context from the earlier discovery read in the response.
  const current = directoryView(s, user.userId)!;
  empty.context = { school: current.school, self: { userId: m.userId, name: m.name, role: m.role, status: m.status }, status: 'active', classes: current.classes, pupils: current.pupils };
  const [assignments, submissions] = await Promise.all([records<ClassAssignment>(owner, 'class-assignment'), records<ClassSubmission>(owner, 'class-submission')]);
  empty.assignments = assignments.filter(a => visible(s, m, a, submissions)).map(a => {
    const allowed = visibleSubmissions(s, m, a, submissions).filter(x => ['parent', 'student'].includes(m.role) || s.pupils.some(p => p.id === x.pupilId && !p.archived && p.classId === a.classId)), { description, criteria, createdBy, kind, attachments, history, saveRequest, ...summary } = a;
    const expected = ['student', 'parent'].includes(m.role) ? ownPupils(s, m).filter(p => p.classId === a.classId || allowed.some(x => x.pupilId === p.id)).length : s.pupils.filter(p => !p.archived && p.classId === a.classId).length;
    return { ...summary, attachmentCount: currentTaskFiles(s, m, a) ? (attachments?.length || 0) : 0, className: s.classes.find(c => c.id === a.classId)?.name || 'Архивиран клас', canManage: manages(s, m, a), expected, submitted: allowed.filter(x => workStatus(x) === 'submitted').length, returned: allowed.filter(x => workStatus(x) === 'revision').length, reviewed: allowed.filter(x => workStatus(x) === 'reviewed').length };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  if (assignmentId) {
    const a = assignments.find(a => a.id === assignmentId); if (!a || !visible(s, m, a, submissions)) fail(404, 'Домашното не е достъпно за този акаунт.');
    const allowed = visibleSubmissions(s, m, a, submissions), { createdBy, kind, attachments, history, saveRequest, ...assignment } = a;
    const pupils = ['student', 'parent'].includes(m.role) ? ownPupils(s, m).filter(p => p.classId === a.classId || allowed.some(x => x.pupilId === p.id)) : s.pupils.filter(p => !p.archived && p.classId === a.classId || m.role === 'admin' && allowed.some(x => x.pupilId === p.id));
    empty.detail = { assignment: { ...assignment, attachments: currentTaskFiles(s, m, a) ? attachmentViews(attachments) : [], history: visibleTaskHistory(s, m, a).map(revisionView), className: s.classes.find(c => c.id === a.classId)?.name || 'Архивиран клас', canManage: manages(s, m, a), canSubmit: m.role === 'student' && !a.archived && a.status === 'published' && ownPupils(s, m).some(p => p.classId === a.classId) }, pupils, submissions: allowed.map(submissionView), reviewablePupilIds: manages(s, m, a) && !a.archived ? pupils.filter(p => !p.archived && p.classId === a.classId).map(p => p.id) : [] };
  }
  return empty;
}

const inboxScope = (schoolId: string, userId: string) => `eduo-classwork-inbox:${schoolId}:${userId}`;
const readInput = z.object({ schoolId: id, directoryRevision, ids: z.array(z.string().min(1).max(200)).min(1).max(200), read: z.boolean() }).strict();
async function inboxSnapshot(user: ChatGPTUser, schoolId?: string) {
  const h = await schoolHome(user, schoolId), v = h.current;
  const home = inboxWindow({ writable: true, preview: false, schools: h.schools, context: v ? { school: v.school, self: v.self ? { userId: v.self.userId, name: v.self.name, role: v.self.role, status: v.self.status } : null, status: v.self?.status || v.request?.status || 'pending', classes: v.classes, pupils: v.pupils } : null }, []);
  if (!v || v.self?.status !== 'active') return { home, saved: null };
  const saved = await schoolDirectorySnapshot(v.school.id); if (!saved) fail(404, 'Училището не е намерено.');
  const s = saved.state, m = member(s, user.userId), current = directoryView(s, user.userId)!;
  home.context = { school: current.school, self: { userId: m.userId, name: m.name, role: m.role, status: m.status }, status: 'active', classes: current.classes, pupils: current.pupils };
  const [assignments, submissions] = await Promise.all([records<ClassAssignment>(scope(s.schoolId), 'class-assignment'), records<ClassSubmission>(scope(s.schoolId), 'class-submission')]);
  const notices = assignments.filter(a => visible(s, m, a, submissions)).flatMap(a => taskNotices({
    assignment: a, history: visibleTaskHistory(s, m, a), currentVisible: currentTaskFiles(s, m, a), submissions: visibleSubmissions(s, m, a, submissions),
    pupils: s.pupils, role: m.role, className: s.classes.find(c => c.id === a.classId)?.name || 'Архивиран клас',
    canManage: manages(s, m, a), canSubmit: m.role === 'student' && !a.archived && a.status === 'published' && ownPupils(s, m).some(p => p.classId === a.classId),
  }));
  const [gradeNotices, attendanceNotices, documentNotices, announcementNotices] = await Promise.all([gradebookInboxNotices(s, m), attendanceInboxNotices(s, m), schoolDocumentNotices(s, m), schoolAnnouncementNotices(s, m)]);
  if ((await schoolDirectorySnapshot(s.schoolId))?.payload !== saved.payload) fail(409, 'Училищните права са променени. Обновете входящите.');
  return { home: inboxWindow(home, [...notices, ...gradeNotices, ...attendanceNotices, ...documentNotices, ...announcementNotices]), saved };
}
async function inboxState(owner: string) {
  const snapshot = await recordSnapshot(owner, 'read-state'), state = snapshot.record as unknown as ClassworkInboxState | null;
  if (state && (state.kind !== 'classwork-inbox-state' || !Number.isInteger(state.version) || !Array.isArray(state.seen))) throw new Error('Invalid inbox state');
  return { ...snapshot, state };
}
export async function classworkInbox(user: ChatGPTUser, schoolId?: string): Promise<ClassworkInboxHome> {
  const { home, saved } = await inboxSnapshot(user, schoolId); if (!saved) return home;
  const { state } = await inboxState(inboxScope(saved.state.schoolId, user.userId));
  if ((await schoolDirectorySnapshot(saved.state.schoolId))?.payload !== saved.payload) fail(409, 'Училищните права са променени. Обновете входящите.');
  return { ...inboxWindow(home, home.notices, state?.seen.map(s => s.id)), truncated: home.truncated };
}
export async function classworkInboxRead(user: ChatGPTUser, input: unknown): Promise<ClassworkInboxHome> {
  const d = readInput.parse(input), { home, saved } = await inboxSnapshot(user, d.schoolId);
  if (!saved) fail(403, 'Необходим е активен одобрен училищен акаунт.');
  if (saved.state.revision !== d.directoryRevision) fail(409, 'Училищните права са променени. Обновете входящите.');
  const ids = new Set(d.ids), allowed = new Set(home.notices.map(n => n.id));
  if (ids.size !== d.ids.length || d.ids.some(id => !allowed.has(id))) fail(400, 'Изберете само записи от текущите си входящи.');
  const owner = inboxScope(d.schoolId, user.userId), schoolOwner = scope(d.schoolId), now = new Date().toISOString();
  for (let attempt = 0; attempt < 4; attempt++) {
    const previous = await inboxState(owner), seen = previous.state?.seen || [], next = d.read ? [...seen, ...d.ids.filter(id => !seen.some(s => s.id === id)).map(id => ({ id, at: now }))] : seen.filter(s => !ids.has(s.id));
    if (JSON.stringify(seen) === JSON.stringify(next)) return classworkInbox(user, d.schoolId);
    if (next.length > INBOX_READ_LIMIT) fail(409, 'Достигнат е лимитът от 2000 прочетени записа в пилота. Запазените отметки остават.');
    const state: ClassworkInboxState = { id: 'read-state', kind: 'classwork-inbox-state', version: (previous.state?.version || 0) + 1, seen: next }, payload = await seal(owner, state);
    const guard = ' AND EXISTS (SELECT 1 FROM school_records AS dependency WHERE dependency.owner=? AND dependency.id=? AND dependency.payload=?)';
    const change = previous.payload === null
      ? db().prepare('INSERT OR IGNORE INTO school_records(owner,id,kind,payload,updated_at) SELECT ?,?,?,?,? WHERE 1=1' + guard).bind(owner, state.id, state.kind, payload, now, schoolOwner, 'directory', saved.payload)
      : db().prepare('UPDATE school_records SET payload=?,updated_at=? WHERE owner=? AND id=? AND payload=?' + guard).bind(payload, now, owner, state.id, previous.payload, schoolOwner, 'directory', saved.payload);
    const result = await db().batch([change]);
    if (result[0].meta.changes === 1) return classworkInbox(user, d.schoolId);
    const current = await schoolDirectorySnapshot(d.schoolId);
    if (!current || current.payload !== saved.payload) fail(409, 'Училищните права са променени. Обновете входящите.');
    // Another tab changed only this account's markers. Merge into its new state.
  }
  fail(409, 'Входящите са променени в друг прозорец. Обновете ги и опитайте отново.');
}

// The membership snapshot and (for a hand-in/review) task snapshot are checked
// inside the same transaction as the record and its school audit entry.
async function commit(schoolId: string, record: ClassAssignment | ClassSubmission, previous: string | null, guards: { id: string; payload: string }[], user: ChatGPTUser, event: string, detail: string) {
  const owner = scope(schoolId), now = new Date().toISOString();
  if (JSON.stringify(record).length > 500000) fail(409, 'Достигнат е размерът за историята на тази работа в пилота. Записът остава запазен.');
  const payload = await seal(owner, record);
  const guard = guards.map(() => ' AND EXISTS (SELECT 1 FROM school_records AS dependency WHERE dependency.owner=? AND dependency.id=? AND dependency.payload=?)').join('');
  const args = guards.flatMap(g => [owner, g.id, g.payload]);
  const change = previous === null
    ? db().prepare('INSERT OR IGNORE INTO school_records(owner,id,kind,payload,updated_at) SELECT ?,?,?,?,? WHERE 1=1' + guard).bind(owner, record.id, record.kind, payload, now, ...args)
    : db().prepare('UPDATE school_records SET payload=?,updated_at=? WHERE owner=? AND id=? AND payload=?' + guard).bind(payload, now, owner, record.id, previous, ...args);
  const auditId = crypto.randomUUID(), audit = { id: auditId, kind: 'school-audit', event, actor: user.fullName || user.displayName || user.email, actorId: user.userId, at: now, detail };
  const auditWrite = db().prepare('INSERT INTO school_records(owner,id,kind,payload,updated_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM school_records WHERE owner=? AND id=? AND payload=?)').bind(owner, auditId, 'school-audit', await seal(owner, audit), now, owner, record.id, payload);
  const result = await db().batch([change, auditWrite]);
  if (result[0].meta.changes !== 1) fail(409, 'Работата или училищните права са променени. Обновете данните и отворете работата отново.');
}

export async function classworkCommand(user: ChatGPTUser, type: string, input: unknown, uploads: File[] = []): Promise<ClassworkHome> {
  const schema = Object.hasOwn(schemas, type) ? schemas[type as keyof typeof schemas] : null; if (!schema) fail(400, 'Непознато действие за домашно.');
  const d: any = schema.parse(input), saved = await schoolDirectorySnapshot(d.schoolId); if (!saved) fail(404, 'Училището не е намерено.');
  if (uploads.length && !['submit', 'assignment-save'].includes(type)) fail(400, 'Файлове не се приемат за това действие.');
  const s = saved.state, m = member(s, user.userId), owner = scope(s.schoolId), now = new Date().toISOString();
  const target = type === 'submit' || type === 'review' ? submissionId(d.assignmentId, type === 'submit' ? m.pupilIds[0] : d.pupilId) : d.id;
  const original = await recordSnapshot(owner, target), old = original.record as unknown as ClassAssignment | ClassSubmission | null;
  const guards = [{ id: 'directory', payload: saved.payload }];
  const pendingKeys: string[] = [];
  let result: ClassAssignment | ClassSubmission, detail: string, selected: string;
  try {
  if (type === 'assignment-save') {
    if (!staffClass(s, m, d.classId)) fail(403, 'Можете да създавате домашни само за назначен клас.');
    if (old && (old.kind !== 'class-assignment' || !manages(s, m, old))) fail(403, 'Само авторът или училищният администратор може да редактира това домашно.');
    if ((uploads.length || d.keepFileIds !== undefined) && !d.requestId) fail(400, 'Отворете формуляра отново, за да запазите файловете.');
    const preparedFiles = await prepareWorkFiles(uploads), fingerprint = await assignmentFingerprint(d, preparedFiles);
    if (old?.kind === 'class-assignment' && d.requestId) {
      const receipt = [old.saveRequest, ...(old.history || []).map(h => h.saveRequest)].find(r => r?.id === d.requestId);
      if (receipt) { if (receipt.actorId !== user.userId || receipt.fingerprint !== fingerprint) fail(409, 'Тази заявка вече е използвана за различно домашно.'); return classworkHome(user, s.schoolId, old.id); }
    }
    if (!d.requestId && old?.kind === 'class-assignment' && d.version === 0 && old.version === 1 && old.createdBy === user.userId && ['classId', 'title', 'subject', 'description', 'due'].every(k => (old as any)[k] === d[k]) && JSON.stringify(old.criteria) === JSON.stringify(d.criteria) && sameWorkFiles(old.attachments || [], preparedFiles)) return classworkHome(user, s.schoolId, old.id);
    if ((old?.version || 0) !== d.version) fail(409, 'Има по-нова версия на домашното.');
    if (new Set(d.criteria.map((c: any) => c.id)).size !== d.criteria.length || d.criteria.reduce((n: number, c: any) => n + c.maxPoints, 0) > 100) fail(400, 'Критериите трябва да са уникални и общо до 100 точки.');
    if (old?.kind === 'class-assignment' && (old.archived || old.status === 'published' && old.classId !== d.classId)) fail(409, 'Възстановете архивираното домашно. Класът на публикувано домашно не се сменя.');
    if (s.revision !== d.directoryRevision) fail(409, 'Училищните права или списъците са променени. Обновете данните.');
    const existing = old?.kind === 'class-assignment' ? old.attachments || [] : [], keepIds: string[] = d.keepFileIds ?? existing.map(f => f.id);
    if (new Set(keepIds).size !== keepIds.length || keepIds.some(f => !existing.some(x => x.id === f))) fail(400, 'Избраните запазени файлове не принадлежат на текущото домашно.');
    const retained = keepIds.map(f => existing.find(x => x.id === f)!);
    const fileError = workFileChoiceError([...retained, ...preparedFiles].map(f => ({ name: f.name, size: f.size, type: f.mime }))); if (fileError) fail(400, fileError);
    const history = old?.kind === 'class-assignment' ? taskHistory(old) : [];
    const fields = { classId: d.classId, title: d.title, subject: d.subject, description: d.description, due: d.due, criteria: d.criteria };
    if (!old) { const count = await db().prepare('SELECT COUNT(*) AS count FROM school_records WHERE owner=? AND kind=?').bind(owner, 'class-assignment').first<{ count: number }>(); if ((count?.count || 0) >= 250) fail(409, 'Пилотът поддържа до 250 домашни в училищна среда.'); }
    const attachments = [...retained, ...await saveWorkFiles(preparedFiles, owner, pendingKeys)], receipt = d.requestId ? { saveRequest: { id: d.requestId, actorId: user.userId, fingerprint } } : { saveRequest: undefined };
    result = old?.kind === 'class-assignment' ? { ...old, ...fields, ...receipt, attachments, history, version: old.version + 1, updatedAt: now } : { ...fields, ...receipt, attachments, history, id: d.id, kind: 'class-assignment', version: 1, status: 'draft', archived: false, createdBy: user.userId, teacherName: m.name, createdAt: now, updatedAt: now };
    detail = `${old ? 'Обновено' : 'Създадено черново'} домашно „${d.title}“`; selected = result.id;
  } else if (type === 'assignment-state') {
    if (old?.kind !== 'class-assignment' || !manages(s, m, old)) fail(403, 'Нямате право да променяте това домашно.');
    if (old.version !== d.version) fail(409, 'Има по-нова версия на домашното.');
    if (d.action === 'publish' && (old.status !== 'draft' || old.archived) || d.action === 'archive' && old.archived || d.action === 'restore' && !old.archived) fail(409, 'Тази промяна вече е записана или не е приложима.');
    if (d.action === 'archive' && d.reason.length < 5) fail(400, 'Добавете причина за архивирането.');
    result = { ...old, history: taskHistory(old), version: old.version + 1, updatedAt: now, status: d.action === 'publish' ? 'published' : old.status, archived: d.action === 'archive' ? true : d.action === 'restore' ? false : old.archived };
    detail = `${d.action === 'publish' ? 'Публикувано' : d.action === 'archive' ? 'Архивирано' : 'Възстановено'} домашно „${old.title}“${d.reason ? ': ' + d.reason : ''}`; selected = old.id;
  } else {
    const task = await recordSnapshot(owner, d.assignmentId), a = task.record as unknown as ClassAssignment | null;
    if (a?.kind !== 'class-assignment') fail(404, 'Домашното не е намерено.');
    guards.push({ id: a.id, payload: task.payload! }); selected = a.id;
    const submission = old?.kind === 'class-submission' ? old : null;
    if (old && !submission) fail(409, 'Невалиден запис за работа.');
    if (type === 'submit') {
      const p = ownPupils(s, m)[0];
      if (m.role !== 'student' || m.pupilIds.length !== 1 || !p || p.classId !== a.classId || a.status !== 'published' || a.archived) fail(403, 'Предаването е достъпно само за активния ученик от този клас.');
      if (!d.body && !uploads.length) fail(400, 'Напиши решение или избери поне един файл.');
      const preparedFiles = await prepareWorkFiles(uploads);
      const previous = submission?.attempts.find(x => x.id === d.requestId);
      if (previous) { if (previous.body !== d.body || previous.aiUse !== d.aiUse || previous.condition.version !== d.assignmentVersion || !sameWorkFiles(previous.attachments || [], preparedFiles)) fail(409, 'Тази заявка вече е използвана за различна работа.'); return classworkHome(user, s.schoolId, a.id); }
      if ((submission?.version || 0) !== d.version || a.version !== d.assignmentVersion) fail(409, 'Работата или условието е променено. Обновете преди предаване.');
      if (submission && workStatus(submission) !== 'revision') fail(409, 'Работата вече е предадена. Нова версия е достъпна след връщане за поправка.');
      if ((submission?.attempts.length || 0) >= 10) fail(409, 'Достигнат е лимитът от 10 предавания за това домашно. Историята се запазва.');
      if (s.revision !== d.directoryRevision) fail(409, 'Училищните права или списъците са променени. Обновете данните.');
      const attachments = await saveWorkFiles(preparedFiles, owner, pendingKeys);
      const condition = assignmentCondition(a);
      result = { id: target, kind: 'class-submission', assignmentId: a.id, pupilId: p.id, version: (submission?.version || 0) + 1, createdAt: submission?.createdAt || now, updatedAt: now, attempts: [...(submission?.attempts || []), { id: d.requestId, submittedBy: user.userId, at: now, body: d.body, aiUse: d.aiUse, late: schoolToday() > a.due, condition, reviews: [], attachments }] };
      detail = `Предадено домашно „${a.title}“ от ${p.name}`;
    } else {
      if (!manages(s, m, a) || a.archived || !s.pupils.some(p => p.id === d.pupilId && !p.archived && p.classId === a.classId) || !submission) fail(403, 'Нямате право да преглеждате тази ученическа работа.');
      const attempt = submission.attempts.at(-1)!;
      const previous = attempt.reviews.find(r => r.id === d.requestId);
      if (previous) { if (previous.actorId !== user.userId || previous.status !== d.status || previous.feedback !== d.feedback || JSON.stringify(previous.scores) !== JSON.stringify(d.scores)) fail(409, 'Тази заявка вече е използвана за различен преглед.'); return classworkHome(user, s.schoolId, a.id); }
      if (submission.version !== d.version) fail(409, 'Ученическата работа е променена. Обновете преди преглед.');
      const criteria = attempt.condition.criteria;
      if (new Set(d.scores.map((x: any) => x.id)).size !== d.scores.length || d.scores.some((x: any) => !criteria.some(c => c.id === x.id && x.points <= c.maxPoints)) || d.scores.length && d.scores.length !== criteria.length || d.status === 'reviewed' && d.scores.length !== criteria.length) fail(400, 'Оценете всички критерии по запазеното условие или върнете работата с насоки без точки.');
      if (attempt.reviews.length >= 20) fail(409, 'Достигнат е лимитът за прегледи на тази версия. Историята се запазва.');
      const r: ClassReview = { id: d.requestId, actorId: user.userId, by: m.name, at: now, status: d.status, feedback: d.feedback, scores: d.scores, total: d.scores.length ? d.scores.reduce((n: number, x: any) => n + x.points, 0) : null, maxPoints: d.scores.length ? criteria.reduce((n, c) => n + c.maxPoints, 0) : null };
      result = { ...submission, version: submission.version + 1, updatedAt: now, attempts: [...submission.attempts.slice(0, -1), { ...attempt, reviews: [...attempt.reviews, r] }] };
      detail = `${d.status === 'reviewed' ? 'Прегледано' : 'Върнато за поправка'} домашно „${a.title}“`;
    }
  }
  if (s.revision !== d.directoryRevision) fail(409, 'Училищните права или списъците са променени. Обновете данните.');
  await commit(s.schoolId, result, original.payload, guards, user, type, detail);
  pendingKeys.length = 0;
  return classworkHome(user, s.schoolId, selected);
  } catch (e) { await cleanUncommittedWorkFiles(owner, target, pendingKeys); throw e; }
}

export async function classworkDownload(user: ChatGPTUser, schoolId: string, assignmentId: string, pupilId: string, fileId: string) {
  for (const value of [schoolId, assignmentId, pupilId, fileId]) id.parse(value);
  const directory = await schoolDirectorySnapshot(schoolId); if (!directory) fail(404, 'Файлът не е намерен.');
  const s = directory.state, m = member(s, user.userId), owner = scope(schoolId);
  const task = await recordSnapshot(owner, assignmentId), work = await recordSnapshot(owner, submissionId(assignmentId, pupilId));
  const a = task.record as unknown as ClassAssignment | null, submission = work.record as unknown as ClassSubmission | null;
  if (a?.kind !== 'class-assignment' || submission?.kind !== 'class-submission' || !visible(s, m, a, [submission]) || !visibleSubmissions(s, m, a, [submission]).length) fail(404, 'Файлът не е достъпен за този акаунт.');
  const file = submission.attempts.flatMap(x => x.attachments || []).find(f => f.id === fileId); if (!file) fail(404, 'Файлът не е намерен.');
  return { file, bytes: await readWorkFile(file, owner) };
}

export async function classworkTaskDownload(user: ChatGPTUser, schoolId: string, assignmentId: string, taskVersion: number, fileId: string) {
  for (const value of [schoolId, assignmentId, fileId]) id.parse(value);
  z.number().int().positive().parse(taskVersion);
  const directory = await schoolDirectorySnapshot(schoolId); if (!directory) fail(404, 'Файлът не е намерен.');
  const s = directory.state, m = member(s, user.userId), owner = scope(schoolId), task = await recordSnapshot(owner, assignmentId), a = task.record as unknown as ClassAssignment | null;
  if (a?.kind !== 'class-assignment') fail(404, 'Файлът не е намерен.');
  const ownWork = ['parent', 'student'].includes(m.role) ? (await Promise.all(ownPupils(s, m).map(p => recordSnapshot(owner, submissionId(a.id, p.id))))).map(x => x.record as unknown as ClassSubmission | null).filter((x): x is ClassSubmission => x?.kind === 'class-submission') : [];
  if (!visible(s, m, a, ownWork)) fail(404, 'Файлът не е достъпен за този акаунт.');
  const condition = a.version === taskVersion && currentTaskFiles(s, m, a) ? a : visibleTaskHistory(s, m, a).find(h => h.version === taskVersion);
  const retained = ownWork.flatMap(w => w.attempts).filter(attempt => attempt.condition.version === taskVersion).flatMap(attempt => attempt.condition.attachments || []);
  const file = [...(condition?.attachments || []), ...retained].find(f => f.id === fileId); if (!file) fail(404, 'Файлът не е намерен в достъпната версия.');
  return { file, bytes: await readWorkFile(file, owner) };
}
