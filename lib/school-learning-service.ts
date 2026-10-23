import { z } from 'zod';
import { db, encrypt, decrypt, recordSnapshot } from './store';
import { schoolHome, schoolDirectorySnapshot, SchoolDirectoryError } from './school-directory-service';
import { directoryView, type SchoolDirectory, type SchoolMember } from './school-directory-data';
import { lessonCondition, currentLearningStatus, learningProgressView, type SchoolLesson, type LessonProgress, type LessonCondition, type LessonSummary, type SchoolLearningHome } from './school-learning-data';
import type { ChatGPTUser } from '@/app/chatgpt-auth';

function fail(status: number, message: string): never { throw new SchoolDirectoryError(status, message); }
const id = z.string().uuid(), revision = z.number().int().min(0), base = { schoolId: id, directoryRevision: z.number().int().positive() };
const sourceUrl = z.string().trim().max(2000).refine(s => { if (!s) return true; try { const u = new URL(s); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } });
const fields = { classId: id, title: z.string().trim().min(3).max(200), subject: z.string().trim().min(2).max(120), summary: z.string().trim().min(5).max(500), body: z.string().trim().min(20).max(20000), sourceTitle: z.string().trim().min(3).max(200), sourceUrl };
const schemas = {
  'lesson-save': z.object({ ...base, id, requestId: id, revision, ...fields }).strict(),
  'lesson-state': z.object({ ...base, id, revision, action: z.enum(['publish', 'archive', 'restore']), confirmed: z.literal(true), reason: z.string().trim().max(500).default('') }).strict(),
  'checkpoint': z.object({ ...base, lessonId: id, lessonRevision: z.number().int().positive(), edition: z.number().int().positive(), revision, requestId: id, status: z.enum(['read', 'understood', 'needs-help']) }).strict(),
};
const scope = (schoolId: string) => 'eduo-school:' + schoolId;
const progressId = (lessonId: string, pupilId: string) => 'lesson-work:' + lessonId + ':' + pupilId;
function member(s: SchoolDirectory, userId: string) { const m = s.members.find(m => m.userId === userId && m.status === 'active'); if (!m) fail(403, 'Необходим е активен одобрен училищен акаунт.'); return m; }
function staffClass(s: SchoolDirectory, m: SchoolMember, classId: string) { return s.classes.some(c => c.id === classId && !c.archived) && (m.role === 'admin' || m.role === 'teacher' && m.classIds.includes(classId)); }
function manages(s: SchoolDirectory, m: SchoolMember, l: SchoolLesson) { return staffClass(s, m, l.classId) && (m.role === 'admin' || l.createdBy === m.userId); }
function ownPupils(s: SchoolDirectory, m: SchoolMember) { return s.pupils.filter(p => !p.archived && m.pupilIds.includes(p.id) && s.classes.some(c => c.id === p.classId && !c.archived)); }
function currentVisible(s: SchoolDirectory, m: SchoolMember, l: SchoolLesson) {
  return m.role === 'admin' || m.role === 'teacher' && staffClass(s, m, l.classId) && (l.status === 'published' || l.createdBy === m.userId) || ['parent', 'student'].includes(m.role) && l.status === 'published' && ownPupils(s, m).some(p => p.classId === l.classId);
}
function visibleProgress(s: SchoolDirectory, m: SchoolMember, l: SchoolLesson, all: LessonProgress[]) {
  const permitted = m.role === 'admin' ? s.pupils : m.role === 'teacher' ? s.pupils.filter(p => !p.archived && p.classId === l.classId && staffClass(s, m, l.classId)) : ownPupils(s, m);
  return all.filter(p => p.lessonId === l.id && permitted.some(x => x.id === p.pupilId));
}
async function seal(owner: string, record: unknown) { const bytes = await encrypt(new TextEncoder().encode(JSON.stringify(record)), owner); let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
async function records<T>(owner: string, kind: string): Promise<T[]> {
  const r = await db().prepare('SELECT payload FROM school_records WHERE owner=? AND kind=?').bind(owner, kind).all<{ payload: string }>();
  return Promise.all(r.results.map(async row => JSON.parse(new TextDecoder().decode(await decrypt(Uint8Array.from(atob(row.payload), c => c.charCodeAt(0)), owner)))));
}
function history(l: SchoolLesson) {
  if (l.history.length >= 40) fail(409, 'Достигнат е лимитът от 40 по-ранни версии. Историята остава запазена.');
  return [...l.history, { ...lessonCondition(l), revision: l.revision, classId: l.classId, status: l.status, archived: l.archived, savedAt: l.updatedAt, ...(l.saveRequest ? { saveRequest: l.saveRequest } : {}) }];
}
const contentKey = (l: Omit<LessonCondition, 'edition'>) => JSON.stringify([l.title, l.subject, l.summary, l.body, l.sourceTitle, l.sourceUrl]);
async function fingerprint(d: any) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([d.revision, d.classId, contentKey(d)]))); return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join(''); }

