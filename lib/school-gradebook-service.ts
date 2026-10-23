import { z } from 'zod';
import { db, encrypt, decrypt, recordSnapshot } from './store';
import { schoolHome, schoolDirectorySnapshot, SchoolDirectoryError } from './school-directory-service';
import { directoryView, type SchoolDirectory, type SchoolMember } from './school-directory-data';
import { MAX_SCHOOL_GRADES, MAX_GRADE_VERSIONS, gradeView, gradeInSchoolYear, gradeKindOf, gradeSummaryKey, comparableGradeFields, type GradeFields, type GradeVersion, type SchoolGrade, type SchoolGradebookHome } from './school-gradebook-data';
import { schoolToday } from './platform-data';
import type { ChatGPTUser } from '@/app/chatgpt-auth';
import type { ClassworkNotice } from './classwork-inbox-data';

function fail(status: number, message: string): never { throw new SchoolDirectoryError(status, message); }
const id = z.string().uuid(), positive = z.number().int().positive();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => { const d = new Date(s + 'T12:00:00Z'); return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; });
const singleLine = z.string().trim().min(2).max(100).refine(s => !/[\u0000-\u001f]/.test(s));
const fields = z.object({ subject: singleLine, value: z.number().int().min(2).max(6), assessment: z.enum(['oral', 'written', 'test', 'project', 'practical', 'homework']), date, term: z.enum(['first', 'second']), feedback: z.string().trim().max(1000).default(''), gradeKind: z.enum(['current', 'term', 'annual']).default('current') }).strict().superRefine((f, ctx) => {
  if (f.gradeKind === 'annual' && f.term !== 'second') ctx.addIssue({ code: 'custom', message: 'Годишната оценка се записва към края на втория срок.' });
});
const base = { schoolId: id, directoryRevision: positive, id, requestId: id, confirmed: z.literal(true) };
const reason = z.string().trim().min(5).max(500);
const schemas = {
  'grade-add': z.object({ ...base, revision: z.literal(0), pupilId: id, classId: id, fields }).strict(),
  'grade-correct': z.object({ ...base, revision: positive, fields, reason }).strict(),
  'grade-state': z.object({ ...base, revision: positive, action: z.enum(['annul', 'restore']), reason }).strict(),
};
const scope = (schoolId: string) => 'eduo-school:' + schoolId;
const activeClass = (s: SchoolDirectory, classId: string) => s.classes.some(c => c.id === classId && !c.archived);
function member(s: SchoolDirectory, userId: string) { const m = s.members.find(m => m.userId === userId && m.status === 'active'); return m || fail(403, 'Необходим е активен одобрен училищен акаунт.'); }
function staffClass(s: SchoolDirectory, m: SchoolMember, classId: string) { return activeClass(s, classId) && (m.role === 'admin' || m.role === 'teacher' && m.classIds.includes(classId)); }
function canRead(s: SchoolDirectory, m: SchoolMember, g: SchoolGrade) {
  if (m.role === 'admin') return true;
  const p = s.pupils.find(p => p.id === g.pupilId && !p.archived && activeClass(s, p.classId));
  if (!p) return false;
  return m.role === 'teacher' ? p.classId === g.classId && staffClass(s, m, g.classId) : m.pupilIds.includes(p.id);
}
function canManage(s: SchoolDirectory, m: SchoolMember, g: SchoolGrade) {
  if (g.schoolYear !== s.year) return false;
  const p = s.pupils.find(p => p.id === g.pupilId && !p.archived && activeClass(s, p.classId));
  if (!p) return false;
  if (m.role === 'admin' && gradeKindOf(g.fields) !== 'current') return true;
  return p.classId === g.classId && staffClass(s, m, g.classId) && (m.role === 'admin' || g.createdBy === m.userId);
}
async function grades(owner: string): Promise<SchoolGrade[]> {
  const rows = await db().prepare('SELECT payload FROM school_records WHERE owner=? AND kind=?').bind(owner, 'class-grade').all<{ payload: string }>();
  const result: SchoolGrade[] = [];
  for (const row of rows.results) result.push(JSON.parse(new TextDecoder().decode(await decrypt(Uint8Array.from(atob(row.payload), c => c.charCodeAt(0)), owner))));
  return result;
}
async function seal(owner: string, data: unknown) { const bytes = await encrypt(new TextEncoder().encode(JSON.stringify(data)), owner); let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
async function fingerprint(type: string, data: any) { const { requestId, directoryRevision, schoolId, ...content } = data; if (content.fields) content.fields = comparableGradeFields(content.fields); const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([type, content]))); return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join(''); }

