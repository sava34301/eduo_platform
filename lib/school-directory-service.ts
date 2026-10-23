import { z } from 'zod';
import { db, encrypt, decrypt, getRecord, recordSnapshot } from './store';
import { directoryView, type SchoolDirectory, type SchoolHome, type SchoolRole, type SchoolMember, type SchoolAudit } from './school-directory-data';
import type { ChatGPTUser } from '@/app/chatgpt-auth';

export class SchoolDirectoryError extends Error { constructor(public status: number, message: string) { super(message); } }
function fail(status: number, text: string): never { throw new SchoolDirectoryError(status, text); }
const id = z.string().uuid(), revision = z.number().int().positive();
const name = z.string().trim().min(3).max(120).refine(s => !/[\r\n\u0000-\u001f]/.test(s), 'Името трябва да е на един ред.');
const short = z.string().trim().max(160), note = z.string().trim().min(5).max(500);
const role = z.enum(['admin', 'teacher', 'parent', 'student']);
const requestedRole = z.enum(['teacher', 'parent', 'student']);
const pupil = z.object({ name, number: z.number().int().min(1).max(100) });
const year = z.string().regex(/^20\d{2}\/20\d{2}$/).refine(s => Number(s.slice(5)) === Number(s.slice(0, 4)) + 1);
const access = { role, classIds: z.array(id).max(50), pupilIds: z.array(id).max(20), verified: z.literal(true), note };
const schemas = {
  'create-school': z.object({ requestId: id, name, town: name, year }),
  'request-access': z.object({ requestId: id, code: z.string().trim().regex(/^[A-Fa-f0-9]{32}$/), name, role: requestedRole, note: z.string().trim().max(500) }),
  'withdraw-access': z.object({ schoolId: id, revision, requestId: id }),
  'edit-school': z.object({ schoolId: id, revision, name, town: name }),
  'class-save': z.object({ schoolId: id, revision, id, name: z.string().trim().min(2).max(40), grade: z.number().int().min(1).max(12), room: short }),
  'class-status': z.object({ schoolId: id, revision, id, archived: z.boolean() }),
  'pupil-save': z.object({ schoolId: id, revision, id, classId: id, ...pupil.shape }),
  'pupil-status': z.object({ schoolId: id, revision, id, archived: z.boolean() }),
  'roster-import': z.object({ schoolId: id, revision, requestId: id, classId: id, rows: z.array(pupil).min(1).max(100) }),
  'access-review': z.object({ schoolId: id, revision, requestId: id, decision: z.enum(['approve', 'reject']), role, classIds: z.array(id).max(50), pupilIds: z.array(id).max(20), verified: z.boolean(), note }),
  'member-access': z.object({ schoolId: id, revision, userId: z.string().min(1).max(250), ...access }),
  'member-status': z.object({ schoolId: id, revision, userId: z.string().min(1).max(250), status: z.enum(['active', 'suspended']), note }),
  'rotate-code': z.object({ schoolId: id, revision }),
} as const;
const schoolScope = (schoolId: string) => 'eduo-school:' + schoolId;
const membershipScope = (userId: string) => 'eduo-memberships:' + userId;
const joinScope = 'eduo-school-join-index';
const userName = (u: ChatGPTUser) => (u.fullName || u.displayName || u.email).slice(0, 120);
const hash = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))).map(n => n.toString(16).padStart(2, '0')).join('');
const joinCode = () => Array.from(crypto.getRandomValues(new Uint8Array(16))).map(n => n.toString(16).padStart(2, '0')).join('');
async function seal(scope: string, value: unknown) { const bytes = await encrypt(new TextEncoder().encode(JSON.stringify(value)), scope); let text = ''; for (const byte of bytes) text += String.fromCharCode(byte); return btoa(text); }
async function unseal<T>(scope: string, payload: string): Promise<T> { return JSON.parse(new TextDecoder().decode(await decrypt(Uint8Array.from(atob(payload), c => c.charCodeAt(0)), scope))); }

