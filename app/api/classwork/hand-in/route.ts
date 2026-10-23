import { getChatGPTUser } from '@/app/chatgpt-auth';
import { classworkCommand } from '@/lib/classwork-service';
import { classworkMultipart } from '@/lib/classwork-multipart';
import { SchoolDirectoryError } from '@/lib/school-directory-service';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function POST(request: Request) {
  try {
    const user = await getChatGPTUser(); if (!user) return json({ error: 'Влезте в публикуваната платформа за предаване.' }, 401);
    const origin = request.headers.get('origin');
    if (request.headers.get('sec-fetch-site') === 'cross-site' || origin && origin !== new URL(request.url).origin) return json({ error: 'Заявката не идва от училищната платформа.' }, 403);
    const { input, files } = await classworkMultipart(request);
    return json(await classworkCommand(user, 'submit', input, files));
  } catch (e) {
    if (e instanceof SchoolDirectoryError) return json({ error: e.message }, e.status);
    if (e instanceof z.ZodError) return json({ error: 'Проверете решението и избраните файлове.' }, 400);
    console.error('Classwork hand-in failed', e instanceof Error ? e.message : 'Unknown failure');
    return json({ error: 'Работата не е предадена. Текстът и избраните файлове остават във формуляра. Опитайте отново.' }, 503);
  }
}
