import { z } from 'zod';
import { db, encrypt, decrypt, recordSnapshot } from './store';
import { schoolHome, schoolDirectorySnapshot, SchoolDirectoryError } from './school-directory-service';
import { directoryView, type SchoolDirectory, type SchoolMember, type DirectoryPupil } from './school-directory-data';
import { lessonCondition, type SchoolLesson } from './school-learning-data';
import { practiceCondition, practiceConditionView, practiceWorkView, latestCurrentAttempt, practiceAnalysis, type SchoolPractice, type PracticeWork, type PracticeQuestion, type PracticeCondition, type PracticeSummary, type SchoolPracticeHome } from './school-practice-data';
import type { ChatGPTUser } from '@/app/chatgpt-auth';

function fail(status: number, message: string): never { throw new SchoolDirectoryError(status, message); }
const id = z.string().uuid(), revision = z.number().int().min(0), positive = z.number().int().positive();
const option = z.object({ id, text: z.string().trim().min(1).max(300) }).strict();
const question = z.object({ id, prompt: z.string().trim().min(5).max(1000), options: z.array(option).min(2).max(5), correctOptionId: id, explanation: z.string().trim().min(5).max(2000), points: z.number().int().min(1).max(5) }).strict().superRefine((q, ctx) => {
  if (new Set(q.options.map(o => o.id)).size !== q.options.length || new Set(q.options.map(o => o.text.toLocaleLowerCase('bg'))).size !== q.options.length) ctx.addIssue({ code: 'custom', message: 'Отговорите трябва да са различни.' });
  if (!q.options.some(o => o.id === q.correctOptionId)) ctx.addIssue({ code: 'custom', message: 'Посочете верен отговор от въведените.' });
});
const questions = z.array(question).min(1).max(12).superRefine((qs, ctx) => { if (new Set(qs.map(q => q.id)).size !== qs.length) ctx.addIssue({ code: 'custom', message: 'Въпросите трябва да имат различни идентификатори.' }); });
const base = { schoolId: id, directoryRevision: positive };
const schemas = {
  'practice-save': z.object({ ...base, id, requestId: id, revision, lessonId: id, lessonRevision: positive, title: z.string().trim().min(3).max(200), instructions: z.string().trim().min(5).max(2000), questions }).strict(),
  'practice-state': z.object({ ...base, id, revision: positive, action: z.enum(['publish', 'archive', 'restore']), confirmed: z.literal(true), reason: z.string().trim().max(500).default('') }).strict(),
  'practice-attempt': z.object({ ...base, practiceId: id, practiceRevision: positive, edition: positive, revision, requestId: id, answers: z.array(z.object({ questionId: id, optionId: id }).strict()).min(1).max(12), reflection: z.string().trim().max(1000).default('') }).strict(),
};
const scope = (schoolId: string) => 'eduo-school:' + schoolId;
const workId = (practiceId: string, pupilId: string) => 'practice-work:' + practiceId + ':' + pupilId;
function member(s: SchoolDirectory, userId: string) { const m = s.members.find(m => m.userId === userId && m.status === 'active'); if (!m) fail(403, 'Необходим е активен одобрен училищен акаунт.'); return m; }
function staffClass(s: SchoolDirectory, m: SchoolMember, classId: string) { return s.classes.some(c => c.id === classId && !c.archived) && (m.role === 'admin' || m.role === 'teacher' && m.classIds.includes(classId)); }
function manages(s: SchoolDirectory, m: SchoolMember, p: SchoolPractice) { return staffClass(s, m, p.classId) && (m.role === 'admin' || p.createdBy === m.userId); }
function ownPupils(s: SchoolDirectory, m: SchoolMember) { return s.pupils.filter(p => !p.archived && m.pupilIds.includes(p.id) && s.classes.some(c => c.id === p.classId && !c.archived)); }
function visibleNow(s: SchoolDirectory, m: SchoolMember, p: SchoolPractice) { return m.role === 'admin' || m.role === 'teacher' && staffClass(s, m, p.classId) && (p.status === 'published' || p.createdBy === m.userId) || ['student', 'parent'].includes(m.role) && p.status === 'published' && ownPupils(s, m).some(x => x.classId === p.classId); }
function permittedPupils(s: SchoolDirectory, m: SchoolMember, p: SchoolPractice, works: PracticeWork[]): DirectoryPupil[] {
  if (['student', 'parent'].includes(m.role)) return ownPupils(s, m).filter(x => x.classId === p.classId || works.some(w => w.pupilId === x.id));
  return s.pupils.filter(x => !x.archived && x.classId === p.classId && staffClass(s, m, p.classId) || m.role === 'admin' && works.some(w => w.pupilId === x.id));
}
async function records<T>(owner: string, kind: string): Promise<T[]> {
  const rows = await db().prepare('SELECT payload FROM school_records WHERE owner=? AND kind=?').bind(owner, kind).all<{ payload: string }>();
  const result: T[] = [];
  for (const row of rows.results) result.push(JSON.parse(new TextDecoder().decode(await decrypt(Uint8Array.from(atob(row.payload), c => c.charCodeAt(0)), owner))));
  return result;
}
async function seal(owner: string, record: unknown) { const bytes = await encrypt(new TextEncoder().encode(JSON.stringify(record)), owner); let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
async function digest(value: unknown) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))); return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join(''); }
const contentKey = (p: Omit<PracticeCondition, 'edition'>) => JSON.stringify([p.title, p.instructions, p.source, p.questions]);
function history(p: SchoolPractice) {
  if (p.history.length >= 40) fail(409, 'Достигнат е лимитът от 40 по-ранни версии. Историята остава запазена.');
  return [...p.history, { ...practiceCondition(p), revision: p.revision, status: p.status, archived: p.archived, savedAt: p.updatedAt, ...(p.saveRequest ? { saveRequest: p.saveRequest } : {}) }];
}