export async function schoolDirectorySnapshot(schoolId: string) {
  const current = await recordSnapshot(schoolScope(schoolId), 'directory');
  if (current.record?.kind !== 'school-directory') return null;
  return { state: current.record as unknown as SchoolDirectory, payload: current.payload! };
}
const snapshot = schoolDirectorySnapshot;

// Directory, audit and discovery indexes change in the same guarded D1 batch.
// Membership indexes are only discovery hints: every read and write checks the
// encrypted directory again, including status, class scope and pupil links.
async function commitSchool(s: SchoolDirectory, previous: string | null, actor: ChatGPTUser, event: string, detail: string, indexUsers: string[] = [], newJoinCode = false) {
  const scope = schoolScope(s.schoolId), at = new Date().toISOString(), payload = await seal(scope, s);
  const change = previous === null
    ? db().prepare('INSERT OR IGNORE INTO school_records(owner,id,kind,payload,updated_at) VALUES(?,?,?,?,?)').bind(scope, 'directory', 'school-directory', payload, at)
    : db().prepare('UPDATE school_records SET payload=?,updated_at=? WHERE owner=? AND id=? AND payload=?').bind(payload, at, scope, 'directory', previous);
  const audit = { id: crypto.randomUUID(), kind: 'school-audit', event, actor: userName(actor), actorId: actor.userId, at, detail };
  const writes = [change];
  const conditional = async (owner: string, recordId: string, kind: string, value: unknown) => {
    writes.push(db().prepare('INSERT INTO school_records(owner,id,kind,payload,updated_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM school_records WHERE owner=? AND id=? AND payload=?) ON CONFLICT(owner,id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').bind(owner, recordId, kind, await seal(owner, value), at, scope, 'directory', payload));
  };
  await conditional(scope, audit.id, 'school-audit', audit);
  for (const userId of new Set(indexUsers)) await conditional(membershipScope(userId), s.schoolId, 'school-membership-index', { schoolId: s.schoolId });
  if (newJoinCode) await conditional(joinScope, await hash(s.joinCode), 'school-join-index', { schoolId: s.schoolId });
  const result = await db().batch(writes);
  if (result[0].meta.changes !== 1) fail(409, 'Училищната среда е променена. Обновете данните и опитайте отново.');
}

export async function schoolHome(user: ChatGPTUser, selected?: string): Promise<SchoolHome> {
  if (selected) id.parse(selected);
  const scope = membershipScope(user.userId);
  const rows = await db().prepare('SELECT payload FROM school_records WHERE owner=? AND kind=?').bind(scope, 'school-membership-index').all<{ payload: string }>();
  const views = (await Promise.all(rows.results.map(async r => {
    const p = await unseal<{ schoolId: string }>(scope, r.payload), saved = await snapshot(p.schoolId);
    return saved ? directoryView(saved.state, user.userId) : null;
  }))).filter((s): s is NonNullable<typeof s> => !!s);
  let current = selected ? views.find(v => v.school.id === selected) || null : views[0] || null;
  if (selected && !current) fail(404, 'Няма достъп до тази училищна среда.');
  if (current?.self?.status === 'active' && current.self.role === 'admin') {
    const scope = schoolScope(current.school.id);
    const rows = await db().prepare('SELECT payload FROM school_records WHERE owner=? AND kind=? ORDER BY updated_at DESC LIMIT 80').bind(scope, 'school-audit').all<{ payload: string }>();
    const audit = await Promise.all(rows.results.map(r => unseal<SchoolAudit>(scope, r.payload)));
    current = { ...current, audit };
  }
  return { writable: true, preview: false, identity: { name: userName(user), email: user.email }, schools: views.map(v => ({ id: v.school.id, name: v.school.name, year: v.school.year, status: v.self?.status || v.request?.status || 'pending', role: v.self?.role })), current };
}

