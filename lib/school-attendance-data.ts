import { previewClasswork, type ClassworkHome } from './classwork-data';
import { schoolToday, plusDays } from './platform-data';
import type { SchoolRole } from './school-directory-data';

export const MAX_ATTENDANCE_SESSIONS = 250;
export const MAX_ATTENDANCE_ACTIONS = 120;
export const MAX_ATTENDANCE_EVENTS = 40;
export const MAX_ATTENDANCE_BYTES = 180000;
export const ATTENDANCE_REVIEW_RESERVE = 12000;
export const attendanceStatusLabels = { unmarked: 'Не е отбелязано', present: 'Присъства', late: 'Закъснение', absent: 'Отсъства', excused: 'Извинено' };
export const attendanceExplanationLabels = { pending: 'Чака преглед', approved: 'Одобрено', returned: 'Върнато за уточнение', declined: 'Неодобрено', withdrawn: 'Оттеглено', cancelled: 'Приключено с корекция' };
export type AttendanceStatus = keyof typeof attendanceStatusLabels;
export type AttendanceMark = { status: AttendanceStatus; lateMinutes: number; note: string };
export type AttendanceExplanation = { id: string; authorId: string; parentName: string; body: string; at: string; decision: keyof typeof attendanceExplanationLabels; decisionById?: string; decisionByName?: string; decisionAt?: string; decisionNote?: string };
export type AttendanceEvent = AttendanceMark & { action: 'mark' | 'explain' | 'review' | 'withdraw' | 'cancel'; actorId: string; actorName: string; at: string; recordRevision?: number; reason: string; explanation?: AttendanceExplanation };
export type AttendanceEntry = AttendanceMark & { pupilId: string; pupilName: string; number: number; explanations: AttendanceExplanation[]; history: AttendanceEvent[] };
export type AttendanceMetadata = { subject: string; topic: string; state: 'active' | 'cancelled' };
export type AttendanceMetaEvent = AttendanceMetadata & { action: 'create' | 'edit' | 'cancel' | 'restore'; at: string; recordRevision?: number; actorId: string; actorName: string; reason: string };
export type SchoolAttendance = AttendanceMetadata & { id: string; kind: 'class-attendance'; classId: string; className: string; schoolYear: string; date: string; lessonNumber: number; createdBy: string; teacherName: string; createdAt: string; revision: number; entries: AttendanceEntry[]; history: AttendanceMetaEvent[]; receipts: { id: string; actorId: string; fingerprint: string }[] };
export type AttendanceExplanationView = Omit<AttendanceExplanation, 'authorId' | 'decisionById'>;
export type AttendanceEntryView = Omit<AttendanceEntry, 'history' | 'explanations'> & { canMark: boolean; canExplain: boolean; canReview: boolean; canWithdraw: boolean; explanationRestricted?: boolean; explanations: AttendanceExplanationView[]; history: (Omit<AttendanceEvent, 'actorId' | 'explanation'> & { explanation?: AttendanceExplanationView })[] };
export type AttendanceSessionSummary = Omit<SchoolAttendance, 'kind' | 'createdBy' | 'entries' | 'history' | 'receipts'> & { canManage: boolean; historyLimitReached: boolean; entries: (AttendanceMark & { pupilId: string; pupilName: string; number: number; explanationState?: AttendanceExplanation['decision']; canReview: boolean })[] };
export type AttendanceDetail = { session: AttendanceSessionSummary; entries: AttendanceEntryView[]; history: Omit<AttendanceMetaEvent, 'actorId'>[] };
export type SchoolAttendanceHome = Pick<ClassworkHome, 'writable' | 'preview' | 'schools' | 'context'> & { sessions: AttendanceSessionSummary[]; canCreate: boolean; capacityReached: boolean; detail?: AttendanceDetail };
export const attendanceSessionId = (classId: string, date: string, lessonNumber: number) => `attendance:${classId}:${date}:${lessonNumber}`;
export const attendancePending = (s: Pick<SchoolAttendance, 'entries'>) => s.entries.filter(e => e.explanations.at(-1)?.decision === 'pending').length;
export function attendanceCounts(entries: Pick<AttendanceMark, 'status'>[]) { return Object.fromEntries(Object.keys(attendanceStatusLabels).map(status => [status, entries.filter(e => e.status === status).length])) as Record<AttendanceStatus, number>; }
export const attendanceMarkChanged = (a: AttendanceMark, b: AttendanceMark) => a.status !== b.status || a.lateMinutes !== b.lateMinutes || a.note !== b.note;
export function attendancePresentDraft(entries: Pick<AttendanceEntryView, 'pupilId' | 'status' | 'lateMinutes' | 'note' | 'canMark'>[], draft: Record<string, AttendanceMark>) {
  const next = { ...draft };
  for (const e of entries) { const current = draft[e.pupilId] || e; if (e.canMark && e.status === 'unmarked' && current.status === 'unmarked') next[e.pupilId] = { status: 'present', lateMinutes: 0, note: current.note }; }
  return next;
}
export function attendanceExplanationView({ authorId, decisionById, ...view }: AttendanceExplanation): AttendanceExplanationView { return view; }
export function attendanceEntryView(e: AttendanceEntry, permissions: Pick<AttendanceEntryView, 'canMark' | 'canExplain' | 'canReview' | 'canWithdraw'>): AttendanceEntryView {
  return { ...e, ...permissions, explanations: e.explanations.map(attendanceExplanationView), history: e.history.map(({ actorId, explanation, ...event }) => ({ ...event, ...(explanation ? { explanation: attendanceExplanationView(explanation) } : {}) })) };
}

