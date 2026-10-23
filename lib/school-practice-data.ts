import { previewSchoolLearning, lessonCondition, type LessonCondition } from './school-learning-data';
import type { ClassworkHome } from './classwork-data';
import type { DirectoryPupil, SchoolRole } from './school-directory-data';

export type PracticeOption = { id: string; text: string };
export type PracticeQuestion = { id: string; prompt: string; options: PracticeOption[]; correctOptionId: string; explanation: string; points: number };
export type PracticeQuestionView = Omit<PracticeQuestion, 'correctOptionId' | 'explanation'>;
export type PracticeCondition = { edition: number; title: string; instructions: string; source: LessonCondition; questions: PracticeQuestion[] };
export type PracticeConditionView = Omit<PracticeCondition, 'questions'> & { questions: PracticeQuestionView[] };
type SaveReceipt = { id: string; actorId: string; fingerprint: string };
export type PracticeRevision = PracticeCondition & { revision: number; status: 'draft' | 'published'; archived: boolean; savedAt: string; saveRequest?: SaveReceipt };
export type SchoolPractice = PracticeCondition & {
  id: string; kind: 'class-practice'; lessonId: string; classId: string; revision: number; status: 'draft' | 'published'; archived: boolean;
  createdBy: string; authorName: string; createdAt: string; updatedAt: string; history: PracticeRevision[]; saveRequest?: SaveReceipt;
};
export type PracticeAnswer = { questionId: string; optionId: string; correct: boolean; points: number };
export type PracticeAttempt = { id: string; actorId: string; fingerprint: string; at: string; condition: PracticeCondition; answers: PracticeAnswer[]; total: number; maxPoints: number; reflection: string };
export type PracticeWork = { id: string; kind: 'class-practice-work'; practiceId: string; pupilId: string; revision: number; attempts: PracticeAttempt[] };
export type PracticeAttemptView = Omit<PracticeAttempt, 'actorId' | 'fingerprint'>;
export type PracticeWorkView = Omit<PracticeWork, 'kind' | 'attempts'> & { attempts: PracticeAttemptView[] };
export type PracticeSummary = Pick<SchoolPractice, 'id' | 'lessonId' | 'classId' | 'revision' | 'edition' | 'title' | 'status' | 'archived' | 'authorName' | 'updatedAt'> & {
  subject: string; lessonTitle: string; sourceEdition: number; className: string; canManage: boolean; retained: boolean;
  expected: number; completed: number; earlier: number; questionCount: number; maxPoints: number;
};
export type QuestionAnalysis = { questionId: string; answered: number; correct: number; choices: { optionId: string; count: number }[] };
export type PracticeDetail = {
  practice: PracticeSummary & { condition: PracticeConditionView; canAttempt: boolean; attemptLimitReached: boolean; sourceChanged: boolean; sourceAvailable: boolean; history: { edition: number; title: string; sourceEdition: number; at: string }[] };
  pupils: DirectoryPupil[]; works: PracticeWorkView[]; answerKey?: PracticeQuestion[]; analysis?: QuestionAnalysis[];
};
export type PracticeLesson = { id: string; classId: string; className: string; revision: number; edition: number; title: string; subject: string };
export type SchoolPracticeHome = Pick<ClassworkHome, 'writable' | 'preview' | 'schools' | 'context'> & { practices: PracticeSummary[]; lessons: PracticeLesson[]; detail?: PracticeDetail };

export const practiceCondition = (p: PracticeCondition): PracticeCondition => ({ edition: p.edition, title: p.title, instructions: p.instructions, source: lessonCondition(p.source), questions: p.questions });
export const practiceConditionView = (p: PracticeCondition): PracticeConditionView => ({ ...practiceCondition(p), questions: p.questions.map(({ correctOptionId, explanation, ...q }) => q) });
export const practiceWorkView = ({ kind, attempts, ...w }: PracticeWork): PracticeWorkView => ({ ...w, attempts: attempts.map(({ actorId, fingerprint, ...a }) => a) });
export function latestCurrentAttempt(w: PracticeWork | PracticeWorkView | undefined, edition: number) { return w?.attempts.filter(a => a.condition.edition === edition).at(-1); }
export function initialPracticePupil(d: PracticeDetail, requested?: string | null) { return d.pupils.find(p => p.id === requested)?.id || d.pupils[0]?.id || ''; }
export function answeredPracticeCount(questions: PracticeQuestionView[], answers: Record<string, string>) { return questions.filter(q => q.options.some(o => o.id === answers[q.id])).length; }
export function practiceAnalysis(questions: PracticeQuestion[], works: PracticeWork[] | PracticeWorkView[], edition: number): QuestionAnalysis[] {
  const latest = works.map(w => latestCurrentAttempt(w, edition)).filter(a => !!a);
  return questions.map(q => {
    const answers = latest.flatMap(a => a!.answers.filter(x => x.questionId === q.id));
    return { questionId: q.id, answered: answers.length, correct: answers.filter(a => a.correct).length, choices: q.options.map(o => ({ optionId: o.id, count: answers.filter(a => a.optionId === o.id).length })) };
  });
}

