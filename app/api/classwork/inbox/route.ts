import { getChatGPTUser } from '@/app/chatgpt-auth';
import { classworkInbox, classworkInboxRead } from '@/lib/classwork-service';
import { previewClassworkInbox } from '@/lib/classwork-inbox-data';
import { SchoolDirectoryError } from '@/lib/school-directory-service';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
function error(e: unknown) {
  if (e instanceof SchoolDirectoryError) return json({ error: e.message }, e.status);
  if (e instanceof z.ZodError) return json({ error: 'Проверете избраните записи и обновете входящите.' }, 400);
  console.error('Classwork inbox request failed', e instanceof Error ? e.message : 'Unknown failure');
  return json({ error: 'Входящите временно не са достъпни. Опитайте отново.' }, 503);
}
export async function GET(request: Request) {
  try {
    const user = await getChatGPTUser(), q = new URL(request.url).searchParams;
    if (!user) return json(previewClassworkInbox(z.enum(['admin', 'teacher', 'parent', 'student']).catch('teacher').parse(q.get('preview'))));
    return json(await classworkInbox(user, q.get('school') || undefined));
  } catch (e) { return error(e); }
}
export async function POST(request: Request) {
  try {
    const user = await getChatGPTUser(); if (!user) return json({ error: 'Влезте в публикуваната платформа за запис.' }, 401);
    const origin = request.headers.get('origin');
    if (request.headers.get('sec-fetch-site') === 'cross-site' || origin && origin !== new URL(request.url).origin) return json({ error: 'Заявката не идва от училищната платформа.' }, 403);
    const raw = await request.text(); if (raw.length > 50000) return json({ error: 'Заявката е твърде голяма.' }, 413);
    let body: unknown; try { body = JSON.parse(raw); } catch { return json({ error: 'Невалидна заявка.' }, 400); }
    return json(await classworkInboxRead(user, body));
  } catch (e) { return error(e); }
}
