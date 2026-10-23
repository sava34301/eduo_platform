import { z } from 'zod';
import { db, encrypt, decrypt, recordSnapshot } from './store';
import { schoolHome, schoolDirectorySnapshot, SchoolDirectoryError } from './school-directory-service';
import { directoryView, type SchoolDirectory, type SchoolMember } from './school-directory-data';
import { gradeInSchoolYear } from './school-gradebook-data';
import { schoolToday } from './platform-data';
import { MAX_ATTENDANCE_SESSIONS, MAX_ATTENDANCE_ACTIONS, MAX_ATTENDANCE_EVENTS, MAX_ATTENDANCE_BYTES, ATTENDANCE_REVIEW_RESERVE, attendanceSessionId, attendancePending, attendanceMarkChanged, attendanceEntryView, type SchoolAttendance, type SchoolAttendanceHome, type AttendanceEntry, type AttendanceMark, type AttendanceEvent, type AttendanceSessionSummary } from './school-attendance-data';
import type { ChatGPTUser } from '@/app/chatgpt-auth';
import type { ClassworkNotice } from './classwork-inbox-data';

function fail(status: number, message: string): never { throw new SchoolDirectoryError(status, message); }
const id = z.string().uuid(), positive = z.number().int().positive(), sessionId = z.string().regex(/^attendance:[0-9a-f-]{36}:\d{4}-\d{2}-\d{2}:([1-9]|1[0-2])$/i);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => { const d = new Date(s + 'T12:00:00Z'); return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; });
const subject = z.string().trim().min(2).max(100).refine(s => !/[\u0000-\u001f]/.test(s)), topic = z.string().trim().max(500), reason = z.string().trim().min(5).max(500);
const mark = z.object({ pupilId: id, status: z.enum(['unmarked', 'present', 'late', 'absent', 'excused']), lateMinutes: z.number().int().min(0).max(60), note: z.string().trim().max(500) }).strict().superRefine((e, ctx) => { if (e.status === 'late' ? e.lateMinutes < 1 : e.lateMinutes !== 0) ctx.addIssue({ code: 'custom', message: 'Минутите трябва да съответстват на закъснението.' }); });
const base = { schoolId: id, directoryRevision: positive, requestId: id, confirmed: z.literal(true) }, target = { ...base, sessionId, revision: positive };
const schemas = {
  'attendance-create': z.object({ ...base, classId: id, date, lessonNumber: z.number().int().min(1).max(12), subject, topic }).strict(),
  'attendance-mark': z.object({ ...target, entries: z.array(mark).min(1).max(100), reason: z.string().trim().max(500).default('') }).strict(),
  'attendance-edit': z.object({ ...target, subject, topic, reason }).strict(),
  'attendance-state': z.object({ ...target, action: z.enum(['cancel', 'restore']), reason }).strict(),
  'attendance-explain': z.object({ ...target, pupilId: id, body: z.string().trim().min(5).max(1000) }).strict(),
  'attendance-review': z.object({ ...target, pupilId: id, explanationId: id, decision: z.enum(['approved', 'returned', 'declined']), reason }).strict(),
  'attendance-withdraw': z.object({ ...target, pupilId: id, explanationId: id, reason }).strict(),
};
const scope = (schoolId: string) => 'eduo-school:' + schoolId;
const activeClass = (s: SchoolDirectory, classId: string) => s.classes.some(c => c.id === classId && !c.archived);
function member(s: SchoolDirectory, userId: string) { const m = s.members.find(m => m.userId === userId && m.status === 'active'); return m || fail(403, 'Необходим е активен одобрен училищен акаунт.'); }
const ownPupil = (s: SchoolDirectory, m: SchoolMember, e: AttendanceEntry) => ['student', 'parent'].includes(m.role) && m.pupilIds.includes(e.pupilId) && s.pupils.some(p => p.id === e.pupilId && !p.archived && activeClass(s, p.classId));
const staffClass = (s: SchoolDirectory, m: SchoolMember, classId: string) => activeClass(s, classId) && (m.role === 'admin' || m.role === 'teacher' && m.classIds.includes(classId));
const currentPupil = (s: SchoolDirectory, t: SchoolAttendance, e: AttendanceEntry) => s.pupils.some(p => p.id === e.pupilId && !p.archived && p.classId === t.classId);
const manages = (s: SchoolDirectory, m: SchoolMember, t: SchoolAttendance) => t.schoolYear === s.year && staffClass(s, m, t.classId) && (m.role === 'admin' || m.userId === t.createdBy);
const visibleEntry = (s: SchoolDirectory, m: SchoolMember, t: SchoolAttendance, e: AttendanceEntry) => m.role === 'admin' || m.role === 'teacher' && staffClass(s, m, t.classId) && currentPupil(s, t, e) || ownPupil(s, m, e);
const visibleSession = (s: SchoolDirectory, m: SchoolMember, t: SchoolAttendance) => m.role === 'admin' || m.role === 'teacher' && staffClass(s, m, t.classId) || t.entries.some(e => ownPupil(s, m, e));
const bytes = (record: unknown) => new TextEncoder().encode(JSON.stringify(record)).length;
function permissions(s: SchoolDirectory, m: SchoolMember, t: SchoolAttendance, e: AttendanceEntry) {
  const live = t.state === 'active' && t.schoolYear === s.year, capacity = t.receipts.length < MAX_ATTENDANCE_ACTIONS && e.history.length < MAX_ATTENDANCE_EVENTS, pending = e.explanations.at(-1)?.decision === 'pending';
  return { canMark: live && capacity && manages(s, m, t) && currentPupil(s, t, e),
    canReview: live && capacity && pending && e.status === 'absent' && (m.role === 'admin' || manages(s, m, t) && currentPupil(s, t, e)),
    canExplain: live && m.role === 'parent' && ownPupil(s, m, e) && e.status === 'absent' && !pending && e.history.length + 2 <= MAX_ATTENDANCE_EVENTS && t.receipts.length + attendancePending(t) + 2 <= MAX_ATTENDANCE_ACTIONS && bytes(t) + attendancePending(t) * ATTENDANCE_REVIEW_RESERVE + 22000 <= MAX_ATTENDANCE_BYTES,
    canWithdraw: live && capacity && pending && m.role === 'parent' && ownPupil(s, m, e) && e.explanations.at(-1)?.authorId === m.userId };
}
async function records(owner: string): Promise<SchoolAttendance[]> { const rows = await db().prepare('SELECT payload FROM school_records WHERE owner=? AND kind=?').bind(owner, 'class-attendance').all<{ payload: string }>(), result: SchoolAttendance[] = []; for (const row of rows.results) result.push(JSON.parse(new TextDecoder().decode(await decrypt(Uint8Array.from(atob(row.payload), c => c.charCodeAt(0)), owner)))); return result; }
async function seal(owner: string, data: unknown) { const encrypted = await encrypt(new TextEncoder().encode(JSON.stringify(data)), owner); let value = ''; for (const b of encrypted) value += String.fromCharCode(b); return btoa(value); }
async function fingerprint(type: string, data: any) { const { directoryRevision, schoolId, requestId, ...content } = data; if (Array.isArray(content.entries)) content.entries = [...content.entries].sort((a, b) => a.pupilId.localeCompare(b.pupilId)); const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([type, content]))); return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join(''); }
function summary(s: SchoolDirectory, m: SchoolMember, t: SchoolAttendance): AttendanceSessionSummary { const { kind, createdBy, receipts, entries, history, ...view } = t; return { ...view, canManage: manages(s, m, t), historyLimitReached: t.receipts.length >= MAX_ATTENDANCE_ACTIONS, entries: entries.filter(e => visibleEntry(s, m, t, e)).map(e => ({ pupilId: e.pupilId, pupilName: e.pupilName, number: e.number, status: e.status, lateMinutes: e.lateMinutes, note: '', explanationState: e.explanations.at(-1)?.decision, canReview: permissions(s, m, t, e).canReview })) }; }
function entryView(s: SchoolDirectory, m: SchoolMember, t: SchoolAttendance, e: AttendanceEntry) {
  const view = attendanceEntryView(e, permissions(s, m, t, e));
  const privateAccess = m.role === 'admin' || ownPupil(s, m, e) || m.role === 'teacher' && m.userId === t.createdBy && staffClass(s, m, t.classId) && currentPupil(s, t, e);
  if (!privateAccess) { view.explanationRestricted = e.explanations.length > 0; view.explanations = []; view.history = view.history.filter(h => h.action === 'mark' || h.action === 'cancel').map(({ explanation, ...event }) => event); }
  return view;
}