export function previewSchoolPractice(role: SchoolRole = 'teacher', selected?: string): SchoolPracticeHome {
  const lessonId = '90000000-0000-4000-8000-000000000001', base = previewSchoolLearning(role, lessonId), l = base.detail!.lesson, now = new Date().toISOString();
  const uid = (n: number) => '91000000-0000-4000-8000-' + String(n).padStart(12, '0');
  const questions: PracticeQuestion[] = [
    { id: uid(11), prompt: 'Колко е 1/2 + 1/4?', options: [{ id: uid(21), text: '2/6' }, { id: uid(22), text: '3/4' }, { id: uid(23), text: '1/4' }], correctOptionId: uid(22), explanation: 'Записваме 1/2 като 2/4. Събираме числителите: 2/4 + 1/4 = 3/4.', points: 2 },
    { id: uid(12), prompt: 'Кой общ знаменател можем да използваме за 1/3 и 1/6?', options: [{ id: uid(24), text: '3' }, { id: uid(25), text: '6' }, { id: uid(26), text: '9' }], correctOptionId: uid(25), explanation: '6 се дели и на 3, и на 6. Затова 1/3 = 2/6 и двете дроби имат части с еднакъв размер.', points: 1 },
    { id: uid(13), prompt: 'Какво остава същото, когато събираме дроби с еднакъв знаменател?', options: [{ id: uid(27), text: 'Числителят' }, { id: uid(28), text: 'Знаменателят' }], correctOptionId: uid(28), explanation: 'Размерът на равните части не се променя. Събираме броя им, затова знаменателят остава същият.', points: 1 },
  ];
  const p: SchoolPractice = { id: uid(1), kind: 'class-practice', lessonId, classId: l.classId, edition: 1, revision: 2, title: 'Дробите, стъпка по стъпка', instructions: 'Избери един отговор на всеки въпрос. След изпращането ще видиш обясненията. Можеш да опиташ отново.', source: l.condition, questions, status: 'published', archived: false, createdBy: 'preview-teacher', authorName: 'Мария Николова', createdAt: now, updatedAt: now, history: [] };
  const w: PracticeWork = { id: 'preview-practice-work', kind: 'class-practice-work', practiceId: p.id, pupilId: base.context!.pupils[0].id, revision: 1, attempts: [{ id: uid(2), actorId: 'preview-student', fingerprint: '', at: now, condition: practiceCondition(p), reflection: 'Искам още един пример с общ знаменател.', answers: questions.map((q, i) => ({ questionId: q.id, optionId: i === 1 ? q.options[0].id : q.correctOptionId, correct: i !== 1, points: i === 1 ? 0 : q.points })), total: 3, maxPoints: 4 }] };
  const staff = ['admin', 'teacher'].includes(role), summary: PracticeSummary = { id: p.id, lessonId, classId: p.classId, revision: p.revision, edition: p.edition, title: p.title, status: p.status, archived: false, authorName: p.authorName, updatedAt: now, subject: p.source.subject, lessonTitle: p.source.title, sourceEdition: p.source.edition, className: l.className, canManage: staff, retained: false, expected: base.context!.pupils.length, completed: 1, earlier: 0, questionCount: questions.length, maxPoints: 4 };
  return { writable: false, preview: true, schools: base.schools, context: base.context, practices: [summary], lessons: staff ? [{ id: lessonId, classId: l.classId, className: l.className, revision: l.revision, edition: l.edition, title: l.title, subject: l.subject }] : [], ...(selected === p.id ? { detail: { practice: { ...summary, condition: practiceConditionView(p), canAttempt: role === 'student', attemptLimitReached: false, sourceChanged: false, sourceAvailable: true, history: [] }, pupils: base.detail!.pupils, works: [practiceWorkView(w)], ...(staff ? { answerKey: questions, analysis: practiceAnalysis(questions, [w], 1) } : {}) } } : {}) };
}
