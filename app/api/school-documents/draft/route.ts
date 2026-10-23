import { getChatGPTUser } from '@/app/chatgpt-auth';
import { classworkMultipart } from '@/lib/classwork-multipart';
import { schoolDocumentCommand } from '@/lib/school-document-service';
import { SchoolDirectoryError } from '@/lib/school-directory-service';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function POST(request: Request) {
  try {
    const user = await getChatGPTUser(); if (!user) return json({ error: 'За приложения е необходим вход в училищния акаунт.' }, 401);
    const origin = request.headers.get('origin');
    if (request.headers.get('sec-fetch-site') === 'cross-site' || origin && origin !== new URL(request.url).origin) return json({ error: 'Заявката не идва от училищната платформа.' }, 403);
    const { input, files } = await classworkMultipart(request, { context: 'документа', overheadBytes: 128000 });
    return json(await schoolDocumentCommand(user, 'document-save', input, files));
  } catch (e) {
    if (e instanceof SchoolDirectoryError) return json({ error: e.message }, e.status);
    if (e instanceof z.ZodError) return json({ error: 'Проверете черновата и избраните приложения.' }, 400);
    console.error('School document draft upload failed', e instanceof Error ? e.message : 'Unknown failure');
    return json({ error: 'Записът не е потвърден. Избраното остава във формуляра. Проверете запазената чернова преди повторно изпращане.' }, 503);
  }
}