// Bodies, ordinary notes, reasons and parent/actor names never enter the feed.
export async function attendanceInboxNotices(s: SchoolDirectory, m: SchoolMember): Promise<ClassworkNotice[]> {
  const result: ClassworkNotice[] = [], all = await records(scope(s.schoolId));
  for (const t of all) {
    if (!visibleSession(s, m, t)) continue;
    for (const e of t.entries) {
      if (!visibleEntry(s, m, t, e)) continue;
      const privateAccess = m.role === 'admin' || ownPupil(s, m, e) || m.role === 'teacher' && m.userId === t.createdBy && staffClass(s, m, t.classId) && currentPupil(s, t, e);
      for (const [index, h] of e.history.entries()) {
        const ordinary = h.action === 'mark', previous = e.history[index - 1];
        if (!ordinary && !privateAccess) continue;
        if (ordinary && !['absent', 'late', 'excused'].includes(h.status) && !previous) continue;
        if (ordinary && !['absent', 'late', 'excused'].includes(h.status) && previous && !['absent', 'late', 'excused'].includes(previous.status)) continue;
        const pending = e.explanations.at(-1), allowed = permissions(s, m, t, e);
        const decision = h.explanation?.decision;
        const title = ordinary ? h.status === 'absent' ? 'Отбелязано е отсъствие' : h.status === 'late' ? 'Отбелязано е закъснение' : h.status === 'excused' ? 'Записано е извинено отсъствие' : 'Присъствието е коригирано'
          : h.action === 'explain' ? 'Има подадено обяснение' : h.action === 'withdraw' ? 'Обяснението е оттеглено' : h.action === 'cancel' ? 'Часът е отменен'
          : decision === 'approved' ? 'Отсъствието е извинено' : decision === 'declined' ? 'Обяснението е неодобрено' : 'Обяснението е върнато за уточнение';
        const sameRequest = !!pending && pending.id === h.explanation?.id;
        const cancelledAfter = t.history.some(event => event.action === 'cancel' && (event.recordRevision !== undefined && h.recordRevision !== undefined ? event.recordRevision > h.recordRevision : event.at > h.at));
        const returnRelevant = !e.history.slice(index + 1).some(later => later.status !== 'absent' || later.action === 'cancel') && !cancelledAfter;
        const needsAction = sameRequest && (h.action === 'explain' && allowed.canReview || h.action === 'review' && decision === 'returned' && pending?.decision === 'returned' && returnRelevant && m.role === 'parent' && allowed.canExplain);
        result.push({
          id: `attendance-event:${t.id}:${e.pupilId}:${index + 1}`, kind: ordinary ? 'attendance' : 'explanation', title,
          summary: ordinary ? `${h.status === 'absent' ? 'Отсъства' : h.status === 'late' ? 'Закъснение' : h.status === 'excused' ? 'Извинено' : h.status === 'present' ? 'Присъства' : 'Не е отбелязано'}${h.status === 'late' ? ` · ${h.lateMinutes} минути` : ''}. Отвори запазения час за актуалното състояние.`
            : 'Отвори часа за разрешения преглед и запазеното решение. Текстът на обяснението не е включен във входящите.',
          at: h.at, assignmentId: '', assignmentTitle: t.subject + ' · ' + t.date + ' · ' + t.lessonNumber + '. час', attendanceId: t.id,
          subject: t.subject, classId: t.classId, className: t.className, pupilId: e.pupilId, pupilName: s.pupils.find(p => p.id === e.pupilId)?.name || e.pupilName,
          unread: true, needsAction,
        });
      }
    }
  }
  return result;
}

