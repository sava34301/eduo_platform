import { getChatGPTUser } from '@/app/chatgpt-auth';
import { schoolCommand, schoolHome, SchoolDirectoryError } from '@/lib/school-directory-service';
import { previewSchoolHome } from '@/lib/school-directory-data';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const response = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
function failure(error: unknown) {
  if (error instanceof SchoolDirectoryError) return response({ error: error.message }, error.status);
  if (error instanceof z.ZodError) return response({ error: 'Проверете задължителните полета и избраните стойности.' }, 400);
  console.error('school directory unavailable', error instanceof Error ? error.message : 'unknown');
  return response({ error: 'Училищната среда временно не е достъпна. Опитайте отново.' }, 503);
}
export async function GET(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return response(previewSchoolHome());
    return response(await schoolHome(user, new URL(request.url).searchParams.get('school') || undefined));
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return response({ error: 'За училищен достъп е необходим вход.' }, 401);
  const origin = request.headers.get('origin');
  if (request.headers.get('sec-fetch-site') === 'cross-site' || origin && origin !== new URL(request.url).origin) return response({ error: 'Невалидна заявка.' }, 403);
  try {
    const raw = await request.text(); if (raw.length > 90000) return response({ error: 'Заявката е твърде голяма.' }, 413);
    let body; try { body = JSON.parse(raw); } catch { return response({ error: 'Невалидна заявка.' }, 400); }
    if (!body || typeof body.type !== 'string') return response({ error: 'Невалидна заявка.' }, 400);
    return response(await schoolCommand(user, body.type, body.data));
  } catch (error) { return failure(error); }
}