function requireAdmin(s: SchoolDirectory, userId: string) {
  const m = s.members.find(m => m.userId === userId && m.status === 'active');
  if (m?.role !== 'admin') fail(403, 'Това действие е достъпно само за одобрен училищен администратор.');
}
function activeClass(s: SchoolDirectory, classId: string) { const c = s.classes.find(c => c.id === classId && !c.archived); if (!c) fail(400, 'Изберете активен клас.'); return c; }
function validatePupilNumber(s: SchoolDirectory, classId: string, number: number, pupilId?: string) { if (s.pupils.some(p => p.id !== pupilId && !p.archived && p.classId === classId && p.number === number)) fail(409, `Номер ${number} вече е зает в този клас.`); }
function validAssignment(s: SchoolDirectory, data: { role: SchoolRole; classIds: string[]; pupilIds: string[] }, userId: string) {
  if (new Set(data.classIds).size !== data.classIds.length || new Set(data.pupilIds).size !== data.pupilIds.length) fail(400, 'Премахнете повторените връзки.');
  if (data.role === 'admin' && (data.classIds.length || data.pupilIds.length)) fail(400, 'Администраторът има училищен обхват, без отделни връзки.');
  if (data.role === 'teacher' && (!data.classIds.length || data.pupilIds.length)) fail(400, 'Учителят трябва да има поне един клас.');
  if (['parent', 'student'].includes(data.role) && (!data.pupilIds.length || data.classIds.length)) fail(400, 'Свържете акаунта с ученически профил.');
  if (data.role === 'student' && data.pupilIds.length !== 1) fail(400, 'Ученическият акаунт се свързва точно с един профил.');
  data.classIds.forEach(c => activeClass(s, c));
  for (const pupilId of data.pupilIds) {
    const p = s.pupils.find(p => p.id === pupilId && !p.archived); if (!p) fail(400, 'Изберете активен ученик.'); activeClass(s, p!.classId);
    if (data.role === 'student' && s.members.some(m => m.userId !== userId && m.status === 'active' && m.role === 'student' && m.pupilIds.includes(pupilId))) fail(409, 'Този ученик вече има активен свързан акаунт.');
  }
}