export async function schoolAttendanceHome(user: ChatGPTUser, schoolId?: string, requested?: string): Promise<SchoolAttendanceHome> {
  if (requested) sessionId.parse(requested);
  const h = await schoolHome(user, schoolId), v = h.current;
  const home: SchoolAttendanceHome = { writable: true, preview: false, schools: h.schools, context: v ? { school: v.school, self: v.self ? { userId: v.self.userId, name: v.self.name, role: v.self.role, status: v.self.status } : null, status: v.self?.status || v.request?.status || 'pending', classes: [], pupils: [] } : null, sessions: [], canCreate: false, capacityReached: false };
  if (!v || v.self?.status !== 'active') { if (requested) fail(403, 'Няма активен достъп до този час.'); return home; }
  const snapshot = await schoolDirectorySnapshot(v.school.id); if (!snapshot) fail(404, 'Училището не е намерено.');
  const s = snapshot.state, m = member(s, user.userId), view = directoryView(s, user.userId)!, owner = scope(s.schoolId), all = await records(owner), ledger = await recordSnapshot(owner, 'attendance-ledger');
  home.context = { school: view.school, self: { userId: m.userId, name: m.name, role: m.role, status: m.status }, status: 'active', classes: view.classes, pupils: view.pupils };
  home.capacityReached = Math.max(all.length, Number(ledger.record?.count) || 0) >= MAX_ATTENDANCE_SESSIONS;
  home.canCreate = !home.capacityReached && ['admin', 'teacher'].includes(m.role) && s.classes.some(c => staffClass(s, m, c.id) && s.pupils.some(p => !p.archived && p.classId === c.id));
  for (const t of all) { if (!visibleSession(s, m, t)) continue; const projected = summary(s, m, t); home.sessions.push(projected);
    if (requested === t.id) home.detail = { session: projected, entries: t.entries.filter(e => visibleEntry(s, m, t, e)).map(e => entryView(s, m, t, e)), history: t.history.map(({ actorId, ...event }) => event) };
  }
  home.sessions.sort((a, b) => b.date.localeCompare(a.date) || a.lessonNumber - b.lessonNumber || a.className.localeCompare(b.className, 'bg'));
  if (requested && !home.detail) fail(404, 'Часът не е достъпен за този акаунт.');
  if ((await recordSnapshot(owner, 'directory')).payload !== snapshot.payload) fail(409, 'Училищните права са променени. Обновете присъствията.');
  return home;
}