// Called only with the inbox's server-captured active directory/member snapshot.
export async function gradebookInboxNotices(s: SchoolDirectory, m: SchoolMember): Promise<ClassworkNotice[]> {
  const all = await grades(scope(s.schoolId));
  return all.filter(g => canRead(s, m, g) && (m.role !== 'teacher' || g.createdBy === m.userId)).flatMap(g => g.versions.map(v => {
    const kind = gradeKindOf(v.fields), label = kind === 'current' ? 'Текуща' : kind === 'term' ? 'Срочна' : 'Годишна';
    const period = kind === 'annual' ? 'учебна година' : v.fields.term === 'first' ? 'първи срок' : 'втори срок';
    return {
      id: `grade:${g.id}:${v.revision}`, kind: 'grade' as const, title: v.action === 'add' ? 'Има записана оценка' : v.action === 'correct' ? 'Оценката е коригирана' : v.action === 'annul' ? 'Оценката е анулирана' : 'Оценката е възстановена',
      summary: `${label} оценка · ${v.fields.value} · ${period}. Отвори дневника за обратната връзка и точната история.`, at: v.at,
      assignmentId: '', assignmentTitle: v.fields.subject + ' · ' + g.schoolYear, gradeId: g.id,
      subject: v.fields.subject, classId: g.classId, className: g.className, pupilId: g.pupilId,
      pupilName: s.pupils.find(p => p.id === g.pupilId)?.name || g.pupilName, unread: true, needsAction: false,
    };
  }));
}

type SummaryIndex = { id: 'grade-summary-index'; kind: 'class-grade-summary-index'; revision: number; slots: Record<string, string> };
type SummaryChange = { previous: string | null; next: SummaryIndex };
async function summaryChange(owner: string, old: SchoolGrade | null, next: SchoolGrade): Promise<SummaryChange | undefined> {
  const oldKey = old && gradeSummaryKey(old), nextKey = gradeSummaryKey(next);
  if (!oldKey && !nextKey) return undefined;
  const saved = await recordSnapshot(owner, 'grade-summary-index');
  if (saved.record && (saved.record.kind !== 'class-grade-summary-index' || !Number.isInteger(saved.record.revision) || !saved.record.slots || typeof saved.record.slots !== 'object' || Array.isArray(saved.record.slots))) fail(409, 'Индексът на срочните и годишните оценки е невалиден. Записът не е променен.');
  const index: SummaryIndex = saved.record ? structuredClone(saved.record) as unknown as SummaryIndex : { id: 'grade-summary-index', kind: 'class-grade-summary-index', revision: 0, slots: {} };
  if (!saved.record) {
    for (const g of await grades(owner)) {
      const key = gradeSummaryKey(g); if (!key || g.status !== 'recorded') continue;
      if (index.slots[key] && index.slots[key] !== g.id) fail(409, 'Има противоречиви обобщени оценки. Необходим е преглед на запазените записи.');
      index.slots[key] = g.id;
    }
  }
  if (oldKey && old?.status === 'recorded') {
    if (index.slots[oldKey] !== old.id) fail(409, 'Обобщената оценка и индексът не съвпадат. Записът не е променен.');
    delete index.slots[oldKey];
  }
  if (nextKey && next.status === 'recorded') {
    if (index.slots[nextKey] && index.slots[nextKey] !== next.id) fail(409, 'Вече има активна срочна или годишна оценка за този ученик, предмет и период. Отворете съществуващата оценка.');
    index.slots[nextKey] = next.id;
  }
  index.revision++;
  if (Object.keys(index.slots).length > MAX_SCHOOL_GRADES || new TextEncoder().encode(JSON.stringify(index)).length > 800000) fail(409, 'Капацитетът на обобщените оценки е достигнат. Предишните записи остават запазени.');
  return { previous: saved.payload, next: index };
}