export async function schoolLearningHome(user: ChatGPTUser, schoolId?: string, lessonId?: string): Promise<SchoolLearningHome> {
  const h = await schoolHome(user, schoolId), v = h.current;
  const home: SchoolLearningHome = { writable: true, preview: false, schools: h.schools, context: v ? { school: v.school, self: v.self ? { userId: v.self.userId, name: v.self.name, role: v.self.role, status: v.self.status } : null, status: v.self?.status || v.request?.status || 'pending', classes: v.classes, pupils: v.pupils } : null, lessons: [] };
  if (!v || v.self?.status !== 'active') { if (lessonId) fail(403, 'Няма активен достъп до този урок.'); return home; }
  if (lessonId) id.parse(lessonId);
  const saved = await schoolDirectorySnapshot(v.school.id); if (!saved) fail(404, 'Училището не е намерено.');
  const s = saved.state, m = member(s, user.userId), projected = directoryView(s, user.userId)!;
  home.context = { school: projected.school, self: { userId: m.userId, name: m.name, role: m.role, status: m.status }, status: 'active', classes: projected.classes, pupils: projected.pupils };
  const [lessons, progress] = await Promise.all([records<SchoolLesson>(scope(s.schoolId), 'class-lesson'), records<LessonProgress>(scope(s.schoolId), 'class-learning-progress')]);
  for (const l of lessons) {
    const current = currentVisible(s, m, l), allowed = visibleProgress(s, m, l, progress);
    // A family can retain only the published source snapshots in its own work.
    if (!current && !(['student', 'parent'].includes(m.role) && l.status === 'published' && allowed.length)) continue;
    const retained = [...allowed.flatMap(p => p.checkpoints)].sort((a, b) => b.at.localeCompare(a.at))[0];
    const condition = current ? lessonCondition(l) : retained.condition;
    const pupils = ['student', 'parent'].includes(m.role) ? ownPupils(s, m).filter(p => p.classId === l.classId || allowed.some(x => x.pupilId === p.id)) : s.pupils.filter(p => !p.archived && p.classId === l.classId || m.role === 'admin' && allowed.some(x => x.pupilId === p.id));
    const counts = allowed.map(p => current ? currentLearningStatus(p, l.edition) : 'earlier');
    const summary: LessonSummary = { id: l.id, classId: l.classId, title: condition.title, subject: condition.subject, summary: condition.summary, edition: condition.edition, revision: current ? l.revision : 0, status: l.status, archived: current && l.archived, authorName: l.authorName, updatedAt: current ? l.updatedAt : retained.at, className: s.classes.find(c => c.id === l.classId)?.name || 'Архивиран клас', canManage: manages(s, m, l), retained: !current, expected: pupils.length, read: counts.filter(c => c === 'read').length, understood: counts.filter(c => c === 'understood').length, needsHelp: counts.filter(c => c === 'needs-help').length, earlier: counts.filter(c => c === 'earlier').length };
    home.lessons.push(summary);
    if (lessonId === l.id) {
      const versions = current ? [...l.history.filter(v => m.role === 'admin' || m.role === 'teacher' && staffClass(s, m, v.classId) && (v.status === 'published' || l.createdBy === m.userId) || ['student', 'parent'].includes(m.role) && v.status === 'published' && v.classId === l.classId).map(v => ({ condition: lessonCondition(v), at: v.savedAt })), { condition, at: l.updatedAt }] : allowed.flatMap(p => p.checkpoints.map(c => ({ condition: c.condition, at: c.at })));
      const editions = Array.from(new Map(versions.map(v => [v.condition.edition, v])).values()).sort((a, b) => b.condition.edition - a.condition.edition);
      home.detail = { lesson: { ...summary, condition, history: editions.filter(v => v.condition.edition !== condition.edition), canCheckpoint: m.role === 'student' && current && !l.archived && l.status === 'published' && ownPupils(s, m).some(p => p.classId === l.classId) }, pupils, progress: allowed.map(learningProgressView) };
    }
  }
  home.lessons.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  if (lessonId && !home.detail) fail(404, 'Урокът не е достъпен за този акаунт.');
  return home;
}