async function commit(schoolId: string, t: SchoolAttendance, previous: string | null, directory: string, actorName: string, action: string, ledger?: { payload: string | null; count: number; revision: number }) {
  if (t.receipts.length + attendancePending(t) > MAX_ATTENDANCE_ACTIONS || t.entries.some(e => e.history.length + (e.explanations.at(-1)?.decision === 'pending' ? 1 : 0) > MAX_ATTENDANCE_EVENTS) || bytes(t) + attendancePending(t) * ATTENDANCE_REVIEW_RESERVE > MAX_ATTENDANCE_BYTES) fail(409, 'Капацитетът на историята е достигнат. Предишните записи и мястото за текущите прегледи се запазват.');
  const owner = scope(schoolId), at = new Date().toISOString(), payload = await seal(owner, t);
  let guard = ' AND EXISTS (SELECT 1 FROM school_records AS dependency WHERE dependency.owner=? AND dependency.id=? AND dependency.payload=?)', args: unknown[] = [owner, 'directory', directory];
  if (ledger) { guard += ledger.payload === null ? ' AND NOT EXISTS (SELECT 1 FROM school_records WHERE owner=? AND id=?)' : ' AND EXISTS (SELECT 1 FROM school_records WHERE owner=? AND id=? AND payload=?)'; args.push(owner, 'attendance-ledger', ...(ledger.payload === null ? [] : [ledger.payload])); }
  const change = previous === null ? db().prepare('INSERT OR IGNORE INTO school_records(owner,id,kind,payload,updated_at) SELECT ?,?,?,?,? WHERE 1=1' + guard).bind(owner, t.id, t.kind, payload, at, ...args) : db().prepare('UPDATE school_records SET payload=?,updated_at=? WHERE owner=? AND id=? AND payload=?' + guard).bind(payload, at, owner, t.id, previous, ...args);
  const writes = [change], saved = 'EXISTS (SELECT 1 FROM school_records WHERE owner=? AND id=? AND payload=?)';
  if (ledger) { const next = { id: 'attendance-ledger', kind: 'class-attendance-ledger', count: ledger.count + 1, revision: ledger.revision + 1 }; writes.push(db().prepare('INSERT INTO school_records(owner,id,kind,payload,updated_at) SELECT ?,?,?,?,? WHERE ' + saved + ' ON CONFLICT(owner,id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').bind(owner, next.id, next.kind, await seal(owner, next), at, owner, t.id, payload)); }
  const audit = { id: crypto.randomUUID(), kind: 'school-audit', event: action, actor: actorName, at, detail: t.className + ' · ' + t.date + ' · ' + t.lessonNumber + '. час · ' + t.subject };
  writes.push(db().prepare('INSERT INTO school_records(owner,id,kind,payload,updated_at) SELECT ?,?,?,?,? WHERE ' + saved).bind(owner, audit.id, audit.kind, await seal(owner, audit), at, owner, t.id, payload));
  const result = await db().batch(writes); if (result[0].meta.changes !== 1) fail(409, 'Часът, капацитетът или училищните права са променени. Обновете данните.');
}