export async function schoolPracticeHome(user: ChatGPTUser, schoolId?: string, practiceId?: string, lessonId?: string): Promise<SchoolPracticeHome> {
  const h = await schoolHome(user, schoolId), v = h.current;
  const home: SchoolPracticeHome = { writable: true, preview: false, schools: h.schools, context: v ? { school: v.school, self: v.self ? { userId: v.self.userId, name: v.self.name, role: v.self.role, status: v.self.status } : null, status: v.self?.status || v.request?.status || 'pending', classes: v.classes, pupils: v.pupils } : null, practices: [], lessons: [] };
  if (!v || v.self?.status !== 'active') { if (practiceId) fail(403, 'Няма активен достъп до това упражнение.'); return home; }
  if (practiceId) id.parse(practiceId); if (lessonId) id.parse(lessonId);
  const saved = await schoolDirectorySnapshot(v.school.id); if (!saved) fail(404, 'Училището не е намерено.');
  const s = saved.state, m = member(s, user.userId), projection = directoryView(s, user.userId)!;
  home.context = { school: projection.school, self: { userId: m.userId, name: m.name, role: m.role, status: m.status }, status: 'active', classes: projection.classes, pupils: projection.pupils };
  const owner = scope(s.schoolId);
  const [practices, works, lessons] = await Promise.all([records<SchoolPractice>(owner, 'class-practice'), records<PracticeWork>(owner, 'class-practice-work'), records<SchoolLesson>(owner, 'class-lesson')]);
  if (['admin', 'teacher'].includes(m.role)) home.lessons = lessons.filter(l => l.status === 'published' && !l.archived && staffClass(s, m, l.classId)).map(l => ({ id: l.id, classId: l.classId, className: s.classes.find(c => c.id === l.classId)!.name, revision: l.revision, edition: l.edition, title: l.title, subject: l.subject })).sort((a, b) => a.title.localeCompare(b.title, 'bg'));
  for (const p of practices) {
    if (lessonId && p.lessonId !== lessonId) continue;
    const all = works.filter(w => w.practiceId === p.id), pupils = permittedPupils(s, m, p, all), allowed = all.filter(w => pupils.some(x => x.id === w.pupilId)), current = visibleNow(s, m, p);
    if (!current && !(['student', 'parent'].includes(m.role) && p.status === 'published' && allowed.length)) continue;
    // Transferred families receive only their completed source/question snapshots.
    const retained = allowed.flatMap(w => w.attempts).sort((a, b) => b.at.localeCompare(a.at))[0];
    const condition = current ? practiceCondition(p) : retained.condition;
    const roster = pupils.filter(x => !x.archived && x.classId === p.classId), currentWorks = allowed.filter(w => roster.some(x => x.id === w.pupilId));
    const summary: PracticeSummary = { id: p.id, lessonId: p.lessonId, classId: p.classId, revision: current ? p.revision : 0, edition: condition.edition, title: condition.title, status: p.status, archived: current && p.archived, authorName: p.authorName, updatedAt: current ? p.updatedAt : retained.at, subject: condition.source.subject, lessonTitle: condition.source.title, sourceEdition: condition.source.edition, className: s.classes.find(c => c.id === p.classId)?.name || 'Архивиран клас', canManage: manages(s, m, p), retained: !current, expected: current ? roster.length : pupils.length, completed: current ? currentWorks.filter(w => !!latestCurrentAttempt(w, p.edition)).length : 0, earlier: current ? allowed.filter(w => w.attempts.length && !latestCurrentAttempt(w, p.edition)).length : allowed.length, questionCount: condition.questions.length, maxPoints: condition.questions.reduce((n, q) => n + q.points, 0) };
    home.practices.push(summary);
    if (practiceId === p.id) {
      const source = lessons.find(l => l.id === p.lessonId), sourceAvailable = current && !!source && (m.role === 'admin' || source.status === 'published' && (m.role === 'teacher' ? staffClass(s, m, source.classId) : ownPupils(s, m).some(x => x.classId === source.classId)));
      const versions = current ? p.history.filter(v => m.role === 'admin' || m.role === 'teacher' && p.createdBy === m.userId || v.status === 'published').map(v => ({ edition: v.edition, title: v.title, sourceEdition: v.source.edition, at: v.savedAt })) : allowed.flatMap(w => w.attempts.map(a => ({ edition: a.condition.edition, title: a.condition.title, sourceEdition: a.condition.source.edition, at: a.at })));
      const versionsByEdition = Array.from(new Map(versions.map(v => [v.edition, v])).values()).filter(v => v.edition !== condition.edition).sort((a, b) => b.edition - a.edition);
      const attemptLimitReached = m.role === 'student' && allowed.some(w => w.attempts.length >= 40);
      home.detail = { practice: { ...summary, condition: practiceConditionView(condition), canAttempt: m.role === 'student' && current && !attemptLimitReached && p.status === 'published' && !p.archived && !!source && source.status === 'published' && !source.archived && ownPupils(s, m).some(x => x.classId === p.classId), attemptLimitReached, sourceChanged: current && !!source && source.edition !== p.source.edition, sourceAvailable, history: versionsByEdition }, pupils, works: allowed.map(practiceWorkView), ...(summary.canManage ? { answerKey: p.questions } : {}), ...(['admin', 'teacher'].includes(m.role) ? { analysis: practiceAnalysis(p.questions, currentWorks, p.edition) } : {}) };
    }
  }
  home.practices.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  if (practiceId && !home.detail) fail(404, 'Упражнението не е достъпно за този акаунт.');
  return home;
}

