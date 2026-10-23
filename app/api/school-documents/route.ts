import { getChatGPTUser } from '@/app/chatgpt-auth';
import { previewSchoolDocuments } from '@/lib/school-document-data';
import { schoolDocumentsHome, schoolDocumentCommand } from '@/lib/school-document-service';
import { SchoolDirectoryError } from '@/lib/school-directory-service';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
function error(e: unknown, writing = false) {
  if (e instanceof SchoolDirectoryError) return json({ error: e.message }, e.status);
  if (e instanceof z.ZodError) return json({ error: 'Проверете документа, получателите, версията и подписа.' }, 400);
  console.error('School document request failed', e instanceof Error ? e.message : 'Unknown failure');
  return json({ error: writing ? 'Не получихме потвърждение. Проверете запазената версия и разписка преди повторно изпращане.' : 'Документите временно не са достъпни.' }, 503);
}
async function body(request: Request) {
  const limit = 128000; if (Number(request.headers.get('content-length')) > limit) throw new SchoolDirectoryError(413, 'Заявката е твърде голяма.');
  if (!request.body) return '';
  const reader = request.body.getReader(), decoder = new TextDecoder(); let raw = '', bytes = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > limit) { await reader.cancel(); throw new SchoolDirectoryError(413, 'Заявката е твърде голяма.'); } raw += decoder.decode(value, { stream: true }); } return raw + decoder.decode(); }
  finally { reader.releaseLock(); }
}
export async function GET(request: Request) {
  try {
    const user = await getChatGPTUser(), q = new URL(request.url).searchParams;
    if (!user) return json(previewSchoolDocuments(z.enum(['teacher', 'admin', 'parent', 'student']).catch('teacher').parse(q.get('preview')), q.get('document') || undefined));
    const edition = q.has('edition') ? z.coerce.number().int().positive().parse(q.get('edition')) : undefined;
    return json(await schoolDocumentsHome(user, q.get('school') || undefined, q.get('document') || undefined, edition));
  } catch (e) { return error(e); }
}
export async function POST(request: Request) {
  try {
    const user = await getChatGPTUser(); if (!user) return json({ error: 'За запис е необходим вход в училищния акаунт.' }, 401);
    const origin = request.headers.get('origin');
    if (request.headers.get('sec-fetch-site') === 'cross-site' || origin && origin !== new URL(request.url).origin) return json({ error: 'Заявката не идва от училищната платформа.' }, 403);
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return json({ error: 'Изпратете данните като JSON.' }, 415);
    let input: unknown; try { input = JSON.parse(await body(request)); } catch (e) { if (e instanceof SchoolDirectoryError) throw e; return json({ error: 'Невалидна заявка.' }, 400); }
    const command = z.object({ type: z.string().max(60), data: z.unknown() }).strict().parse(input);
    return json(await schoolDocumentCommand(user, command.type, command.data));
  } catch (e) { return error(e, true); }
}
