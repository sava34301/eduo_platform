import { handlesEnrichment, handleEnrichment } from '@/lib/enrichment-service';
import { handlesHomework, handleHomework } from '@/lib/homework-service';
import { handlesDocument, handleDocument } from '@/lib/document-service';
import { publicRecords } from '@/lib/platform-data';
import { handlesSchoolOperation, handleSchoolOperation } from '@/lib/school-operations-service';
import { handlesV2, handleV2, validDate } from '@/lib/platform-service';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { seedRecords, subjects, lessons, type SchoolRecord } from '@/lib/school-data';
import { getRecords, getRecord, save } from '@/lib/store';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
class WorkspaceBodyError extends Error { constructor(readonly status: number, message: string) { super(message); } }
async function readBody(request: Request) {
    const limit = 128000;
    if (Number(request.headers.get('content-length')) > limit) throw new WorkspaceBodyError(413, 'Заявката е твърде голяма.');
    if (!request.body) throw new WorkspaceBodyError(400, 'Липсват данни.');
    const reader = request.body.getReader(), decoder = new TextDecoder(); let bytes = 0, raw = '';
    try {
        while (true) {
            const { done, value } = await reader.read(); if (done) break;
            bytes += value.byteLength;
            if (bytes > limit) { await reader.cancel(); throw new WorkspaceBodyError(413, 'Заявката е твърде голяма.'); }
            raw += decoder.decode(value, { stream: true });
        }
        return JSON.parse(raw + decoder.decode());
    } finally { reader.releaseLock(); }
}
const text = z.string().trim().min(1).max(20000);
const id = z.string().min(1).max(100);
const student = z.number().int().min(0).max(7);
const date = validDate;
const schemas: Record<string, z.ZodTypeAny> = {
    assignment: z.object({ title: text.max(180), subject: z.enum(subjects as [
            string,
            ...string[]
        ]), due: date, description: text, className: z.literal('6. А') }),
    grade: z.object({ studentId: student, subject: z.enum(subjects as [
            string,
            ...string[]
        ]), value: z.number().int().min(2).max(6), type: text.max(80), comment: z.string().max(2000), date }),
    message: z.object({ thread: z.enum(['class', 'parents', 'teacher']), from: z.enum(['student', 'teacher', 'parent', 'admin']), body: text.max(4000) }),
    profile: z.object({ style: z.enum(['examples', 'steps', 'short']), pace: z.enum(['slow', 'steady', 'fast']), interests: z.string().max(200), remember: z.boolean() }),
    practice: z.object({ lessonId: z.enum(['fractions', 'photosynthesis', 'adjectives']), answer: z.number().int().min(0).max(3) }),
    note: z.object({ role: z.enum(['student','teacher','parent','admin']).default('student'), title: text.max(150), body: z.string().max(20000), fileId: id.optional() }),
    policy: z.object({ mode: z.enum(['learning', 'exam', 'free']), domains: z.string().max(3000), apps: z.string().max(1000), camera: z.literal(false) }),
    material: z.object({ title: text.max(200), body: text, subject: z.string().max(100), format: z.enum(['lesson', 'test', 'book', 'video-script']) }),
};
export async function GET(request: Request) {
    try {
        const user = await getChatGPTUser();
        const editor = new URL(request.url).searchParams.get('editor');
        if (editor) {
            if (!user)
                return Response.json({ error: 'За редакция е необходим вход.' }, { status: 401 });
            const record = await getRecord(user.userId, editor);
            if (record?.kind !== 'quiz')
                return Response.json({ error: 'Тестът не е намерен.' }, { status: 404 });
            return Response.json({ record }, { headers: { 'Cache-Control': 'private, no-store' } });
        }
        return Response.json({ records: publicRecords(user ? await getRecords(user.userId) : seedRecords()), writable: !!user, aiConfigured: !!(env as any).OPENAI_API_KEY && !!(env as any).OPENAI_MODEL }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    catch (e) {
        console.error('workspace read failed', e instanceof Error ? e.message : 'unknown');
        return Response.json({ error: 'Не успяхме да заредим запазените данни. Опитайте отново.' }, { status: 503 });
    }
}
async function writeWorkspace(request: Request) {
    const user = await getChatGPTUser();
    if (!user)
        return Response.json({ error: 'За запис е необходим вход в платформата.' }, { status: 401 });
    const origin = request.headers.get('origin');
    if (request.headers.get('sec-fetch-site') === 'cross-site' || origin && origin !== new URL(request.url).origin)
        return Response.json({ error: 'Невалидна заявка.' }, { status: 403 });
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
        return Response.json({ error: 'Изпратете данните като JSON.' }, { status: 415 });
    try {
        const body: any = await readBody(request);
        if (!body || typeof body !== 'object' || typeof body.type !== 'string')
            return Response.json({ error: 'Невалидна заявка.' }, { status: 400 });
        if (handlesEnrichment(body.type)) return await handleEnrichment(user.userId, body.type, body.data);
        if (handlesDocument(body.type))
            return await handleDocument(user.userId, body.type, body.data);
        if (handlesHomework(body.type))
            return await handleHomework(user.userId, body.type, body.data);
        if (handlesSchoolOperation(body.type))
            return await handleSchoolOperation(user.userId, body.type, body.data);
        if (handlesV2(body.type))
            return await handleV2(user.userId, body.type, body.data);
        const schema = Object.hasOwn(schemas, body.type) ? schemas[body.type] : null;
        if (!schema)
            return Response.json({ error: 'Непознато действие.' }, { status: 400 });
        const parsed = schema.safeParse(body.data);
        if (!parsed.success)
            return Response.json({ error: 'Проверете попълнените полета.' }, { status: 400 });
        const d = parsed.data, now = new Date().toISOString();
        let record: SchoolRecord = { ...d, id: crypto.randomUUID(), kind: body.type, createdAt: now };
        let event = 'Записан запис';
        switch (body.type) {
            case 'assignment':
                record = { ...record, teacher: 'Мария Николова', format: 'Задачи', estimated: 20 };
                event = 'Създадено домашно';
                break;
            case 'grade':
                event = 'Добавена оценка от учител';
                break;
            case 'message':
                event = 'Добавено съобщение в демо разговора';
                break;
            case 'profile':
                record.id = 'profile';
                event = 'Обновен учебен профил';
                break;
            case 'practice': {
                const lesson = lessons.find(l => l.id === d.lessonId)!;
                record = { ...record, kind: 'practice', studentId: 0, correct: d.answer === lesson.answer, score: d.answer === lesson.answer ? 100 : 0 };
                event = 'Завършена учебна задача';
                break;
            }
            case 'note': {
                if (d.fileId) {
                    const f = await getRecord(user.userId, d.fileId);
                    if (f?.kind !== 'file')
                        return Response.json({ error: 'Файлът не е намерен.' }, { status: 404 });
                }
                event = 'Запазена бележка с час на предаване';
                break;
            }
            case 'policy':
                record.id = 'policy';
                event = 'Запазен проект на политика за устройства';
                break;
            case 'material':
                record = { ...record, status: 'draft', revision: 1 };
                event = 'Запазен учебен материал';
                break;
        }
        await save(user.userId, record, event);
        return Response.json({ record });
    }
    catch (e) {
        if (e instanceof WorkspaceBodyError) return Response.json({ error: e.message }, { status: e.status });
        if (e instanceof SyntaxError)
            return Response.json({ error: 'Невалидни данни.' }, { status: 400 });
        console.error('workspace write failed', e instanceof Error ? e.message : 'unknown');
        return Response.json({ error: 'Записът не бе завършен. Данните във формуляра са запазени — опитайте отново.' }, { status: 503 });
    }
}
export async function POST(request: Request) {
    const response = await writeWorkspace(request);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
}
