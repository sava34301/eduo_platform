import { env } from 'cloudflare:workers';
import { encrypt, decrypt, recordSnapshot } from './store';
import { SchoolDirectoryError } from './school-directory-service';
import { workFileChoiceError, workFileName, WORK_FILE_TYPES } from './classwork-file-policy';
import type { ClassAttachment, ClassSubmission, ClassAssignment } from './classwork-data';

type PreparedFile = Omit<ClassAttachment, 'id' | 'objectKey'> & { bytes: Uint8Array };
function fail(message: string): never { throw new SchoolDirectoryError(400, message); }
const digest = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource)), b => b.toString(16).padStart(2, '0')).join('');

// Inspect central-directory names without extracting or executing ZIP entries.
// This is a basic DOCX format check, not a malware or full document validator.
function isDocx(bytes: Uint8Array) {
  if (bytes.length < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65557); p--) {
    if (v.getUint32(p, true) === 0x06054b50 && p + 22 + v.getUint16(p + 20, true) === bytes.length) { end = p; break; }
  }
  if (end < 0 || v.getUint16(end + 4, true) || v.getUint16(end + 6, true)) return false;
  const count = v.getUint16(end + 10, true), size = v.getUint32(end + 12, true), start = v.getUint32(end + 16, true);
  if (!count || count > 5000 || start + size > end) return false;
  const names = new Set<string>(); let p = start;
  for (let n = 0; n < count; n++) {
    if (p + 46 > start + size || v.getUint32(p, true) !== 0x02014b50 || v.getUint16(p + 8, true) & 1) return false;
    const length = v.getUint16(p + 28, true), next = p + 46 + length + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
    if (next > start + size) return false;
    names.add(new TextDecoder().decode(bytes.slice(p + 46, p + 46 + length))); p = next;
  }
  return p === start + size && names.has('[Content_Types].xml') && names.has('word/document.xml');
}
function signature(bytes: Uint8Array, extension: string) {
  const start = (...wanted: number[]) => wanted.every((b, i) => bytes[i] === b);
  switch (extension) {
    case 'pdf': return new TextDecoder().decode(bytes.slice(0, 1024)).includes('%PDF-');
    case 'jpg': case 'jpeg': return start(0xff, 0xd8, 0xff);
    case 'png': return start(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case 'webp': return new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
    case 'docx': return isDocx(bytes);
    case 'txt': try { return !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { return false; }
    default: return false;
  }
}
export async function prepareWorkFiles(files: File[]): Promise<PreparedFile[]> {
  const error = workFileChoiceError(files); if (error) fail(error);
  const prepared: PreparedFile[] = [];
  for (const file of files) {
    const name = workFileName(file.name), extension = name.split('.').at(-1)!.toLowerCase(), bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length !== file.size || !signature(bytes, extension)) fail(`Файлът „${name}“ не съответства на своя формат. Избери оригиналния файл.`);
    prepared.push({ name, mime: WORK_FILE_TYPES[extension].mime, size: bytes.length, sha256: await digest(bytes), bytes });
  }
  return prepared;
}
export function sameWorkFiles(saved: ClassAttachment[], incoming: PreparedFile[]) {
  return saved.length === incoming.length && saved.every((f, i) => ['name', 'mime', 'size', 'sha256'].every(k => (f as any)[k] === (incoming[i] as any)[k]));
}
export async function saveWorkFiles(files: PreparedFile[], owner: string, pendingKeys: string[], prefix: 'classwork-files' | 'school-document-files' = 'classwork-files'): Promise<ClassAttachment[]> {
  if (!files.length) return [];
  const bucket = env.BUCKET; if (!bucket) throw new Error('Classwork file storage unavailable');
  const saved: ClassAttachment[] = [];
  for (const { bytes, ...metadata } of files) {
    const id = crypto.randomUUID(), objectKey = `${prefix}/${crypto.randomUUID()}`;
    pendingKeys.push(objectKey);
    await bucket.put(objectKey, await encrypt(bytes, owner), { httpMetadata: { contentType: 'application/octet-stream' } });
    saved.push({ ...metadata, id, objectKey });
  }
  return saved;
}
export async function cleanUncommittedWorkFiles(owner: string, recordId: string, keys: string[]) {
  if (!keys.length) return;
  // A database error may arrive after the batch committed. Never delete a file
  // referenced by a saved attempt, or when commit status cannot be established.
  try {
    const bucket = env.BUCKET; if (!bucket) throw new Error('Classwork file storage unavailable');
    const snapshot = await recordSnapshot(owner, recordId), record = snapshot.record as unknown as ClassSubmission | ClassAssignment | null;
    const files = record?.kind === 'class-submission' ? record.attempts.flatMap(a => [...(a.attachments || []), ...(a.condition.attachments || [])]) : record?.kind === 'class-assignment' ? [...(record.attachments || []), ...(record.history || []).flatMap(a => a.attachments || [])] : [];
    const linked = new Set(files.map(f => f.objectKey));
    const results = await Promise.allSettled(keys.filter(k => !linked.has(k)).map(k => bucket.delete(k)));
    if (results.some(r => r.status === 'rejected')) console.error('Uncommitted classwork file cleanup deferred');
  } catch { console.error('Classwork file cleanup deferred: commit state unavailable'); }
}
export async function readWorkFile(file: ClassAttachment, owner: string) {
  if (!env.BUCKET) throw new Error('Classwork file storage unavailable');
  const object = await env.BUCKET.get(file.objectKey); if (!object) throw new Error('Saved classwork file unavailable');
  const bytes = await decrypt(new Uint8Array(await object.arrayBuffer()), owner);
  if (bytes.length !== file.size || await digest(bytes) !== file.sha256) throw new Error('Classwork file integrity check failed');
  return bytes;
}
