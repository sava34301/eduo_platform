import { z } from 'zod';
import { getRecord, save, recordSnapshot, saveGuarded } from './store';
import { subjects, type SchoolRecord } from './school-data';
import { publicRecord, schoolToday, type QuizQuestion } from './platform-data';
const id = z.string().min(1).max(100);
const short = z.string().trim().min(1).max(200);
export const validDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(v + 'T12:00:00Z'); return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v; });
const question = z.object({ prompt: z.string().trim().min(1).max(1000), options: z.array(z.string().trim().min(1).max(300)).min(2).max(6), correct: z.number().int().min(0), explanation: z.string().max(2000), points: z.number().int().min(1).max(10) }).refine(q => q.correct < q.options.length);
const quiz = z.object({ id: id.optional(), title: short, subject: z.enum(subjects as [
        string,
        ...string[]
    ]), description: z.string().max(3000), mode: z.enum(['practice','assessment']).default('practice'), due: validDate, status: z.enum(['draft', 'published']), questions: z.array(question).min(1).max(20) });
const event = z.object({ id: id.optional(), title: short, date: validDate, time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), duration: z.number().int().min(5).max(720), location: z.string().max(200), category: z.enum(['meeting', 'activity', 'exam', 'consultation']), description: z.string().max(3000) });
const schemas: Record<string, z.ZodTypeAny> = { 'notification-read':z.object({role:z.enum(['student','teacher','parent','admin']),ids:z.array(z.string().min(1).max(250)).max(500)}), 'edit-grade':z.object({id,value:z.number().int().min(2).max(6),type:short.max(80),comment:z.string().max(2000),reason:z.string().trim().min(3).max(500)}), event, quiz, 'cancel-event': z.object({ id }), attempt: z.object({ quizId: id, requestId: z.string().uuid(), answers: z.array(z.number().int().min(0).max(5)).min(1).max(20) }), 'review-attempt': z.object({ id, feedback: z.string().trim().min(1).max(3000) }), 'edit-note': z.object({ id, title: short, body: z.string().max(20000) }), task: z.object({ title: short, due: validDate, role: z.enum(['student','teacher','parent','admin']).default('student') }), 'complete-task': z.object({ id, completed: z.boolean() }) };
export function handlesV2(type: string) { return Object.hasOwn(schemas, type); }
function fail(error: string, status = 400) { return Response.json({ error }, { status }); }
export async function handleV2(owner: string, type: string, input: unknown) {
    const parsed = schemas[type].safeParse(input);
    if (!parsed.success)
        return fail('Проверете полетата, датата и отговорите.');
    const d = parsed.data, now = new Date().toISOString();
    let record: SchoolRecord = { ...d, id: crypto.randomUUID(), kind: type, createdAt: now };
    let action = 'Обновен запис';
    switch (type) {
        case 'notification-read': {
            const old=await getRecord(owner,'read-state-'+d.role);
            record={id:'read-state-'+d.role,kind:'read-state',role:d.role,ids:[...new Set([...(old?.ids||[]),...d.ids])].slice(-500),updatedAt:now,createdAt:old?.createdAt||now};
            action='Отбелязани прочетени известия';break;
        }
        case 'edit-grade': {
            const old=await getRecord(owner,d.id);
            if(old?.kind!=='grade')return fail('Оценката не е намерена.',404);
            const history=[...(old.history||[]),{value:old.value,type:old.type,comment:old.comment,changedAt:now,reason:d.reason}];
            record={...old,value:d.value,type:d.type,comment:d.comment,history,updatedAt:now};
            action='Коригирана оценка от учител';break;
        }

        case 'event': {
            if (d.id) {
                const old = await getRecord(owner, d.id);
                if (old?.kind !== 'event')
                    return fail('Събитието не е намерено.', 404);
                record = { ...old, ...d, updatedAt: now };
            }
            record = { ...record, kind: 'event', status: 'active' };
            action = 'Запазено събитие';
            break;
        }
        case 'cancel-event': {
            const old = await getRecord(owner, d.id);
            if (old?.kind !== 'event')
                return fail('Събитието не е намерено.', 404);
            record = { ...old, status: 'cancelled', updatedAt: now };
            action = 'Отменено събитие';
            break;
        }
        case 'quiz': {
            if (d.id) {
                const old = await getRecord(owner, d.id);
                if (old?.kind !== 'quiz')
                    return fail('Тестът не е намерен.', 404);
                if (old.status !== 'draft')
                    return fail('Публикуваният тест се запазва непроменен. Създайте нов тест.', 409);
                record = { ...old, ...d, updatedAt: now };
            }
            record = { ...record, kind: 'quiz', version: 1 };
            action = d.status === 'published' ? 'Публикуван тест' : 'Запазена чернова на тест';
            break;
        }
        case 'attempt': {
            const q = await getRecord(owner, d.quizId);
            if (q?.kind !== 'quiz' || q.status !== 'published') return fail('Тестът не е публикуван.', 404);
            const attemptId = q.mode==='assessment'?'assessment-'+q.id+'-0':'attempt-'+d.requestId;
            const snapshot=await recordSnapshot(owner,attemptId),previous=snapshot.record;
            if(previous){
              if(previous.quizId===q.id&&JSON.stringify(previous.answers)===JSON.stringify(d.answers)&&(q.mode!=='assessment'||previous.requestId===d.requestId))return Response.json({record:previous});
              return fail(q.mode==='assessment'?'Този класен тест вече е предаден.':'Тази заявка вече е използвана.',409);
            }
            if(q.mode==='assessment'&&q.due<schoolToday())return fail('Срокът за този класен тест е изтекъл.',409);
            if(d.answers.length!==q.questions.length||d.answers.some((a:number,i:number)=>a>=q.questions[i].options.length))return fail('Отговорете на всеки въпрос с валидна опция.');
            let points=0;
            const details=q.questions.map((item:QuizQuestion,i:number)=>{const correct=d.answers[i]===item.correct;if(correct)points+=item.points;return {...item,chosen:d.answers[i],isCorrect:correct}});
            const maxPoints=q.questions.reduce((n:number,x:QuizQuestion)=>n+x.points,0);
            record={id:attemptId,kind:'attempt',quizId:q.id,quizTitle:q.title,subject:q.subject,mode:q.mode||'practice',requestId:d.requestId,quizVersion:q.version,studentId:0,answers:d.answers,points,maxPoints,percent:Math.round(points/maxPoints*100),details,status:'completed',createdAt:now,late:q.due<schoolToday()};
            if(!await saveGuarded(owner,record,null,'Завършен тест'))return fail('Тестът вече е предаден в друг прозорец. Обновете страницата.',409);
            return Response.json({record});
        }
        case 'review-attempt': {
            const old = await getRecord(owner, d.id);
            if (old?.kind !== 'attempt')
                return fail('Резултатът не е намерен.', 404);
            record = { ...old, feedback: d.feedback, reviewedAt: now, status: 'reviewed' };
            action = 'Прегледан резултат от тест';
            break;
        }
        case 'edit-note': {
            const old = await getRecord(owner, d.id);
            if (old?.kind !== 'note')
                return fail('Бележката не е намерена.', 404);
            record = { ...old, ...d, updatedAt: now };
            action = 'Редактирана бележка';
            break;
        }
        case 'task':
            record = { ...record, completed: false };
            action = 'Добавена лична задача';
            break;
        case 'complete-task': {
            const old = await getRecord(owner, d.id);
            if (old?.kind !== 'task')
                return fail('Задачата не е намерена.', 404);
            record = { ...old, completed: d.completed, updatedAt: now };
            action = d.completed ? 'Завършена лична задача' : 'Възстановена лична задача';
            break;
        }
    }
    await save(owner, record, action);
    return Response.json({ record: publicRecord(record) });
}
