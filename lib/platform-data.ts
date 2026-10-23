import type { SchoolRecord } from './school-data';
export type QuizQuestion = {
    prompt: string;
    options: string[];
    correct?: number;
    explanation?: string;
    points: number;
};
export const schoolToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Sofia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function plusDays(iso: string, n: number) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export const formatDate = (iso: string) => new Date(iso.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('bg-BG', { day: 'numeric', month: 'long' });
export const eventLabels: Record<string, string> = { meeting: 'Родителска среща', activity: 'Събитие', exam: 'Оценяване', consultation: 'Консултация', assignment: 'Домашно', quiz: 'Тест', document: 'Документ' };
export function featureSeedRecords(): SchoolRecord[] {
    const now = schoolToday();
    return [
        { id: 'eduo-features-v2', kind: 'system', version: 2 },
        { id: 'event-consultation', kind: 'event', title: 'Консултация по математика', date: plusDays(now, 2), time: '14:00', duration: 40, location: 'Кабинет 201', category: 'consultation', description: 'Донеси въпросите си за обикновените дроби. Примерно събитие за 6. А клас.', status: 'active' },
        { id: 'event-parents', kind: 'event', title: 'Родителска среща · 6. А', date: plusDays(now, 4), time: '18:00', duration: 60, location: 'Кабинет 202', category: 'meeting', description: 'Организация на учебния срок и предстоящи дейности. Примерно събитие.', status: 'active' },
        { id: 'quiz-fractions-v2', kind: 'quiz', title: 'Обикновени дроби — провери знанията си', subject: 'Математика', description: 'Три задачи за събиране, изваждане и сравняване. Резултатът е за упражнение; не се вписва автоматично в дневника.', due: plusDays(now, 3), status: 'published', version: 1, createdAt: new Date().toISOString(), questions: [
                { prompt: 'Колко е 1/3 + 1/6?', options: ['2/9', '1/2', '1/9', '2/6'], correct: 1, points: 2, explanation: '1/3 = 2/6. Тогава 2/6 + 1/6 = 3/6 = 1/2.' },
                { prompt: 'Колко е 3/4 − 1/8?', options: ['2/4', '1/2', '5/8', '2/8'], correct: 2, points: 2, explanation: '3/4 = 6/8. Изваждаме 1/8 и получаваме 5/8.' },
                { prompt: 'Коя дроб е най-голяма?', options: ['1/2', '2/3', '3/4', '1/4'], correct: 2, points: 2, explanation: 'С общ знаменател 12: 6/12, 8/12, 9/12 и 3/12. Най-голяма е 9/12 = 3/4.' }
            ] }
    ];
}
export function publicRecord(r: SchoolRecord): SchoolRecord { if (r.kind !== 'quiz')
    return r; return { ...r, questions: r.questions.map(({ correct, explanation, ...q }: QuizQuestion) => q) }; }
export function publicRecords(records: SchoolRecord[]) { return records.filter(r => r.kind !== 'system').map(publicRecord); }
export function calendarItems(records: SchoolRecord[]) {
    return records.flatMap(r => {
        if (r.kind === 'event' && r.status === 'active')
            return [{ id: r.id, title: r.title, date: r.date, time: r.time, type: r.category, record: r }];
        if (r.kind === 'assignment' && !r.archived)
            return [{ id: r.id, title: r.title, date: r.due, time: '', type: 'assignment', record: r }];
        if (r.kind === 'quiz' && r.status === 'published')
            return [{ id: r.id, title: r.title, date: r.due, time: '', type: 'quiz', record: r }];
        if (r.kind === 'document' && r.status === 'pending')
            return [{ id: r.id, title: r.title, date: r.due, time: '', type: 'document', record: r }];
        return [];
    }).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
export function csvText(rows: (string | number)[][]) { return '\uFEFF' + rows.map(row => row.map(value => { let s = String(value); if (/^[=+\-@\t\r]/.test(s))
    s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; }).join(',')).join('\r\n'); }
export function downloadFile(name: string, body: string, mime = 'text/plain;charset=utf-8') { const url = URL.createObjectURL(new Blob([body], { type: mime })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function calendarICS(items: ReturnType<typeof calendarItems>) { const esc = (v: string) => v.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(';', '\\;').replaceAll(',', '\\,'); const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Eduo//School Calendar//BG', 'CALSCALE:GREGORIAN']; for (const item of items) {
    lines.push('BEGIN:VEVENT', 'UID:' + esc(item.id) + '@eduo', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'), 'DTSTART;VALUE=DATE:' + item.date.replaceAll('-', ''), 'DTEND;VALUE=DATE:' + plusDays(item.date, 1).replaceAll('-', ''), 'SUMMARY:' + esc(item.title), 'DESCRIPTION:' + esc((item.time ? 'Час: ' + item.time + ' (Europe/Sofia). ' : '') + (item.record.description || '')), 'END:VEVENT');
} lines.push('END:VCALENDAR'); return lines.join('\r\n') + '\r\n'; }
