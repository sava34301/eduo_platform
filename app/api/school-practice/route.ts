import { getChatGPTUser } from '@/app/chatgpt-auth';
import { previewSchoolPractice } from '@/lib/school-practice-data';
import { schoolPracticeHome, schoolPracticeCommand } from '@/lib/school-practice-service';
import { SchoolDirectoryError } from '@/lib/school-directory-service';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
function error(e: unknown) {
  if (e instanceof SchoolDirectoryError) return json({ error: e.message }, e.status);
  if (e instanceof z.ZodError) return json({ error: 'Проверете полетата, въпросите и избраните отговори.' }, 400);
  console.error('School practice request failed', e instanceof Error ? e.message : 'Unknown failure');
  return json({ error: 'Упражненията временно не са достъпни. Опитайте отново.' }, 503);
}
async function readBody(request: Request) {
  const limit = 150000, length = Number(request.headers.get('content-length'));
  if (length > limit) throw new SchoolDirectoryError(413, 'Заявката е твърде голяма.');
  if (!request.body) return '';
  const reader = request.body.getReader(), decoder = new TextDecoder(); let bytes = 0, raw = '';
  try { while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > limit) { await reader.cancel(); throw new SchoolDirectoryError(413, 'Заявката е твърде голяма.'); } raw += decoder.decode(value, { stream: true }); } return raw + decoder.decode(); }
  finally { reader.releaseLock(); }
}
export async function GET(request: Request) {
  try { const user = await getChatGPTUser(), q = new URL(request.url).searchParams;
    if (!user) return json(previewSchoolPractice(z.enum(['admin', 'teacher', 'parent', 'student']).catch('teacher').parse(q.get('preview')), q.get('practice') || undefined));
    return json(await schoolPracticeHome(user, q.get('school') || undefined, q.get('practice') || undefined, q.get('lesson') || undefined));
  } catch (e) { return error(e); }
}
export async function POST(request: Request) {
  try { const user = await getChatGPTUser(); if (!user) return json({ error: 'Влезте в публикуваната платформа за запис.' }, 401);
    const origin = request.headers.get('origin'); if (request.headers.get('sec-fetch-site') === 'cross-site' || origin && origin !== new URL(request.url).origin) return json({ error: 'Заявката не идва от училищната платформа.' }, 403);
    const raw = await readBody(request); let body: any; try { body = JSON.parse(raw); } catch { return json({ error: 'Невалидна заявка.' }, 400); }
    return json(await schoolPracticeCommand(user, body?.type, body?.data));
  } catch (e) { return error(e); }
}