async function commit(schoolId: string, record: SchoolLesson | LessonProgress, previous: string | null, guards: { id: string; payload: string }[], user: ChatGPTUser, event: string, detail: string) {
  if (JSON.stringify(record).length > 500000) fail(409, 'Достигнат е размерът на историята в пилота. Записите остават запазени.');
  const owner = scope(schoolId), now = new Date().toISOString(), payload = await seal(owner, record);
  const guard = guards.map(() => ' AND EXISTS (SELECT 1 FROM school_records AS dependency WHERE dependency.owner=? AND dependency.id=? AND dependency.payload=?)').join(''), args = guards.flatMap(g => [owner, g.id, g.payload]);
  const change = previous === null ? db().prepare('INSERT OR IGNORE INTO school_records(owner,id,kind,payload,updated_at) SELECT ?,?,?,?,? WHERE 1=1' + guard).bind(owner, record.id, record.kind, payload, now, ...args) : db().prepare('UPDATE school_records SET payload=?,updated_at=? WHERE owner=? AND id=? AND payload=?' + guard).bind(payload, now, owner, record.id, previous, ...args);
  const audit = { id: crypto.randomUUID(), kind: 'school-audit', event, actor: user.fullName || user.displayName || user.email, actorId: user.userId, at: now, detail };
  const auditWrite = db().prepare('INSERT INTO school_records(owner,id,kind,payload,updated_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM school_records WHERE owner=? AND id=? AND payload=?)').bind(owner, audit.id, audit.kind, await seal(owner, audit), now, owner, record.id, payload);
  const result = await db().batch([change, auditWrite]); if (result[0].meta.changes !== 1) fail(409, 'Урокът, напредъкът или училищните права са променени. Обновете данните.');
}

