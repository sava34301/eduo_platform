import { getChatGPTUser } from '@/app/chatgpt-auth';
import { classworkDownload } from '@/lib/classwork-service';
import { SchoolDirectoryError } from '@/lib/school-directory-service';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const json = (error: string, status: number) => Response.json({ error }, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getChatGPTUser(); if (!user) return json('Влезте в публикуваната платформа за този файл.', 401);
    const { id } = await params, q = new URL(request.url).searchParams;
    const { file, bytes } = await classworkDownload(user, q.get('school') || '', q.get('assignment') || '', q.get('pupil') || '', id);
    return new Response(bytes, { headers: { 'Content-Type': file.mime, 'Content-Length': String(bytes.length), 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    if (e instanceof SchoolDirectoryError) return json(e.message, e.status);
    if (e instanceof z.ZodError) return json('Невалиден адрес на файл.', 400);
    console.error('Classwork file download failed', e instanceof Error ? e.message : 'Unknown failure');
    return json('Файлът временно не е достъпен. Опитайте отново.', 503);
  }
}
