import { previewClasswork, type ClassworkHome } from './classwork-data';
import type { SchoolRole } from './school-directory-data';
import { schoolToday, plusDays } from './platform-data';

export const MAX_SCHOOL_GRADES = 2000;
export const MAX_GRADE_VERSIONS = 40;
export const gradeAssessmentLabels = { oral: 'Устно изпитване', written: 'Писмена работа', test: 'Тест', project: 'Проект', practical: 'Практическа работа', homework: 'Домашна работа' };
export const gradeTermLabels = { first: 'Първи срок', second: 'Втори срок' };
export const schoolGradeKindLabels = { current: 'Текуща', term: 'Срочна', annual: 'Годишна' };
export type SchoolGradeKind = keyof typeof schoolGradeKindLabels;
export const gradeValueLabels: Record<number, string> = { 2: 'Слаб', 3: 'Среден', 4: 'Добър', 5: 'Много добър', 6: 'Отличен' };
export type GradeFields = { subject: string; value: number; assessment: keyof typeof gradeAssessmentLabels; date: string; term: keyof typeof gradeTermLabels; feedback: string; gradeKind?: SchoolGradeKind };
export type GradeAction = 'add' | 'correct' | 'annul' | 'restore';
export type GradeVersion = { revision: number; fields: GradeFields; status: 'recorded' | 'annulled'; action: GradeAction; reason: string; actorId: string; actorName: string; at: string; requestId: string; fingerprint: string };
export type SchoolGrade = { id: string; kind: 'class-grade'; pupilId: string; classId: string; pupilName: string; className: string; schoolYear: string; createdBy: string; teacherName: string; createdAt: string; revision: number; fields: GradeFields; status: 'recorded' | 'annulled'; versions: GradeVersion[] };
export type GradeView = Omit<SchoolGrade, 'kind' | 'createdBy' | 'versions'> & { canManage: boolean; versions: Omit<GradeVersion, 'actorId' | 'requestId' | 'fingerprint'>[] };
export type SchoolGradebookHome = Pick<ClassworkHome, 'writable' | 'preview' | 'schools' | 'context'> & { grades: GradeView[]; canRecord: boolean; capacityReached: boolean; detail?: GradeView };
export function gradeView(g: SchoolGrade, canManage: boolean): GradeView {
  const { kind, createdBy, versions, ...visible } = g;
  return { ...visible, canManage, versions: versions.map(({ actorId, requestId, fingerprint, ...version }) => version) };
}
export function gradebookAverage(grades: Pick<GradeView, 'status' | 'fields'>[]) {
  const current = grades.filter(g => g.status === 'recorded' && gradeKindOf(g.fields) === 'current');
  return current.length ? current.reduce((n, g) => n + g.fields.value, 0) / current.length : null;
}
export const gradeKindOf = (fields: Pick<GradeFields, 'gradeKind'>): SchoolGradeKind => fields.gradeKind || 'current';
export function gradeSummaryKey(g: Pick<SchoolGrade, 'pupilId' | 'schoolYear' | 'fields'>) {
  const kind = gradeKindOf(g.fields);
  if (kind === 'current') return null;
  const subject = g.fields.subject.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('bg');
  return JSON.stringify([g.pupilId, g.schoolYear, subject, kind, kind === 'term' ? g.fields.term : 'annual']);
}
// Keep pre-v18 current-grade receipts and no-op comparisons compatible.
export function comparableGradeFields(fields: GradeFields) {
  const { gradeKind, ...current } = fields;
  return gradeKindOf(fields) === 'current' ? current : { ...current, gradeKind };
}
export function gradeInSchoolYear(date: string, year: string) { return date >= year.slice(0, 4) + '-09-01' && date <= year.slice(5) + '-08-31'; }

export function previewSchoolGradebook(role: SchoolRole = 'teacher', selected?: string): SchoolGradebookHome {
  const base = previewClasswork(role), ctx = base.context!, staff = ['teacher', 'admin'].includes(role), at = new Date().toISOString();
  const pupils = staff ? ctx.pupils : ctx.pupils.slice(0, 1);
  const grades = pupils.flatMap((p, i) => ['Математика', 'Български език', 'Английски език'].flatMap((subject, j) => [0, 1, 2, 3, 4].map(n => {
    const fields: GradeFields = { subject, value: 4 + (i + j + n) % 3, assessment: n ? 'project' : 'written', date: plusDays(schoolToday(), -n * 3 - j), term: n >= 3 ? 'second' : 'first', feedback: n ? 'Добра самостоятелна работа. Продължи да обясняваш стъпките.' : 'Покажи начина на решение и провери отговора.', gradeKind: n < 2 ? 'current' : n < 4 ? 'term' : 'annual' };
    const g: SchoolGrade = { id: '92000000-0000-4000-8000-' + String(100 * i + 10 * j + n + 1).padStart(12, '0'), kind: 'class-grade', pupilId: p.id, classId: p.classId, pupilName: p.name, className: ctx.classes.find(c => c.id === p.classId)?.name || '6. А', schoolYear: ctx.school.year, createdBy: 'preview-teacher', teacherName: 'Мария Николова', createdAt: at, revision: 1, fields, status: 'recorded', versions: [{ revision: 1, fields, status: 'recorded', action: 'add', reason: '', actorId: 'preview-teacher', actorName: 'Мария Николова', at, requestId: '', fingerprint: '' }] };
    if (i === 0 && j === 0 && n === 0) { g.revision = 2; g.fields = { ...fields, value: 5 }; g.versions.push({ ...g.versions[0], revision: 2, fields: g.fields, action: 'correct', reason: 'Уточнени точки след преглед на решението.' }); }
    return gradeView(g, staff);
  })));
  return { writable: false, preview: true, schools: base.schools, context: { ...ctx, pupils }, grades, canRecord: staff, capacityReached: false, ...(selected && grades.some(g => g.id === selected) ? { detail: grades.find(g => g.id === selected) } : {}) };
}