export async function schoolLearningCommand(user: ChatGPTUser, type: string, input: unknown): Promise<SchoolLearningHome> {
  const schema = Object.hasOwn(schemas, type) ? schemas[type as keyof typeof schemas] : null; if (!schema) fail(400, 'Непознато действие за учебен материал.');
  const d: any = schema.parse(input), saved = await schoolDirectorySnapshot(d.schoolId); if (!saved) fail(404, 'Училището не е намерено.');
  const s = saved.state, m = member(s, user.userId), owner = scope(s.schoolId), now = new Date().toISOString(), guards = [{ id: 'directory', payload: saved.payload }];
  if (s.revision !== d.directoryRevision) fail(409, 'Училищните права са променени. Обновете данните.');
  if (type === 'checkpoint') {
    const p = ownPupils(s, m)[0]; if (m.role !== 'student' || !p) fail(403, 'Само свързаният ученик може да отбележи своята работа.');
    const task = await recordSnapshot(owner, d.lessonId), l = task.record as unknown as SchoolLesson | null;
    if (l?.kind !== 'class-lesson' || l.status !== 'published' || p.classId !== l.classId) fail(404, 'Няма публикуван урок за твоя клас.');
    const target = await recordSnapshot(owner, progressId(l.id, p.id)), old = target.record as unknown as LessonProgress | null;
    if (old && old.kind !== 'class-learning-progress') fail(409, 'Невалиден запис за учебна работа.');
    const receipt = old?.checkpoints.find(c => c.id === d.requestId);
    if (receipt) { if (receipt.actorId !== user.userId || receipt.status !== d.status || receipt.condition.edition !== d.edition) fail(409, 'Тази заявка вече е записана с различни данни.'); return schoolLearningHome(user, s.schoolId, l.id); }
    if (l.archived) fail(409, 'Урокът е архивиран. Историята остава достъпна.');
    if (l.revision !== d.lessonRevision || l.edition !== d.edition || (old?.revision || 0) !== d.revision) fail(409, 'Има по-нова версия на урока или отбелязването. Обновете данните.');
    if ((old?.checkpoints.length || 0) >= 60) fail(409, 'Достигнат е лимитът от 60 отбелязвания за този урок. Историята остава.');
    const record: LessonProgress = { id: progressId(l.id, p.id), kind: 'class-learning-progress', lessonId: l.id, pupilId: p.id, revision: (old?.revision || 0) + 1, checkpoints: [...(old?.checkpoints || []), { id: d.requestId, actorId: user.userId, at: now, status: d.status, condition: lessonCondition(l) }] };
    guards.push({ id: l.id, payload: task.payload! });
    await commit(s.schoolId, record, target.payload, guards, user, 'learning-checkpoint', `${p.name}: ${d.status === 'needs-help' ? 'нужда от помощ' : d.status === 'understood' ? 'разбирам' : 'прочетох'} · „${l.title}“ · версия ${l.edition}`);
    return schoolLearningHome(user, s.schoolId, l.id);
  }
  const original = await recordSnapshot(owner, d.id), old = original.record as unknown as SchoolLesson | null;
  if (old && (old.kind !== 'class-lesson' || !manages(s, m, old))) fail(403, 'Само авторът или училищният администратор може да променя този урок.');
  let record: SchoolLesson, event: string;
  if (type === 'lesson-save') {
    if (!staffClass(s, m, d.classId)) fail(403, 'Създавайте материали само за назначен клас.');
    const intent = await fingerprint(d), receipt = old && [old.saveRequest, ...old.history.map(h => h.saveRequest)].find(r => r?.id === d.requestId);
    if (receipt) { if (receipt.actorId !== user.userId || receipt.fingerprint !== intent) fail(409, 'Тази заявка вече е използвана за различни данни.'); return schoolLearningHome(user, s.schoolId, d.id); }
    if ((old?.revision || 0) !== d.revision) fail(409, 'Има по-нова версия на урока.');
    if (old && (old.archived || old.status === 'published' && old.classId !== d.classId)) fail(409, 'Възстановете архивирания урок. Класът на публикуван материал не се сменя.');
    if (!old) { const count = await db().prepare('SELECT COUNT(*) AS count FROM school_records WHERE owner=? AND kind=?').bind(owner, 'class-lesson').first<{ count: number }>(); if ((count?.count || 0) >= 250) fail(409, 'Пилотът поддържа до 250 учебни материала за училище.'); }
    const content: LessonCondition = { edition: old ? old.edition + (contentKey(old) !== contentKey(d) ? 1 : 0) : 1, title: d.title, subject: d.subject, summary: d.summary, body: d.body, sourceTitle: d.sourceTitle, sourceUrl: d.sourceUrl };
    record = { ...(old || { id: d.id, kind: 'class-lesson', status: 'draft', archived: false, createdBy: user.userId, authorName: m.name, createdAt: now }), ...content, classId: d.classId, revision: (old?.revision || 0) + 1, updatedAt: now, history: old ? history(old) : [], saveRequest: { id: d.requestId, actorId: user.userId, fingerprint: intent } };
    event = old ? 'lesson-updated' : 'lesson-created';
  } else {
    if (!old) fail(404, 'Урокът не е намерен.');
    if (old.revision !== d.revision) fail(409, 'Има по-нова версия на урока.');
    if (d.action === 'publish' && (old.status !== 'draft' || old.archived) || d.action === 'archive' && old.archived || d.action === 'restore' && !old.archived) fail(409, 'Действието вече е записано или не е приложимо.');
    if (d.action === 'archive' && d.reason.length < 5) fail(400, 'Добавете причина за архивирането.');
    record = { ...old, history: history(old), revision: old.revision + 1, status: d.action === 'publish' ? 'published' : old.status, archived: d.action === 'archive' ? true : d.action === 'restore' ? false : old.archived, updatedAt: now };
    event = 'lesson-' + d.action;
  }
  await commit(s.schoolId, record, original.payload, guards, user, event, `Учебен материал „${record.title}“${d.reason ? ': ' + d.reason : ''}`);
  return schoolLearningHome(user, s.schoolId, record.id);
}