async function commit(schoolId: string, record: SchoolPractice | PracticeWork, previous: string | null, guards: { id: string; payload: string }[], user: ChatGPTUser, event: string, detail: string) {
  if (JSON.stringify(record).length > 500000) fail(409, 'Достигнат е размерът на историята в пилота. Записите остават запазени.');
  const owner = scope(schoolId), at = new Date().toISOString(), payload = await seal(owner, record);
  const guard = guards.map(() => ' AND EXISTS (SELECT 1 FROM school_records AS dependency WHERE dependency.owner=? AND dependency.id=? AND dependency.payload=?)').join(''), args = guards.flatMap(g => [owner, g.id, g.payload]);
  const change = previous === null ? db().prepare('INSERT OR IGNORE INTO school_records(owner,id,kind,payload,updated_at) SELECT ?,?,?,?,? WHERE 1=1' + guard).bind(owner, record.id, record.kind, payload, at, ...args) : db().prepare('UPDATE school_records SET payload=?,updated_at=? WHERE owner=? AND id=? AND payload=?' + guard).bind(payload, at, owner, record.id, previous, ...args);
  const audit = { id: crypto.randomUUID(), kind: 'school-audit', event, actor: user.fullName || user.displayName || user.email, actorId: user.userId, at, detail };
  const auditWrite = db().prepare('INSERT INTO school_records(owner,id,kind,payload,updated_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM school_records WHERE owner=? AND id=? AND payload=?)').bind(owner, audit.id, audit.kind, await seal(owner, audit), at, owner, record.id, payload);
  const result = await db().batch([change, auditWrite]); if (result[0].meta.changes !== 1) fail(409, 'Упражнението, урокът, опитите или училищните права са променени. Обновете данните.');
}

