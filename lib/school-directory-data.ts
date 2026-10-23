import { schoolYear } from './enrichment-data';

export type SchoolRole = 'admin' | 'teacher' | 'parent' | 'student';
export const schoolRoleLabels: Record<SchoolRole, string> = { admin: 'Администратор', teacher: 'Учител', parent: 'Родител', student: 'Ученик' };
export type DirectoryClass = { id: string; name: string; grade: number; room: string; archived: boolean };
export type DirectoryPupil = { id: string; name: string; number: number; classId: string; archived: boolean };
export type SchoolMember = {
  userId: string; name: string; email: string; role: SchoolRole; status: 'active' | 'suspended';
  classIds: string[]; pupilIds: string[]; approvedAt: string; approvedBy: string; verificationNote: string;
};
export type AccessRequest = {
  id: string; userId: string; name: string; email: string; role: Exclude<SchoolRole, 'admin'>;
  note: string; status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  createdAt: string; reviewedAt?: string; reviewedBy?: string; reviewNote?: string;
};
export type SchoolAudit = { id: string; event: string; actor: string; at: string; detail: string };
export type SchoolDirectory = {
  id: 'directory'; kind: 'school-directory'; schoolId: string; revision: number; name: string; town: string; year: string;
  createdAt: string; createdBy: string; joinCode: string; classes: DirectoryClass[]; pupils: DirectoryPupil[];
  members: SchoolMember[]; requests: AccessRequest[]; imports: { requestId: string; digest: string; classId: string }[];
};
export type SchoolView = {
  school: { id: string; name: string; town: string; year: string; revision: number };
  self: (Omit<SchoolMember, 'approvedBy' | 'verificationNote'> & Partial<Pick<SchoolMember, 'approvedBy' | 'verificationNote'>>) | null; request?: AccessRequest; classes: DirectoryClass[]; pupils: DirectoryPupil[];
  members?: SchoolMember[]; requests?: AccessRequest[]; joinCode?: string; audit?: SchoolAudit[];
};
export type SchoolHome = {
  writable: boolean; preview: boolean; identity: { name: string; email: string } | null;
  schools: { id: string; name: string; year: string; status: string; role?: SchoolRole }[];
  current: SchoolView | null;
};

// This projection is used on the server before data leaves the school endpoint.
// The demonstration role selected elsewhere in the app is never an input.
export function directoryView(s: SchoolDirectory, userId: string): SchoolView | null {
  const self = s.members.find(m => m.userId === userId) || null;
  const request = s.requests.filter(r => r.userId === userId).at(-1);
  if (!self && !request) return null;
  const safeSelf = self ? (({ approvedBy, verificationNote, ...visible }) => visible)(self) : null;
  const safeRequest = request ? (({ reviewedBy, ...visible }) => visible)(request) : undefined;
  const base: SchoolView = { school: { id: s.schoolId, name: s.name, town: s.town, year: s.year, revision: s.revision }, self: safeSelf, request: safeRequest, classes: [], pupils: [] };
  if (!self || self.status !== 'active') return base;
  if (self.role === 'admin') return { ...base, self, classes: s.classes, pupils: s.pupils, members: s.members, requests: s.requests, joinCode: s.joinCode };
  const pupils = s.pupils.filter(p => !p.archived && (self.role === 'teacher' ? self.classIds.includes(p.classId) : self.pupilIds.includes(p.id)));
  const classIds = self.role === 'teacher' ? self.classIds : pupils.map(p => p.classId);
  return { ...base, classes: s.classes.filter(c => !c.archived && classIds.includes(c.id)), pupils };
}

