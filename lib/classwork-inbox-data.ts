import { previewClasswork, type ClassworkHome, type ClassAssignment, type ClassSubmission, type AssignmentRevision } from './classwork-data';
import type { DirectoryPupil, SchoolRole } from './school-directory-data';
import { schoolToday } from './platform-data';

export const INBOX_WINDOW = 200;
export const INBOX_READ_LIMIT = 2000;
export type InboxKind = 'assignment' | 'update' | 'submission' | 'feedback' | 'revision' | 'state' | 'grade' | 'attendance' | 'explanation' | 'document' | 'announcement';
export type ClassworkNotice = {
  id: string; kind: InboxKind; title: string; summary: string; at: string;
  assignmentId: string; assignmentTitle: string; subject: string; classId: string; className: string;
  gradeId?: string; attendanceId?: string; documentId?: string; announcementId?: string;
  pupilId?: string; pupilName?: string; unread: boolean; needsAction: boolean;
};
export type ClassworkInboxHome = Pick<ClassworkHome, 'writable' | 'preview' | 'schools' | 'context'> & {
  notices: ClassworkNotice[]; unreadCount: number; actionCount: number; truncated: boolean; window: number;
};
export type ClassworkInboxState = {
  id: 'read-state'; kind: 'classwork-inbox-state'; version: number; seen: { id: string; at: string }[];
};
export const inboxKindLabels: Record<InboxKind, string> = {
  assignment: 'Ново домашно', update: 'Промяна на условието', submission: 'Предаване',
  feedback: 'Обратна връзка', revision: 'За поправка', state: 'Архив и възстановяване',
  grade: 'Оценка', attendance: 'Присъствие', explanation: 'Обяснение за отсъствие',
  document: 'Документ за родител', announcement: 'Училищно съобщение',
};
export function inboxHomeworkDestination(schoolId: string, notice: Pick<ClassworkNotice, 'assignmentId' | 'pupilId' | 'gradeId' | 'attendanceId' | 'documentId' | 'announcementId'>) {
  const q = new URLSearchParams({ school: schoolId });
  if (notice.pupilId) q.set('pupil', notice.pupilId);
  if (notice.gradeId) { q.set('grade', notice.gradeId); return 'school-gradebook?' + q; }
  if (notice.attendanceId) { q.set('session', notice.attendanceId); return 'school-attendance?' + q; }
  if (notice.announcementId) { q.set('announcement', notice.announcementId); return 'school-announcements?' + q; }
  if (notice.documentId) { q.set('document', notice.documentId); return 'school-documents?' + q; }
  q.set('assignment', notice.assignmentId);
  return 'classwork?' + q;
}
const conditionKey = (v: AssignmentRevision) => JSON.stringify([v.title, v.subject, v.description, v.due, v.criteria, (v.attachments || []).map(f => f.id)]);

// The service passes only currently authorized tasks, history and pupil work.
// This projection never includes answer text, scores, feedback or file metadata.
export function taskNotices({ assignment: a, history, currentVisible, submissions, pupils, role, className, canManage, canSubmit }: {
  assignment: ClassAssignment; history: AssignmentRevision[]; currentVisible: boolean;
  submissions: ClassSubmission[]; pupils: DirectoryPupil[]; role: SchoolRole; className: string;
  canManage: boolean; canSubmit: boolean;
}): ClassworkNotice[] {
  const notices: ClassworkNotice[] = [];
  const base = { assignmentId: a.id, classId: a.classId, className, unread: true, needsAction: false };
  const chain: AssignmentRevision[] = [...(a.history || []), { ...a, savedAt: a.updatedAt }].sort((x, y) => x.version - y.version);
  const allowed = new Set(history.filter(h => h.status === 'published').map(h => h.version));
  if (currentVisible && a.status === 'published') allowed.add(a.version);
  for (let i = 0; i < chain.length; i++) {
    const v = chain[i], previous = chain[i - 1];
    if (!allowed.has(v.version)) continue;
    let kind: InboxKind, title: string, summary: string;
    if (!previous || previous.status === 'draft') { kind = 'assignment'; title = 'Ново домашно за класа'; summary = 'Условието е публикувано и е достъпно за преглед.'; }
    else if (previous.archived !== v.archived) { kind = 'state'; title = v.archived ? 'Домашното е архивирано' : 'Домашното е възстановено'; summary = v.archived ? 'Историята остава достъпна. Нови предавания са спрени.' : 'Домашното отново приема работа от свързаните ученици.'; }
    else if (conditionKey(previous) !== conditionKey(v)) { kind = 'update'; title = 'Условието е обновено'; summary = 'Прегледай текущите насоки, срок и файлове преди работа.'; }
    else continue;
    notices.push({ ...base, id: `task:${a.id}:${v.version}:${kind}`, kind, title, summary, at: v.savedAt, assignmentTitle: v.title, subject: v.subject });
  }
  if (canSubmit && !submissions.length) {
    const latest = notices.at(-1); if (latest) latest.needsAction = true;
  }
  for (const s of submissions) {
    const pupil = pupils.find(p => p.id === s.pupilId); if (!pupil) continue;
    for (const [index, attempt] of s.attempts.entries()) {
      const last = s.attempts.at(-1) === attempt, review = attempt.reviews.at(-1);
      const info = { ...base, assignmentTitle: attempt.condition.title, subject: attempt.condition.subject, pupilId: pupil.id, pupilName: pupil.name };
      notices.push({ ...info, id: `work:${a.id}:${pupil.id}:${attempt.id}`, kind: 'submission', title: index > 0 ? 'Предадена е нова версия' : 'Работата е предадена', summary: 'Решението и приложените файлове са запазени към това предаване.', at: attempt.at, needsAction: canManage && !a.archived && !pupil.archived && pupil.classId === a.classId && last && !review });
      for (const r of attempt.reviews) notices.push({ ...info, id: `review:${a.id}:${pupil.id}:${r.id}`, kind: r.status === 'revision' ? 'revision' : 'feedback', title: r.status === 'revision' ? 'Учителят поиска поправка' : 'Има обратна връзка', summary: r.status === 'revision' ? 'Отвори работата и прочети насоките за следващото предаване.' : 'Учителският преглед е запазен към тази версия на работата.', at: r.at, needsAction: role === 'student' && canSubmit && pupil.classId === a.classId && last && review === r && r.status === 'revision' });
    }
  }
  return notices;
}