export async function schoolGradebookHome(user: ChatGPTUser, schoolId?: string, gradeId?: string): Promise<SchoolGradebookHome> {
  if (gradeId) id.parse(gradeId);
  const h = await schoolHome(user, schoolId), v = h.current;
  const home: SchoolGradebookHome = { writable: true, preview: false, schools: h.schools, context: v ? { school: v.school, self: v.self ? { userId: v.self.userId, name: v.self.name, role: v.self.role, status: v.self.status } : null, status: v.self?.status || v.request?.status || 'pending', classes: [], pupils: [] } : null, grades: [], canRecord: false, capacityReached: false };
  if (!v || v.self?.status !== 'active') { if (gradeId) fail(403, 'Няма активен достъп до тази оценка.'); return home; }
  const snapshot = await schoolDirectorySnapshot(v.school.id); if (!snapshot) fail(404, 'Училището не е намерено.');
  const s = snapshot.state, m = member(s, user.userId), view = directoryView(s, user.userId)!;
  home.context = { school: view.school, self: { userId: m.userId, name: m.name, role: m.role, status: m.status }, status: 'active', classes: view.classes, pupils: view.pupils };
  const owner = scope(s.schoolId), all = await grades(owner), ledger = await recordSnapshot(owner, 'grade-ledger');
  home.capacityReached = Math.max(all.length, Number(ledger.record?.count) || 0) >= MAX_SCHOOL_GRADES;
  home.canRecord = !home.capacityReached && ['admin', 'teacher'].includes(m.role) && s.classes.some(c => staffClass(s, m, c.id) && s.pupils.some(p => !p.archived && p.classId === c.id));
  home.grades = all.filter(g => canRead(s, m, g)).map(g => gradeView(g, canManage(s, m, g))).sort((a, b) => b.fields.date.localeCompare(a.fields.date) || b.versions.at(-1)!.at.localeCompare(a.versions.at(-1)!.at) || a.id.localeCompare(b.id));
  if (gradeId) { home.detail = home.grades.find(g => g.id === gradeId); if (!home.detail) fail(404, 'Оценката не е достъпна за този акаунт.'); }
  if ((await recordSnapshot(owner, 'directory')).payload !== snapshot.payload) fail(409, 'Училищните права са променени. Обновете дневника.');
  return home;
}