export async function schoolAttendanceCommand(user: ChatGPTUser, type: string, input: unknown) {
  const schema = Object.hasOwn(schemas, type) ? schemas[type as keyof typeof schemas] : null; if (!schema) fail(400, 'Непознато действие за присъствие.');
  const d: any = schema.parse(input), snapshot = await schoolDirectorySnapshot(d.schoolId); if (!snapshot) fail(404, 'Училището не е намерено.');
  const s = snapshot.state, m = member(s, user.userId), owner = scope(s.schoolId), key = type === 'attendance-create' ? attendanceSessionId(d.classId, d.date, d.lessonNumber) : d.sessionId;
  const target = await recordSnapshot(owner, key), old = target.record as unknown as SchoolAttendance | null;
  if (old && old.kind !== 'class-attendance') fail(409, 'Този идентификатор принадлежи на друг запис.');
  if (old && !visibleSession(s, m, old)) fail(404, 'Часът не е достъпен за този акаунт.');
  const digest = await fingerprint(type, d), receipt = old?.receipts.find(r => r.id === d.requestId);
  if (receipt) { if (receipt.actorId !== m.userId || receipt.fingerprint !== digest) fail(409, 'Тази заявка вече е записана с различни данни.'); return schoolAttendanceHome(user, s.schoolId, key); }
  if (s.revision !== d.directoryRevision) fail(409, 'Училищните права са променени. Обновете данните.');
  const now = new Date().toISOString(); let t: SchoolAttendance, ledger: { payload: string | null; count: number; revision: number } | undefined;
  if (type === 'attendance-create') {
    if (!staffClass(s, m, d.classId)) fail(403, 'Само назначен учител или администратор може да създаде час за този клас.');
    if (old) fail(409, 'За този клас, ден и учебен час вече има запис. Отворете го за преглед.');
    if (d.date > schoolToday() || !gradeInSchoolYear(d.date, s.year)) fail(400, 'Датата трябва да е в учебната година и да не е в бъдещето.');
    const pupils = s.pupils.filter(p => p.classId === d.classId && !p.archived); if (!pupils.length || pupils.length > 100) fail(400, 'Часът изисква активен списък от 1 до 100 ученици в пилота.');
    const index = await recordSnapshot(owner, 'attendance-ledger'); if (index.record && index.record.kind !== 'class-attendance-ledger') fail(409, 'Индексът на присъствията е невалиден.');
    const count = index.record?.count ?? (await db().prepare('SELECT COUNT(*) AS n FROM school_records WHERE owner=? AND kind=?').bind(owner, 'class-attendance').first<{ n: number }>())?.n ?? 0;
    if (count >= MAX_ATTENDANCE_SESSIONS) fail(409, 'Капацитетът за нови часове в пилота е достигнат. Предишните записи се запазват.');
    ledger = { payload: index.payload, count, revision: index.record?.revision || 0 };
    t = { id: key, kind: 'class-attendance', classId: d.classId, className: s.classes.find(c => c.id === d.classId)!.name, schoolYear: s.year, date: d.date, lessonNumber: d.lessonNumber, subject: d.subject, topic: d.topic, state: 'active', createdBy: m.userId, teacherName: m.name, createdAt: now, revision: 1, entries: pupils.sort((a, b) => a.number - b.number).map(p => ({ pupilId: p.id, pupilName: p.name, number: p.number, status: 'unmarked', lateMinutes: 0, note: '', explanations: [], history: [] })), history: [{ subject: d.subject, topic: d.topic, state: 'active', action: 'create', at: now, recordRevision: 1, actorId: m.userId, actorName: m.name, reason: '' }], receipts: [] };
  } else {
    if (!old) fail(404, 'Часът не е намерен.');
    if (old.revision !== d.revision) fail(409, 'Има по-нов запис за този час. Обновете версията преди промяна.');
    t = structuredClone(old);
    if (t.schoolYear !== s.year) fail(403, 'По-ранните учебни години са само за преглед.');
    const event = (e: AttendanceEntry, action: AttendanceEvent['action'], reason = '') => { const explanation = e.explanations.at(-1); e.history.push({ status: e.status, lateMinutes: e.lateMinutes, note: e.note, action, actorId: m.userId, actorName: m.name, at: now, recordRevision: t.revision + 1, reason, ...(explanation ? { explanation: structuredClone(explanation) } : {}) }); };
    const finishPending = (e: AttendanceEntry, reason: string) => { const explanation = e.explanations.at(-1); if (explanation?.decision === 'pending') Object.assign(explanation, { decision: 'cancelled', decisionById: m.userId, decisionByName: m.name, decisionAt: now, decisionNote: reason }); };
    if (type === 'attendance-edit' || type === 'attendance-state') {
      if (!manages(s, m, t)) fail(403, 'Само авторът за активен назначен клас или администратор може да промени часа.');
      if (type === 'attendance-edit') { if (t.state !== 'active') fail(409, 'Възстановете отменения час преди редакция.'); if (t.subject === d.subject && t.topic === d.topic) fail(409, 'Няма промяна в данните за часа.'); t.subject = d.subject; t.topic = d.topic; }
      else { const next = d.action === 'cancel' ? 'cancelled' : 'active'; if (t.state === next) fail(409, 'Часът вече е в това състояние.'); t.state = next; if (next === 'cancelled') for (const e of t.entries) if (e.explanations.at(-1)?.decision === 'pending') { finishPending(e, d.reason); event(e, 'cancel', d.reason); } }
      t.history.push({ subject: t.subject, topic: t.topic, state: t.state, action: type === 'attendance-edit' ? 'edit' : d.action, reason: d.reason, at: now, recordRevision: t.revision + 1, actorId: m.userId, actorName: m.name });
    } else {
      if (t.state !== 'active') fail(409, 'Отмененият час е само за преглед.');
      if (type === 'attendance-mark') {
        if (!manages(s, m, t)) fail(403, 'Само авторът за назначен клас или администратор може да отбелязва присъствие.');
        if (new Set(d.entries.map((e: any) => e.pupilId)).size !== d.entries.length) fail(400, 'Премахнете повторените ученици.');
        for (const input of d.entries) { const e = t.entries.find(e => e.pupilId === input.pupilId); if (!e || !currentPupil(s, t, e)) fail(403, 'Изберете активен ученик от първоначалния списък на този клас.'); if (!attendanceMarkChanged(e, input)) fail(409, 'Няма промяна за един от избраните ученици.'); if ((e.status !== 'unmarked' || input.status === 'excused') && d.reason.length < 5) fail(400, 'Добавете причина за корекцията или извиняването.'); Object.assign(e, { status: input.status, lateMinutes: input.lateMinutes, note: input.note }); if (e.status !== 'absent') finishPending(e, d.reason); event(e, 'mark', d.reason); }
      } else {
        const e = t.entries.find(e => e.pupilId === d.pupilId); if (!e || !visibleEntry(s, m, t, e)) fail(404, 'Ученическият запис не е достъпен.');
        const allowed = permissions(s, m, t, e), latest = e.explanations.at(-1);
        if (type === 'attendance-explain') {
          if (m.role !== 'parent' || !ownPupil(s, m, e)) fail(403, 'Само свързан родител може да подаде обяснение.');
          if (e.status !== 'absent' || latest?.decision === 'pending') fail(409, 'Няма отсъствие, което да приема ново обяснение.');
          if (!allowed.canExplain) fail(409, 'Няма свободно място за ново обяснение и последващия му преглед. Историята остава достъпна.');
          e.explanations.push({ id: d.requestId, authorId: m.userId, parentName: m.name, body: d.body, at: now, decision: 'pending' }); event(e, 'explain');
        } else {
          if (!latest || latest.id !== d.explanationId || latest.decision !== 'pending') fail(409, 'Обяснението вече е променено или разгледано.');
          if (type === 'attendance-review') { if (!allowed.canReview) fail(403, 'Само авторът за текущия клас или администратор може да разгледа това обяснение.'); Object.assign(latest, { decision: d.decision, decisionById: m.userId, decisionByName: m.name, decisionAt: now, decisionNote: d.reason }); if (d.decision === 'approved') { e.status = 'excused'; e.lateMinutes = 0; } event(e, 'review', d.reason); }
          else { if (!allowed.canWithdraw) fail(403, 'Само подалият свързан родител може да оттегли текущото обяснение.'); Object.assign(latest, { decision: 'withdrawn', decisionById: m.userId, decisionByName: m.name, decisionAt: now, decisionNote: d.reason }); event(e, 'withdraw', d.reason); }
        }
      }
    }
    t.revision++;
  }
  t.receipts.push({ id: d.requestId, actorId: m.userId, fingerprint: digest });
  await commit(s.schoolId, t, target.payload, snapshot.payload, m.name, type, ledger);
  return schoolAttendanceHome(user, s.schoolId, t.id);
}