export function inboxWindow(home: Pick<ClassworkInboxHome, 'writable' | 'preview' | 'schools' | 'context'>, all: ClassworkNotice[], seen: string[] = []): ClassworkInboxHome {
  const read = new Set(seen);
  const notices = all.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id)).slice(0, INBOX_WINDOW).map(n => ({ ...n, unread: !read.has(n.id) }));
  return { ...home, notices, unreadCount: notices.filter(n => n.unread).length, actionCount: notices.filter(n => n.needsAction).length, truncated: all.length > INBOX_WINDOW, window: INBOX_WINDOW };
}

export function previewClassworkInbox(role: SchoolRole = 'teacher'): ClassworkInboxHome {
  const home = previewClasswork(role, '40000000-0000-4000-8000-000000000001'), a = home.detail!.assignment, s = home.detail!.submissions[0], p = home.detail!.pupils[0];
  const now = Date.now(), base = { assignmentId: a.id, assignmentTitle: a.title, subject: a.subject, classId: a.classId, className: a.className, unread: true, needsAction: false };
  const notices: ClassworkNotice[] = [
    { ...base, assignmentId: '', assignmentTitle: 'Математика · текуща оценка', gradeId: '92000000-0000-4000-8000-000000000001', id: 'grade:92000000-0000-4000-8000-000000000001:1', kind: 'grade', title: 'Има записана оценка', summary: 'Текуща оценка · 5. Отвори дневника за обратната връзка и историята.', at: new Date(now - 2400000).toISOString(), pupilId: p.id, pupilName: p.name },
    { ...base, assignmentId: '', assignmentTitle: 'Математика · 1. час', attendanceId: `attendance:${a.classId}:${schoolToday()}:1`, id: 'attendance-preview:1', kind: 'attendance', title: 'Отбелязано е отсъствие', summary: 'Записът за часа е достъпен за преглед. В този пример има подадено обяснение.', at: new Date(now - 1800000).toISOString(), pupilId: p.id, pupilName: p.name },
    { ...base, id: `task:${a.id}:1:assignment`, kind: 'assignment', title: 'Ново домашно за класа', summary: 'Условието е публикувано и е достъпно за преглед.', at: new Date(now - 86400000).toISOString() },
    { ...base, id: `work:${a.id}:${p.id}:${s.attempts[0].id}`, kind: 'submission', title: 'Работата е предадена', summary: 'Решението и приложените файлове са запазени към това предаване.', at: new Date(now - 3600000).toISOString(), pupilId: p.id, pupilName: p.name },
    { ...base, id: `review:${a.id}:${p.id}:${s.attempts[0].reviews[0].id}`, kind: 'revision', title: 'Учителят поиска поправка', summary: 'Отвори работата и прочети насоките за следващото предаване.', at: new Date(now - 900000).toISOString(), pupilId: p.id, pupilName: p.name, needsAction: role === 'student' },
  ];
  return inboxWindow(home, notices, [notices[0].id]);
}