export async function schoolCommand(user: ChatGPTUser, type: string, input: unknown): Promise<SchoolHome> {
  const schema = Object.hasOwn(schemas, type) ? schemas[type as keyof typeof schemas] : null; if (!schema) fail(400, 'Непознато училищно действие.');
  const d: any = schema.parse(input), now = new Date().toISOString();
  if (type === 'create-school') {
    const found = await snapshot(d.requestId);
    if (found) { if (found.state.createdBy !== user.userId || found.state.name !== d.name || found.state.town !== d.town || found.state.year !== d.year) fail(409, 'Тази заявка вече е използвана.'); return schoolHome(user, d.requestId); }
    const s: SchoolDirectory = { id: 'directory', kind: 'school-directory', schoolId: d.requestId, revision: 1, name: d.name, town: d.town, year: d.year, createdAt: now, createdBy: user.userId, joinCode: joinCode(), classes: [], pupils: [], requests: [], imports: [], members: [{ userId: user.userId, name: userName(user), email: user.email, role: 'admin', status: 'active', classIds: [], pupilIds: [], approvedAt: now, approvedBy: user.userId, verificationNote: 'Създател на училищната среда' }] };
    await commitSchool(s, null, user, type, 'Създадена училищна среда', [user.userId], true);
    return schoolHome(user, s.schoolId);
  }
  if (type === 'request-access') {
    const code = d.code.toLowerCase(), pointer = await getRecord(joinScope, await hash(code));
    const saved = pointer ? await snapshot(pointer.schoolId) : null;
    if (!saved || saved.state.joinCode !== code) fail(404, 'Кодът не е валиден. Поискайте актуален код от училището.');
    const { state: s, payload } = saved!;
    const member = s.members.find(m => m.userId === user.userId);
    if (member?.status === 'suspended') fail(403, 'Достъпът е спрян. Свържете се с училищния администратор.');
    if (member) return schoolHome(user, s.schoolId);
    const previous = s.requests.find(r => r.id === d.requestId);
    if (previous) { if (previous.userId !== user.userId || previous.name !== d.name || previous.role !== d.role || previous.note !== d.note) fail(409, 'Тази заявка вече е използвана.'); return schoolHome(user, s.schoolId); }
    if (s.requests.some(r => r.userId === user.userId && r.status === 'pending')) fail(409, 'Вече имате заявка за преглед в това училище.');
    if (s.requests.length >= 500) fail(409, 'Достигнат е лимитът за заявки в този пилот. Свържете се с администратора.');
    s.requests.push({ id: d.requestId, userId: user.userId, email: user.email, name: d.name, role: d.role, note: d.note, status: 'pending', createdAt: now }); s.revision++;
    await commitSchool(s, payload, user, type, 'Получена заявка за училищен достъп', [user.userId]); return schoolHome(user, s.schoolId);
  }
  const saved = await snapshot(d.schoolId); if (!saved) fail(404, 'Няма достъп до тази училищна среда.');
  const { state: s, payload } = saved!;
  if (type === 'withdraw-access') {
    const request = s.requests.find(r => r.id === d.requestId && r.userId === user.userId); if (!request) fail(404, 'Заявката не е намерена.');
    if (request!.status !== 'pending') fail(409, 'Заявката вече е обработена.');
    if (s.revision !== d.revision) fail(409, 'Данните са променени. Обновете страницата.');
    request!.status = 'withdrawn'; request!.reviewedAt = now; request!.reviewedBy = user.userId;
    s.revision++; await commitSchool(s, payload, user, type, 'Кандидатът оттегли своята заявка'); return schoolHome(user, s.schoolId);
  }
  requireAdmin(s, user.userId);
  if (type === 'roster-import') {
    const digest = await hash(JSON.stringify({ classId: d.classId, rows: d.rows })), previous = s.imports.find(x => x.requestId === d.requestId);
    if (previous) { if (previous.digest !== digest) fail(409, 'Този импорт вече е използван за различен списък.'); return schoolHome(user, s.schoolId); }
  }
  if (s.revision !== d.revision) fail(409, 'Има по-нова промяна. Обновете данните преди запис.');
  let detail = '';
  if (type === 'edit-school') { s.name = d.name; s.town = d.town; detail = 'Обновени данни на училището'; }
  if (type === 'class-save') {
    if (s.classes.some(c => c.id !== d.id && !c.archived && c.name.toLocaleLowerCase('bg') === d.name.toLocaleLowerCase('bg'))) fail(409, 'Вече има активен клас с това име.');
    const current = s.classes.find(c => c.id === d.id);
    if (current?.archived) fail(409, 'Първо възстановете класа.');
    if (current) Object.assign(current, { name: d.name, grade: d.grade, room: d.room });
    else { if (s.classes.length >= 100) fail(409, 'Пилотът поддържа до 100 класа.'); s.classes.push({ id: d.id, name: d.name, grade: d.grade, room: d.room, archived: false }); }
    detail = `${current ? 'Обновен' : 'Добавен'} клас ${d.name}`;
  }
  if (type === 'class-status') {
    const c = s.classes.find(c => c.id === d.id); if (!c) fail(404, 'Класът не е намерен.');
    if (c!.archived === d.archived) fail(409, 'Състоянието вече е записано.');
    if (d.archived && (s.pupils.some(p => p.classId === d.id && !p.archived) || s.members.some(m => m.status === 'active' && m.classIds.includes(d.id)))) fail(409, 'Първо преместете или архивирайте учениците и променете активните учителски назначения.');
    if (!d.archived && s.classes.some(x => x.id !== d.id && !x.archived && x.name.toLocaleLowerCase('bg') === c!.name.toLocaleLowerCase('bg'))) fail(409, 'Активен клас вече използва това име.');
    c!.archived = d.archived; detail = `${d.archived ? 'Архивиран' : 'Възстановен'} клас ${c!.name}`;
  }
  if (type === 'pupil-save') {
    activeClass(s, d.classId); validatePupilNumber(s, d.classId, d.number, d.id);
    const current = s.pupils.find(p => p.id === d.id); if (current?.archived) fail(409, 'Първо възстановете ученика.');
    if (current) Object.assign(current, { name: d.name, number: d.number, classId: d.classId });
    else { if (s.pupils.length >= 2000) fail(409, 'Достигнат е лимитът за ученици в пилота.'); s.pupils.push({ id: d.id, name: d.name, number: d.number, classId: d.classId, archived: false }); }
    detail = `${current ? 'Обновен' : 'Добавен'} ученик ${d.name}`;
  }
  if (type === 'pupil-status') {
    const p = s.pupils.find(p => p.id === d.id); if (!p) fail(404, 'Ученикът не е намерен.');
    if (p!.archived === d.archived) fail(409, 'Състоянието вече е записано.');
    if (d.archived && s.members.some(m => m.status === 'active' && m.pupilIds.includes(d.id))) fail(409, 'Първо променете връзките или спрете активните акаунти за този ученик.');
    if (!d.archived) { activeClass(s, p!.classId); validatePupilNumber(s, p!.classId, p!.number, p!.id); }
    p!.archived = d.archived; detail = `${d.archived ? 'Архивиран' : 'Възстановен'} ученик ${p!.name}`;
  }
  if (type === 'roster-import') {
    const c = activeClass(s, d.classId);
    if (new Set(d.rows.map((p: any) => p.number)).size !== d.rows.length) fail(400, 'Списъкът съдържа повтарящи се номера.');
    if (s.pupils.length + d.rows.length > 2000) fail(409, 'Достигнат е лимитът за ученици в пилота.');
    for (const p of d.rows) validatePupilNumber(s, d.classId, p.number);
    s.pupils.push(...d.rows.map((p: any) => ({ ...p, id: crypto.randomUUID(), classId: d.classId, archived: false })));
    s.imports.push({ requestId: d.requestId, classId: d.classId, digest: await hash(JSON.stringify({ classId: d.classId, rows: d.rows })) });
    detail = `Добавени ${d.rows.length} ученици в ${c!.name}`;
  }
  if (type === 'access-review') {
    const r = s.requests.find(r => r.id === d.requestId); if (!r) fail(404, 'Заявката не е намерена.');
    if (r!.status !== 'pending') fail(409, 'Заявката вече е обработена.');
    if (d.decision === 'approve') {
      if (!d.verified) fail(400, 'Потвърдете проверката на самоличността и връзката с училището.');
      if (s.members.some(m => m.userId === r!.userId)) fail(409, 'Акаунтът вече има записано членство. Променете го от „Акаунти“.');
      validAssignment(s, d, r!.userId);
      s.members.push({ userId: r!.userId, name: r!.name, email: r!.email, role: d.role, classIds: d.classIds, pupilIds: d.pupilIds, status: 'active', approvedAt: now, approvedBy: user.userId, verificationNote: d.note });
    }
    r!.status = d.decision === 'approve' ? 'approved' : 'rejected'; r!.reviewedAt = now; r!.reviewedBy = user.userId; r!.reviewNote = d.note;
    detail = `${d.decision === 'approve' ? 'Одобрена' : 'Отказана'} заявка на ${r!.name}`;
  }
  if (type === 'member-access' || type === 'member-status') {
    const m = s.members.find(m => m.userId === d.userId); if (!m) fail(404, 'Акаунтът не е намерен.');
    if (m!.userId === user.userId) fail(400, 'Не можете да променяте собствените си административни права тук.');
    if (type === 'member-access') { validAssignment(s, d, m!.userId); Object.assign(m!, { role: d.role, classIds: d.classIds, pupilIds: d.pupilIds, verificationNote: d.note, approvedAt: now, approvedBy: user.userId }); detail = `Променен обхват на ${m!.name}`; }
    else { if (d.status === m!.status) fail(409, 'Състоянието вече е записано.'); if (d.status === 'active') validAssignment(s, m!, m!.userId); m!.status = d.status; m!.verificationNote = d.note; detail = `${d.status === 'active' ? 'Възстановен' : 'Спрян'} достъп на ${m!.name}`; }
  }
  if (type === 'rotate-code') { s.joinCode = joinCode(); detail = 'Сменен код за заявяване на достъп'; }
  s.revision++;
  await commitSchool(s, payload, user, type, detail, [], type === 'rotate-code');
  return schoolHome(user, s.schoolId);
}