async function commit(schoolId: string, record: SchoolGrade, previous: string | null, directory: string, user: ChatGPTUser, ledger?: { payload: string | null; count: number; revision: number }, summary?: SummaryChange) {
  if (new TextEncoder().encode(JSON.stringify(record)).length > 120000) fail(409, 'Историята е достигнала размера за този пилот. Записите остават достъпни.');
  const owner = scope(schoolId), at = new Date().toISOString(), payload = await seal(owner, record);
  let guard = ' AND EXISTS (SELECT 1 FROM school_records AS dependency WHERE dependency.owner=? AND dependency.id=? AND dependency.payload=?)', args: unknown[] = [owner, 'directory', directory];
  if (ledger) { guard += ledger.payload === null ? ' AND NOT EXISTS (SELECT 1 FROM school_records WHERE owner=? AND id=?)' : ' AND EXISTS (SELECT 1 FROM school_records WHERE owner=? AND id=? AND payload=?)'; args.push(owner, 'grade-ledger', ...(ledger.payload === null ? [] : [ledger.payload])); }
  if (summary) { guard += summary.previous === null ? ' AND NOT EXISTS (SELECT 1 FROM school_records WHERE owner=? AND id=?)' : ' AND EXISTS (SELECT 1 FROM school_records WHERE owner=? AND id=? AND payload=?)'; args.push(owner, 'grade-summary-index', ...(summary.previous === null ? [] : [summary.previous])); }
  const change = previous === null ? db().prepare('INSERT OR IGNORE INTO school_records(owner,id,kind,payload,updated_at) SELECT ?,?,?,?,? WHERE 1=1' + guard).bind(owner, record.id, record.kind, payload, at, ...args) : db().prepare('UPDATE school_records SET payload=?,updated_at=? WHERE owner=? AND id=? AND payload=?' + guard).bind(payload, at, owner, record.id, previous, ...args);
  const writes = [change], saved = 'EXISTS (SELECT 1 FROM school_records WHERE owner=? AND id=? AND payload=?)';
  if (summary) writes.push(db().prepare('INSERT INTO school_records(owner,id,kind,payload,updated_at) SELECT ?,?,?,?,? WHERE ' + saved + ' ON CONFLICT(owner,id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').bind(owner, summary.next.id, summary.next.kind, await seal(owner, summary.next), at, owner, record.id, payload));
  if (ledger) {
    const next = { id: 'grade-ledger', kind: 'class-grade-ledger', count: ledger.count + 1, revision: ledger.revision + 1 }, nextPayload = await seal(owner, next);
    writes.push(db().prepare('INSERT INTO school_records(owner,id,kind,payload,updated_at) SELECT ?,?,?,?,? WHERE ' + saved + ' ON CONFLICT(owner,id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').bind(owner, next.id, next.kind, nextPayload, at, owner, record.id, payload));
  }
  const version = record.versions.at(-1)!, audit = { id: crypto.randomUUID(), kind: 'school-audit', event: 'grade-' + version.action, actor: version.actorName, actorId: user.userId, at, detail: record.pupilName + ' · ' + record.fields.subject + ' · ' + record.fields.value };
  writes.push(db().prepare('INSERT INTO school_records(owner,id,kind,payload,updated_at) SELECT ?,?,?,?,? WHERE ' + saved).bind(owner, audit.id, audit.kind, await seal(owner, audit), at, owner, record.id, payload));
  const results = await db().batch(writes); if (results[0].meta.changes !== 1) fail(409, 'Оценката, капацитетът или училищните права са променени. Обновете данните.');
}

