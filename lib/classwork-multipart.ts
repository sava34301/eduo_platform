import { MAX_WORK_TOTAL_BYTES } from './classwork-file-policy';
import { SchoolDirectoryError } from './school-directory-service';

export async function classworkMultipart(request: Request, options: { context?: string; overheadBytes?: number } = {}) {
  const context = options.context || 'домашното', maxRequestBytes = MAX_WORK_TOTAL_BYTES + (options.overheadBytes ?? 65536);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data;')) throw new SchoolDirectoryError(400, `Използвай формуляра за ${context}.`);
  if (Number(request.headers.get('content-length')) > maxRequestBytes) throw new SchoolDirectoryError(413, 'Общият размер на файловете трябва да е до 20 MB.');
  if (!request.body) throw new SchoolDirectoryError(400, 'Формулярът е празен.');
  const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > maxRequestBytes) { await reader.cancel(); throw new SchoolDirectoryError(413, 'Общият размер на файловете трябва да е до 20 MB.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let p = 0;
  for (const chunk of chunks) { bytes.set(chunk, p); p += chunk.byteLength; }
  let form: FormData;
  try { form = await new Response(bytes, { headers: { 'Content-Type': request.headers.get('content-type')! } }).formData(); }
  catch { throw new SchoolDirectoryError(400, 'Формулярът не е получен изцяло. Опитайте отново.'); }
  const data = form.getAll('data'), files = form.getAll('files');
  if (data.length !== 1 || typeof data[0] !== 'string' || data[0].length > 60000 || Array.from(form.keys()).some(k => !['data', 'files'].includes(k)) || files.some(f => !(f instanceof File))) throw new SchoolDirectoryError(400, `Невалиден формуляр за ${context}.`);
  let input: unknown; try { input = JSON.parse(data[0]); } catch { throw new SchoolDirectoryError(400, `Невалидни данни за ${context}.`); }
  return { input, files: files as File[] };
}
