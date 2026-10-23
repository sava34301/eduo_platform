import { getChatGPTUser } from '@/app/chatgpt-auth';
import { previewSchoolLearning } from '@/lib/school-learning-data';
import { schoolLearningHome, schoolLearningCommand } from '@/lib/school-learning-service';
import { SchoolDirectoryError } from '@/lib/school-directory-service';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
function error(e: unknown) {
  if (e instanceof SchoolDirectoryError) return json({ error: e.message }, e.status);
  if (e instanceof z.ZodError) return json({ error: 'Проверете полетата и използвайте HTTPS връзка без данни за вход.' }, 400);
  console.error('School learning request failed', e instanceof Error ? e.message : 'Unknown failure');
  return json({ error: 'Учебната библиотека временно не е достъпна. Опитайте отново.' }, 503);
}
export async function GET(request: Request) {
  try { const user = await getChatGPTUser(), q = new URL(request.url).searchParams;
    if (!user) return json(previewSchoolLearning(z.enum(['admin', 'teacher', 'parent', 'student']).catch('teacher').parse(q.get('preview')), q.get('lesson') || undefined));
    return json(await schoolLearningHome(user, q.get('school') || undefined, q.get('lesson') || undefined));
  } catch (e) { return error(e); }
}
export async function POST(request: Request) {
  try { const user = await getChatGPTUser(); if (!user) return json({ error: 'Влезте в публикуваната платформа за запис.' }, 401);
    const origin = request.headers.get('origin'); if (request.headers.get('sec-fetch-site') === 'cross-site' || origin && origin !== new URL(request.url).origin) return json({ error: 'Заявката не идва от училищната платформа.' }, 403);
    const raw = await request.text(); if (raw.length > 50000) return json({ error: 'Заявката е твърде голяма.' }, 413);
    let body: any; try { body = JSON.parse(raw); } catch { return json({ error: 'Невалидна заявка.' }, 400); }
    return json(await schoolLearningCommand(user, body?.type, body?.data));
  } catch (e) { return error(e); }
}