export function previewSchoolHome(): SchoolHome {
  const now = new Date().toISOString(), schoolId = '00000000-0000-4000-8000-000000000008';
  const classes = [{ id: '10000000-0000-4000-8000-000000000001', name: '6. А', grade: 6, room: '201', archived: false }, { id: '10000000-0000-4000-8000-000000000002', name: '6. Б', grade: 6, room: '202', archived: false }];
  const pupils = ['Алекс Петров', 'Борис Георгиев', 'Виктория Иванова', 'Габриела Попова', 'Даниел Стоянов', 'Елена Тодорова', 'Мартин Колев', 'Никол Димова'].map((name, i) => ({ id: `20000000-0000-4000-8000-00000000000${i+1}`, name, number: i % 4 + 1, classId: classes[i < 4 ? 0 : 1].id, archived: false }));
  const self: SchoolMember = { userId: 'preview-admin', name: 'Иван Димитров', email: 'director@example.test', role: 'admin', status: 'active', classIds: [], pupilIds: [], approvedAt: now, approvedBy: 'preview-admin', verificationNote: 'Примерен администратор' };
  const directory: SchoolDirectory = {
    id: 'directory', kind: 'school-directory', schoolId, revision: 1, name: 'Демо училище', town: 'София', year: schoolYear(), createdAt: now, createdBy: self.userId, joinCode: '', classes, pupils,
    members: [self, { ...self, userId: 'preview-teacher', name: 'Мария Николова', email: 'teacher@example.test', role: 'teacher', classIds: [classes[0].id], verificationNote: 'Проверено назначение · пример' }, { ...self, userId: 'preview-parent', name: 'Елена Петрова', email: 'parent@example.test', role: 'parent', pupilIds: [pupils[0].id], verificationNote: 'Проверена връзка · пример' }],
    requests: [{ id: '30000000-0000-4000-8000-000000000001', userId: 'preview-applicant', name: 'Анна Колева', email: 'anna@example.test', role: 'teacher', note: 'Преподавател по английски език за 6. Б клас.', status: 'pending', createdAt: now }], imports: [],
  };
  return { writable: false, preview: true, identity: null, schools: [{ id: schoolId, name: directory.name, year: directory.year, status: 'active', role: 'admin' }], current: { ...directoryView(directory, self.userId)!, audit: [{ id: 'preview-audit', event: 'school-created', actor: self.name, at: now, detail: 'Създадена примерна училищна среда' }] } };
}

/** Small CSV reader for a user-supplied class roster; no network or inference. */
export function parseRosterCSV(text: string): { rows: { number: number; name: string }[]; errors: string[] } {
  if (text.length > 50000) return { rows: [], errors: ['Файлът е твърде голям. Импортирайте до 100 ученици наведнъж.'] };
  const input = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const first = input.split('\n')[0] || '', delimiter = first.includes(';') ? ';' : first.includes('\t') ? '\t' : ',';
  const data: { fields: string[]; line: number }[] = []; let row: string[] = [], field = '', quoted = false, line = 1, rowLine = 1;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') { if (quoted && input[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (ch === delimiter || ch === '\n')) { row.push(field.trim()); field = ''; if (ch === '\n') { if (row.some(Boolean)) data.push({ fields: row, line: rowLine }); row = []; rowLine = line + 1; } }
    else field += ch;
    if (ch === '\n') line++;
  }
  row.push(field.trim()); if (row.some(Boolean)) data.push({ fields: row, line: rowLine });
  if (quoted) return { rows: [], errors: ['Има незатворени кавички в CSV текста.'] };
  if (data[0] && /^(№|номер|number|no\.?|#)$/i.test(data[0].fields[0])) data.shift();
  if (data.length > 100) return { rows: [], errors: ['Разделете списъка на части до 100 ученици.'] };
  const rows: { number: number; name: string }[] = [], errors: string[] = [], seen = new Set<number>();
  data.forEach(({ fields: r, line: rowNumber }) => {
    const number = Number(r[0]), name = r[1] || '';
    if (r.length !== 2 || !Number.isInteger(number) || number < 1 || number > 100 || name.length < 3 || name.length > 120 || /[\r\n]/.test(name)) errors.push(`Ред ${rowNumber}: въведете номер от 1 до 100 и пълно име в две колони.`);
    else if (seen.has(number)) errors.push(`Ред ${rowNumber}: номер ${number} се повтаря.`);
    else { seen.add(number); rows.push({ number, name }); }
  });
  if (!data.length) errors.push('Добавете поне един ученик.');
  return { rows, errors };
}
