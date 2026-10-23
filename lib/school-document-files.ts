import { env } from 'cloudflare:workers';
import { recordSnapshot } from './store';
import { prepareWorkFiles, readWorkFile, saveWorkFiles } from './classwork-files';
import { workFileChoiceError } from './classwork-file-policy';
import { SchoolDirectoryError } from './school-directory-service';
import type { ClassAttachment } from './classwork-data';
import type { SchoolDocument } from './school-document-data';

export async function prepareDocumentFiles(files: File[]) {
  const error = workFileChoiceError(files, 'една версия');
  if (error) throw new SchoolDirectoryError(400, error);
  return prepareWorkFiles(files);
}
export const saveDocumentFiles = (files: Awaited<ReturnType<typeof prepareDocumentFiles>>, owner: string, keys: string[]) => saveWorkFiles(files, owner, keys, 'school-document-files');
export async function verifyDocumentFiles(files: ClassAttachment[], owner: string) {
  for (const file of files) await readWorkFile(file, owner);
}
export async function cleanDocumentFiles(owner: string, documentId: string, keys: string[]) {
  if (!keys.length) return;
  try {
    const bucket = env.BUCKET; if (!bucket) throw new Error('Document file storage unavailable');
    const saved = await recordSnapshot(owner, documentId), d = saved.record as unknown as SchoolDocument | null;
    const linked = new Set(d?.kind === 'school-document' ? [...(d.draft?.attachments || []), ...d.editions.flatMap(e => e.attachments || [])].map(f => f.objectKey) : []);
    const deleted = await Promise.allSettled(keys.filter(key => !linked.has(key)).map(key => bucket.delete(key)));
    if (deleted.some(r => r.status === 'rejected')) console.error('School document upload cleanup deferred');
  } catch { console.error('School document cleanup deferred: saved state unavailable'); }
}