export function scorePractice(questions: PracticeQuestion[], answers: { questionId: string; optionId: string }[]) {
  if (answers.length !== questions.length || new Set(answers.map(a => a.questionId)).size !== answers.length) fail(400, 'Избери точно един отговор на всеки въпрос.');
  const scored = questions.map(q => {
    const a = answers.find(a => a.questionId === q.id); if (!a || !q.options.some(o => o.id === a.optionId)) fail(400, 'Отговорът не е част от тази версия на упражнението.');
    const correct = a.optionId === q.correctOptionId; return { questionId: q.id, optionId: a.optionId, correct, points: correct ? q.points : 0 };
  });
  return { answers: scored, total: scored.reduce((n, a) => n + a.points, 0), maxPoints: questions.reduce((n, q) => n + q.points, 0) };
}

export async function schoolPracticeCommand(user: ChatGPTUser, type: string, input: unknown): Promise<SchoolPracticeHome> {
  const schema = Object.hasOwn(schemas, type) ? schemas[type as keyof typeof schemas] : null; if (!schema) fail(400, 'Непознато действие за упражнение.');
  const d: any = schema.parse(input), saved = await schoolDirectorySnapshot(d.schoolId); if (!saved) fail(404, 'Училището не е намерено.');
  const s = saved.state, m = member(s, user.userId), owner = scope(s.schoolId), now = new Date().toISOString(), guards = [{ id: 'directory', payload: saved.payload }];
  if (s.revision !== d.directoryRevision) fail(409, 'Училищните права са променени. Обновете данните.');
  if (type === 'practice-attempt') {
    const pupil = ownPupils(s, m)[0]; if (m.role !== 'student' || !pupil) fail(403, 'Само свързаният ученик може да изпрати свой опит.');
    const task = await recordSnapshot(owner, d.practiceId), p = task.record as unknown as SchoolPractice | null;
    if (p?.kind !== 'class-practice' || p.status !== 'published' || p.classId !== pupil.classId) fail(404, 'Няма публикувано упражнение за твоя клас.');
    const target = await recordSnapshot(owner, workId(p.id, pupil.id)), old = target.record as unknown as PracticeWork | null;
    if (old && old.kind !== 'class-practice-work') fail(409, 'Невалиден запис за ученически опити.');
    const fingerprint = await digest([d.practiceRevision, d.edition, d.revision, [...d.answers].sort((a, b) => a.questionId.localeCompare(b.questionId)), d.reflection]), receipt = old?.attempts.find(a => a.id === d.requestId);
    if (receipt) { if (receipt.actorId !== user.userId || receipt.fingerprint !== fingerprint) fail(409, 'Тази заявка вече е записана с различни данни.'); return schoolPracticeHome(user, s.schoolId, p.id); }
    const source = await recordSnapshot(owner, p.lessonId), lesson = source.record as unknown as SchoolLesson | null;
    if (p.archived || lesson?.kind !== 'class-lesson' || lesson.status !== 'published' || lesson.archived || lesson.classId !== pupil.classId) fail(409, 'Упражнението или урокът не приема нови опити. Историята остава достъпна.');
    if (p.revision !== d.practiceRevision || p.edition !== d.edition || (old?.revision || 0) !== d.revision) fail(409, 'Има по-нова версия на упражнението или опитите. Обновете данните.');
    if ((old?.attempts.length || 0) >= 40) fail(409, 'Достигнат е лимитът от 40 опита. Историята остава запазена.');
    const scored = scorePractice(p.questions, d.answers);
    const work: PracticeWork = { id: workId(p.id, pupil.id), kind: 'class-practice-work', practiceId: p.id, pupilId: pupil.id, revision: (old?.revision || 0) + 1, attempts: [...(old?.attempts || []), { id: d.requestId, actorId: user.userId, fingerprint, at: now, condition: practiceCondition(p), reflection: d.reflection, ...scored }] };
    await commit(s.schoolId, work, target.payload, [...guards, { id: p.id, payload: task.payload! }, { id: p.lessonId, payload: source.payload! }], user, 'practice-attempt', p.title + ' · ' + pupil.name);
    return schoolPracticeHome(user, s.schoolId, p.id);
  }
  const target = await recordSnapshot(owner, d.id), old = target.record as unknown as SchoolPractice | null;
  if (old && old.kind !== 'class-practice') fail(409, 'Невалиден запис за упражнение.');
  if (old && !manages(s, m, old)) fail(403, 'Само авторът за назначен клас или администратор може да променя упражнението.');
  if (type === 'practice-save') {
    const fingerprint = await digest([d.revision, d.lessonId, d.lessonRevision, d.title, d.instructions, d.questions]);
    const receipt = [old?.saveRequest, ...(old?.history.map(v => v.saveRequest) || [])].find(r => r?.id === d.requestId);
    if (receipt) { if (receipt.actorId !== user.userId || receipt.fingerprint !== fingerprint) fail(409, 'Тази заявка вече е записана с различни данни.'); return schoolPracticeHome(user, s.schoolId, d.id); }
    if ((old?.revision || 0) !== d.revision) fail(409, 'Има по-нова версия на упражнението. Обновете данните.');
    if (old?.archived) fail(409, 'Първо възстановете архивираното упражнение.');
    if (old && old.lessonId !== d.lessonId) fail(409, 'Запазеното упражнение остава свързано с първоначалния урок.');
    const source = await recordSnapshot(owner, d.lessonId), lesson = source.record as unknown as SchoolLesson | null;
    if (lesson?.kind !== 'class-lesson' || lesson.status !== 'published' || lesson.archived) fail(404, 'Изберете активен публикуван урок.');
    if (!staffClass(s, m, lesson.classId)) fail(403, 'Упражненията се подготвят от учител за назначен клас или администратор.');
    if (lesson.revision !== d.lessonRevision || old && old.classId !== lesson.classId) fail(409, 'Урокът е променен. Обновете библиотеката преди запазване.');
    if (!old && (await records<SchoolPractice>(owner, 'class-practice')).length >= 250) fail(409, 'Достигнат е пилотният лимит от 250 упражнения.');
    const content = { title: d.title, instructions: d.instructions, source: lessonCondition(lesson), questions: d.questions };
    const p: SchoolPractice = { id: d.id, kind: 'class-practice', lessonId: lesson.id, classId: lesson.classId, ...content, edition: old ? old.edition + (contentKey(old) === contentKey(content) ? 0 : 1) : 1, revision: (old?.revision || 0) + 1, status: old?.status || 'draft', archived: false, createdBy: old?.createdBy || user.userId, authorName: old?.authorName || m.name, createdAt: old?.createdAt || now, updatedAt: now, history: old ? history(old) : [], saveRequest: { id: d.requestId, actorId: user.userId, fingerprint } };
    await commit(s.schoolId, p, target.payload, [...guards, { id: lesson.id, payload: source.payload! }], user, 'practice-saved', p.title);
    return schoolPracticeHome(user, s.schoolId, p.id);
  }
  if (!old) fail(404, 'Упражнението не е намерено.');
  if (old.revision !== d.revision) fail(409, 'Има по-нова версия на упражнението. Обновете данните.');
  if (d.action === 'publish' && (old.status !== 'draft' || old.archived) || d.action === 'archive' && old.archived || d.action === 'restore' && !old.archived) fail(409, 'Състоянието вече е променено.');
  if (d.action === 'archive' && d.reason.length < 5) fail(400, 'Добавете кратка причина за архивиране.');
  let sourceGuard: { id: string; payload: string }[] = [];
  if (d.action !== 'archive') {
    const source = await recordSnapshot(owner, old.lessonId), lesson = source.record as unknown as SchoolLesson | null;
    if (lesson?.kind !== 'class-lesson' || lesson.status !== 'published' || lesson.archived || lesson.classId !== old.classId) fail(409, 'Първо възстановете публикувания урок.');
    sourceGuard = [{ id: lesson.id, payload: source.payload! }];
  }
  const p: SchoolPractice = { ...old, revision: old.revision + 1, status: d.action === 'publish' ? 'published' : old.status, archived: d.action === 'archive', updatedAt: now, history: history(old) };
  await commit(s.schoolId, p, target.payload, [...guards, ...sourceGuard], user, 'practice-' + d.action, old.title + (d.reason ? ' · ' + d.reason : ''));
  return schoolPracticeHome(user, s.schoolId, p.id);
}