export async function schoolGradebookCommand(user: ChatGPTUser, type: string, input: unknown) {
  const schema = Object.hasOwn(schemas, type) ? schemas[type as keyof typeof schemas] : null; if (!schema) fail(400, 'Непознато действие за оценка.');
  const d: any = schema.parse(input), snapshot = await schoolDirectorySnapshot(d.schoolId); if (!snapshot) fail(404, 'Училището не е намерено.');
  const s = snapshot.state, m = member(s, user.userId), owner = scope(s.schoolId);
  if (!['admin', 'teacher'].includes(m.role)) fail(403, 'Само одобрен учител или администратор може да записва оценки.');
  const target = await recordSnapshot(owner, d.id), old = target.record as unknown as SchoolGrade | null;
  if (old && old.kind !== 'class-grade') fail(409, 'Този идентификатор принадлежи на друг запис.');
  if (old && !canRead(s, m, old)) fail(404, 'Оценката не е достъпна за този акаунт.');
  const digest = await fingerprint(type, d), receipt = old?.versions.find(v => v.requestId === d.requestId);
  if (receipt) { if (receipt.actorId !== user.userId || receipt.fingerprint !== digest) fail(409, 'Тази заявка е записана с други данни.'); return schoolGradebookHome(user, s.schoolId, old!.id); }
  if (s.revision !== d.directoryRevision) fail(409, 'Училищните права са променени. Обновете дневника.');
  const now = new Date().toISOString(), actorName = m.name;
  let record: SchoolGrade, ledger: { payload: string | null; count: number; revision: number } | undefined;
  const version = (revision: number, gradeFields: GradeFields, status: SchoolGrade['status'], action: GradeVersion['action'], reason = ''): GradeVersion => ({ revision, fields: gradeFields, status, action, reason, actorId: user.userId, actorName, at: now, requestId: d.requestId, fingerprint: digest });
  if (type === 'grade-add') {
    if (old) fail(409, 'Оценката вече съществува. Отворете я за корекция.');
    const p = s.pupils.find(p => p.id === d.pupilId && !p.archived); if (!p || !staffClass(s, m, p.classId)) fail(403, 'Изберете активен ученик от назначен клас.');
    if (p.classId !== d.classId) fail(409, 'Ученикът вече е в друг клас. Обновете списъка преди запис.');
    const index = await recordSnapshot(owner, 'grade-ledger'); if (index.record && index.record.kind !== 'class-grade-ledger') fail(409, 'Индексът на дневника е невалиден.');
    const count = index.record?.count ?? (await db().prepare('SELECT COUNT(*) AS n FROM school_records WHERE owner=? AND kind=?').bind(owner, 'class-grade').first<{ n: number }>())?.n ?? 0;
    if (count >= MAX_SCHOOL_GRADES) fail(409, 'Достигнат е капацитетът за нови оценки в пилота. Съществуващите оценки остават достъпни.');
    ledger = { payload: index.payload, count, revision: index.record?.revision || 0 };
    record = { id: d.id, kind: 'class-grade', pupilId: p.id, classId: p.classId, pupilName: p.name, className: s.classes.find(c => c.id === p.classId)!.name, schoolYear: s.year, createdBy: user.userId, teacherName: actorName, createdAt: now, revision: 1, fields: d.fields, status: 'recorded', versions: [version(1, d.fields, 'recorded', 'add')] };
  } else {
    if (!old) fail(404, 'Оценката не е намерена.');
    if (!canManage(s, m, old)) fail(403, 'Само авторът за текущия активен клас или администратор може да промени тази оценка.');
    if (old.revision !== d.revision) fail(409, 'Има по-нова версия на оценката. Обновете я преди корекция.');
    if (old.versions.length >= MAX_GRADE_VERSIONS) fail(409, 'Достигнат е лимитът на корекциите. Историята остава достъпна.');
    let status = old.status, next = old.fields, action: GradeVersion['action'];
    if (type === 'grade-correct') { if (old.status !== 'recorded') fail(409, 'Възстановете анулираната оценка преди корекция.'); if (gradeKindOf(old.fields) !== gradeKindOf(d.fields)) fail(409, 'Видът на запазената оценка не се преобразува чрез корекция.'); if (JSON.stringify(comparableGradeFields(old.fields)) === JSON.stringify(comparableGradeFields(d.fields))) fail(409, 'Няма промяна в оценката.'); next = d.fields; action = 'correct'; }
    else { status = d.action === 'annul' ? 'annulled' : 'recorded'; if (status === old.status) fail(409, 'Оценката вече е в това състояние.'); action = d.action; }
    record = { ...old, revision: old.revision + 1, fields: next, status, versions: [...old.versions, version(old.revision + 1, next, status, action, d.reason)] };
  }
  if (record.fields.date > schoolToday() || !gradeInSchoolYear(record.fields.date, s.year)) fail(400, 'Датата трябва да е в избраната учебна година и да не е в бъдещето.');
  const summary = await summaryChange(owner, old, record);
  await commit(s.schoolId, record, target.payload, snapshot.payload, user, ledger, summary);
  return schoolGradebookHome(user, s.schoolId, record.id);
}