export function previewSchoolAttendance(role: SchoolRole = 'teacher', selected?: string): SchoolAttendanceHome {
  const base = previewClasswork(role), ctx = base.context!, staff = ['teacher', 'admin'].includes(role), now = new Date().toISOString(), pupils = staff ? ctx.pupils : ctx.pupils.slice(0, 1);
  const sessions: AttendanceSessionSummary[] = [0, 1, 2].map(n => ({ id: attendanceSessionId(ctx.classes[0].id, plusDays(schoolToday(), -n), n + 1), classId: ctx.classes[0].id, className: ctx.classes[0].name, schoolYear: ctx.school.year, date: plusDays(schoolToday(), -n), lessonNumber: n + 1, subject: ['Математика', 'Български език', 'Човекът и природата'][n], topic: ['Събиране на дроби', 'Части на речта', 'Клетката и организмите'][n], state: 'active', teacherName: 'Мария Николова', createdAt: now, revision: 2, canManage: staff, historyLimitReached: false, entries: pupils.map((p, i) => ({ pupilId: p.id, pupilName: p.name, number: p.number, status: i === 0 && n === 0 ? 'absent' : i === 0 && n === 1 ? 'late' : 'present', lateMinutes: i === 0 && n === 1 ? 5 : 0, note: '', ...(i === 0 && n === 0 ? { explanationState: 'pending' as const } : {}), canReview: staff && i === 0 && n === 0 })) }));
  const session = sessions.find(s => s.id === selected), entries: AttendanceEntryView[] = session ? session.entries.map(e => {
    const explanation: AttendanceExplanation = { id: '93000000-0000-4000-8000-000000000001', authorId: 'preview-parent', parentName: 'Родител на ' + e.pupilName, body: 'Искам да уточня причината за отсъствието на детето ми.', at: now, decision: 'pending' };
    const raw: AttendanceEntry = { ...e, explanations: e.explanationState === 'pending' ? [explanation] : [], history: [{ status: e.status, lateMinutes: e.lateMinutes, note: '', action: 'mark', actorId: 'preview-teacher', actorName: 'Мария Николова', at: now, reason: '' }] };
    if (raw.explanations.length) raw.history.push({ ...raw.history[0], action: 'explain', actorId: 'preview-parent', actorName: explanation.parentName, explanation });
    return attendanceEntryView(raw, { canMark: staff, canReview: e.canReview, canExplain: role === 'parent' && e.status === 'absent' && !raw.explanations.length, canWithdraw: role === 'parent' && !!raw.explanations.length });
  }) : [];
  return { writable: false, preview: true, schools: base.schools, context: { ...ctx, pupils }, sessions, canCreate: staff, capacityReached: false, ...(session ? { detail: { session, entries, history: [{ subject: session.subject, topic: session.topic, state: 'active', action: 'create', actorName: session.teacherName, at: now, reason: '' }] } } : {}) };
}
