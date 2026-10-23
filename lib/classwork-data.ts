import { previewSchoolHome, type SchoolRole, type SchoolView, type DirectoryClass, type DirectoryPupil } from './school-directory-data';
import { schoolToday } from './platform-data';

export type ClassCriterion = { id: string; title: string; description: string; maxPoints: number };
export type ClassAttachment = { id: string; name: string; mime: string; size: number; sha256: string; objectKey: string };
export type ClassAttachmentView = Omit<ClassAttachment, 'objectKey'>;
export type AssignmentSaveRequest = { id: string; actorId: string; fingerprint: string };
export type ClassAssignment = {
  id: string; kind: 'class-assignment'; classId: string; title: string; subject: string; description: string;
  due: string; status: 'draft' | 'published'; archived: boolean; version: number;
  createdBy: string; teacherName: string; createdAt: string; updatedAt: string; criteria: ClassCriterion[];
  attachments?: ClassAttachment[]; history?: AssignmentRevision[]; saveRequest?: AssignmentSaveRequest;
};
export type AssignmentCondition = Pick<ClassAssignment, 'title' | 'subject' | 'description' | 'due' | 'criteria' | 'version' | 'attachments'>;
export type AssignmentConditionView = Omit<AssignmentCondition, 'attachments'> & { attachments: ClassAttachmentView[] };
export type AssignmentRevision = AssignmentCondition & { classId: string; status: 'draft' | 'published'; archived: boolean; savedAt: string; saveRequest?: AssignmentSaveRequest };
export type AssignmentRevisionView = Omit<AssignmentRevision, 'attachments' | 'saveRequest'> & { attachments: ClassAttachmentView[] };
export type ClassAssignmentView = Omit<ClassAssignment, 'createdBy' | 'kind' | 'attachments' | 'history' | 'saveRequest'> & { attachments: ClassAttachmentView[]; history: AssignmentRevisionView[] };
export type ClassReview = {
  id: string; actorId: string; by: string; at: string; status: 'reviewed' | 'revision'; feedback: string;
  scores: { id: string; points: number; note: string }[]; total: number | null; maxPoints: number | null;
};
export type ClassAttempt = {
  id: string; submittedBy: string; at: string; body: string; aiUse: boolean; late: boolean;
  condition: AssignmentCondition; reviews: ClassReview[]; attachments?: ClassAttachment[];
};
export type ClassSubmission = {
  id: string; kind: 'class-submission'; assignmentId: string; pupilId: string; version: number;
  createdAt: string; updatedAt: string; attempts: ClassAttempt[];
};
export type SubmissionView = Omit<ClassSubmission, 'attempts'> & {
  attempts: (Omit<ClassAttempt, 'submittedBy' | 'reviews' | 'attachments' | 'condition'> & { condition: AssignmentConditionView; reviews: Omit<ClassReview, 'actorId'>[]; attachments: ClassAttachmentView[] })[];
};
export type AssignmentSummary = Omit<ClassAssignment, 'description' | 'criteria' | 'createdBy' | 'kind' | 'attachments' | 'history' | 'saveRequest'> & {
  className: string; canManage: boolean; submitted: number; returned: number; reviewed: number; expected: number; attachmentCount: number;
};
export type AssignmentDetail = {
  assignment: ClassAssignmentView & { className: string; canManage: boolean; canSubmit: boolean };
  pupils: DirectoryPupil[]; submissions: SubmissionView[]; reviewablePupilIds: string[];
};
export type ClassworkHome = {
  writable: boolean; preview: boolean;
  schools: { id: string; name: string; year: string; status: string; role?: SchoolRole }[];
  context: { school: SchoolView['school']; self: { userId: string; name: string; role: SchoolRole; status: string } | null;
    status: string; classes: DirectoryClass[]; pupils: DirectoryPupil[] } | null;
  assignments: AssignmentSummary[]; detail?: AssignmentDetail;
};
export const workStatus = (s?: Pick<ClassSubmission, 'attempts'> | SubmissionView) => s?.attempts.at(-1)?.reviews.at(-1)?.status || (s?.attempts.length ? 'submitted' : 'missing');
export const workStatusLabels = { missing: 'Не е предадено', submitted: 'Чака преглед', reviewed: 'С обратна връзка', revision: 'За поправка' };
export function initialWorkPupil(detail: AssignmentDetail, requested?: string | null) {
  return detail.pupils.find(p => p.id === requested)?.id || detail.submissions.find(s => workStatus(s) === 'submitted' && detail.pupils.some(p => p.id === s.pupilId))?.pupilId || detail.pupils[0]?.id || '';
}
export const attachmentViews = (files: ClassAttachment[] = []): ClassAttachmentView[] => files.map(({ objectKey, ...f }) => f);
export const assignmentCondition = (a: AssignmentCondition): AssignmentCondition => ({ title: a.title, subject: a.subject, description: a.description, due: a.due, criteria: a.criteria, version: a.version, attachments: a.attachments || [] });
export const conditionView = (a: AssignmentCondition): AssignmentConditionView => ({ ...assignmentCondition(a), attachments: attachmentViews(a.attachments) });
export const revisionView = ({ saveRequest, attachments, ...a }: AssignmentRevision): AssignmentRevisionView => ({ ...a, attachments: attachmentViews(attachments) });
export function submissionView(s: ClassSubmission): SubmissionView {
  return { ...s, attempts: s.attempts.map(({ submittedBy, reviews, attachments, condition, ...a }) => ({ ...a, condition: conditionView(condition), attachments: attachmentViews(attachments), reviews: reviews.map(({ actorId, ...r }) => r) })) };
}
export function previewClasswork(role: SchoolRole = 'teacher', selected?: string): ClassworkHome {
  const p = previewSchoolHome(), v = p.current!, now = new Date().toISOString();
  const me = { userId: `preview-${role}`, name: role === 'student' ? 'Алекс Петров' : role === 'parent' ? 'Елена Петрова' : role === 'teacher' ? 'Мария Николова' : 'Иван Димитров', role, status: 'active' };
  const classes = role === 'admin' ? v.classes : [v.classes[0]], pupils = ['parent', 'student'].includes(role) ? [v.pupils[0]] : v.pupils.filter(x => classes.some(c => c.id === x.classId));
  const a: ClassAssignment = { id: '40000000-0000-4000-8000-000000000001', kind: 'class-assignment', classId: classes[0].id, title: 'Дроби в ежедневието', subject: 'Математика', description: 'За училищния празник класът подготвя лимонада. Една кана съдържа 3/4 литра.\n\n1. Колко литра има в две кани?\n2. Всеки ученик получава 1/8 литър. За колко ученици стига лимонадата?\n3. Обясни решението със свои думи и посочи как проверяваш отговора.', due: schoolToday(), status: 'published', archived: false, version: 1, createdBy: 'preview-teacher', teacherName: 'Мария Николова', createdAt: now, updatedAt: now, criteria: [{ id: '50000000-0000-4000-8000-000000000001', title: 'Точно решение', description: 'Верни действия с дроби и отговори с единици.', maxPoints: 6 }, { id: '50000000-0000-4000-8000-000000000002', title: 'Обяснение и проверка', description: 'Ясни стъпки и проверка на резултата.', maxPoints: 4 }] };
  const taskPupils = pupils.filter(p => p.classId === a.classId);
  const s: ClassSubmission = { id: 'preview-submission', kind: 'class-submission', assignmentId: a.id, pupilId: pupils[0].id, version: 2, createdAt: now, updatedAt: now, attempts: [{ id: '60000000-0000-4000-8000-000000000001', submittedBy: 'preview-student', at: now, body: 'Две кани са 2 × 3/4 = 6/4 = 1 1/2 литра.\n1 1/2 ÷ 1/8 = 12 ученици.\nПроверка: 12 × 1/8 = 12/8 = 1 1/2 литра.', aiUse: false, late: false, condition: { title: a.title, subject: a.subject, description: a.description, due: a.due, criteria: a.criteria, version: a.version }, reviews: [{ id: '70000000-0000-4000-8000-000000000001', actorId: 'preview-teacher', by: a.teacherName, at: now, status: 'revision', feedback: 'Решението е вярно. Добави едно изречение, което обяснява защо делиш на 1/8 при втората стъпка.', scores: [], total: null, maxPoints: null }] }] };
  s.attempts[0].attachments = [{ id: '80000000-0000-4000-8000-000000000001', name: 'reshenie-drobi.txt', mime: 'text/plain', size: 432, sha256: 'dece575afc04f41aa113cbc1b7d43c3e8dfa6c43cc2d07cc99656d9dc3a395ca', objectKey: 'fictional-preview-only' }];
  a.attachments = [{ id: '80000000-0000-4000-8000-000000000002', name: 'zadachi-drobi.txt', mime: 'text/plain', size: 865, sha256: 'bda1d54bbdcddd71c51c058ac81cce4bf547c9dd6cc1d10b39df9583a4441a2a', objectKey: 'fictional-preview-only' }];
  s.attempts[0].condition.attachments = a.attachments;
  const manage = ['admin', 'teacher'].includes(role);
  const assignments: AssignmentSummary[] = [{ id: a.id, title: a.title, subject: a.subject, classId: a.classId, due: a.due, status: a.status, archived: a.archived, version: a.version, teacherName: a.teacherName, createdAt: now, updatedAt: now, className: classes[0].name, canManage: manage, submitted: 0, returned: 1, reviewed: 0, expected: taskPupils.length, attachmentCount: 1 }];
  return { writable: false, preview: true, schools: p.schools, context: { school: v.school, self: me, status: 'active', classes, pupils }, assignments, ...(selected === a.id ? { detail: { assignment: { ...(({ createdBy, kind, attachments, history, saveRequest, ...visible }) => visible)(a), attachments: attachmentViews(a.attachments), history: [], className: classes[0].name, canManage: manage, canSubmit: role === 'student' }, pupils: taskPupils, submissions: [submissionView(s)], reviewablePupilIds: manage ? taskPupils.map(p => p.id) : [] } } : {}) };
}
