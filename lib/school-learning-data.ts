import { previewClasswork, type ClassworkHome } from './classwork-data';
import type { DirectoryPupil, SchoolRole } from './school-directory-data';

export type LearningStatus = 'read' | 'understood' | 'needs-help';
export const learningStatusLabels: Record<LearningStatus | 'missing' | 'earlier', string> = {
  read: 'Прочетох', understood: 'Разбирам', 'needs-help': 'Имам нужда от помощ', missing: 'Няма отбелязване', earlier: 'По-ранна версия',
};
export type LessonCondition = { edition: number; title: string; subject: string; summary: string; body: string; sourceTitle: string; sourceUrl: string };
type SaveReceipt = { id: string; actorId: string; fingerprint: string };
export type LessonRevision = LessonCondition & { revision: number; classId: string; status: 'draft' | 'published'; archived: boolean; savedAt: string; saveRequest?: SaveReceipt };
export type SchoolLesson = LessonCondition & {
  id: string; kind: 'class-lesson'; classId: string; revision: number; status: 'draft' | 'published'; archived: boolean;
  createdBy: string; authorName: string; createdAt: string; updatedAt: string; history: LessonRevision[]; saveRequest?: SaveReceipt;
};
export type LearningCheckpoint = { id: string; actorId: string; at: string; status: LearningStatus; condition: LessonCondition };
export type LessonProgress = { id: string; kind: 'class-learning-progress'; lessonId: string; pupilId: string; revision: number; checkpoints: LearningCheckpoint[] };
export type LessonProgressView = Omit<LessonProgress, 'kind' | 'checkpoints'> & { checkpoints: Omit<LearningCheckpoint, 'actorId'>[] };
export type LessonSummary = Pick<SchoolLesson, 'id' | 'classId' | 'title' | 'subject' | 'summary' | 'edition' | 'revision' | 'status' | 'archived' | 'authorName' | 'updatedAt'> & {
  className: string; canManage: boolean; retained: boolean; expected: number; read: number; understood: number; needsHelp: number; earlier: number;
};
export type LessonDetail = {
  lesson: LessonSummary & { condition: LessonCondition; history: { condition: LessonCondition; at: string }[]; canCheckpoint: boolean };
  pupils: DirectoryPupil[]; progress: LessonProgressView[];
};
export type SchoolLearningHome = Pick<ClassworkHome, 'writable' | 'preview' | 'schools' | 'context'> & { lessons: LessonSummary[]; detail?: LessonDetail };
export const lessonCondition = (l: LessonCondition): LessonCondition => ({ edition: l.edition, title: l.title, subject: l.subject, summary: l.summary, body: l.body, sourceTitle: l.sourceTitle, sourceUrl: l.sourceUrl });
export const learningProgressView = ({ kind, checkpoints, ...p }: LessonProgress): LessonProgressView => ({ ...p, checkpoints: checkpoints.map(({ actorId, ...c }) => c) });
export function currentLearningStatus(p: LessonProgressView | LessonProgress | undefined, edition: number): LearningStatus | 'missing' | 'earlier' {
  const latest = p?.checkpoints.at(-1); return !latest ? 'missing' : latest.condition.edition === edition ? latest.status : 'earlier';
}
export function initialLearningPupil(detail: LessonDetail, requested?: string | null) {
  return detail.pupils.find(p => p.id === requested)?.id || detail.progress.find(p => currentLearningStatus(p, detail.lesson.edition) === 'needs-help' && detail.pupils.some(x => x.id === p.pupilId))?.pupilId || detail.pupils[0]?.id || '';
}
// Reader layouts preserve every source paragraph. They do not generate new text.
export function lessonSections(body: string) { return body.split(/\n\s*\n/).filter(s => s.trim().length > 0); }

export function previewSchoolLearning(role: SchoolRole = 'teacher', selected?: string): SchoolLearningHome {
  const base = previewClasswork(role), ctx = base.context!, now = new Date().toISOString(), id = '90000000-0000-4000-8000-000000000001';
  const condition: LessonCondition = { edition: 1, title: 'Как събираме дроби?', subject: 'Математика', summary: 'Един общ знаменател, няколко ясни стъпки и проверка със собствен пример.', sourceTitle: 'Авторски пример на Eduo · не е официален учебник', sourceUrl: '', body: 'Една дроб показва колко равни части вземаме от едно цяло. Знаменателят казва на колко части е разделено цялото, а числителят — колко части вземаме.\n\nЗа да съберем дроби с различни знаменатели, първо ги записваме с общ знаменател. Така събираме части с еднакъв размер.\n\nПример: 1/2 + 1/4. Записваме 1/2 като 2/4, след което 2/4 + 1/4 = 3/4. Знаменателят остава 4.\n\nПроверка: половин пица и още една четвърт са три от четирите равни парчета. Резултатът 3/4 е по-голям от 1/2 и по-малък от едно цяло.\n\nОпитай сам: събери 1/3 и 1/6. Обясни защо избираш този общ знаменател.' };
  const summary: LessonSummary = { id, classId: ctx.classes[0].id, title: condition.title, subject: condition.subject, summary: condition.summary, edition: 1, revision: 2, status: 'published', archived: false, authorName: 'Мария Николова', updatedAt: now, className: ctx.classes[0].name, canManage: ['teacher', 'admin'].includes(role), retained: false, expected: ctx.pupils.filter(p => p.classId === ctx.classes[0].id).length, read: 0, understood: 0, needsHelp: 1, earlier: 0 };
  const pupil = ctx.pupils[0], progress: LessonProgressView = { id: 'preview-learning', lessonId: id, pupilId: pupil.id, revision: 1, checkpoints: [{ id: '90000000-0000-4000-8000-000000000002', at: now, condition, status: 'needs-help' }] };
  return { writable: false, preview: true, schools: base.schools, context: ctx, lessons: [summary], ...(selected === id ? { detail: { lesson: { ...summary, condition, history: [], canCheckpoint: role === 'student' }, pupils: ctx.pupils.filter(p => p.classId === summary.classId), progress: [progress] } } : {}) };
}
