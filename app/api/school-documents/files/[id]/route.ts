import { getChatGPTUser } from '@/app/chatgpt-auth';
import { schoolDocumentDownload } from '@/lib/school-document-service';
import { SchoolDirectoryError } from '@/lib/school-directory-service';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const json = (error: string, status: number) => Response.json({ error }, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getChatGPTUser(); if (!user) return json('За този файл е необходим вход в училищния акаунт.', 401);
    const q = new URL(request.url).searchParams, { id } = await params;
    const { file, bytes } = await schoolDocumentDownload(user, { schoolId: q.get('school') || '', documentId: q.get('document') || '', fileId: id, ...(q.has('edition') ? { edition: Number(q.get('edition')) } : {}), ...(q.has('draftRevision') ? { draftRevision: Number(q.get('draftRevision')) } : {}) });
    return new Response(bytes, { headers: { 'Content-Type': file.mime, 'Content-Length': String(bytes.length), 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    if (e instanceof SchoolDirectoryError) return json(e.message, e.status);
    if (e instanceof z.ZodError) return json('Невалиден адрес на файл или версия.', 400);
    console.error('School document download failed', e instanceof Error ? e.message : 'Unknown failure');
    return json('Файлът временно не е достъпен. Обновете документа и опитайте отново.', 503);
  }
}
