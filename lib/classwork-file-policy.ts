export const MAX_WORK_FILES = 3;
export const MAX_WORK_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_WORK_TOTAL_BYTES = 20 * 1024 * 1024;
export const WORK_FILE_ACCEPT = '.pdf,.docx,.txt,.jpg,.jpeg,.png,.webp';
export const WORK_FILE_TYPES: Record<string, { mime: string; label: string }> = {
  pdf: { mime: 'application/pdf', label: 'PDF' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'DOCX' },
  txt: { mime: 'text/plain', label: 'TXT' },
  jpg: { mime: 'image/jpeg', label: 'JPG' },
  jpeg: { mime: 'image/jpeg', label: 'JPG' },
  png: { mime: 'image/png', label: 'PNG' },
  webp: { mime: 'image/webp', label: 'WebP' },
};
export function workFileName(name: string) {
  return name.replace(/\\/g, '/').split('/').at(-1)!.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim();
}
export function workFileChoiceError(files: Pick<File, 'name' | 'size' | 'type'>[], context = 'едно предаване'): string | null {
  if (files.length > MAX_WORK_FILES) return `Избери до 3 файла за ${context}.`;
  if (files.some(f => !f.size || f.size > MAX_WORK_FILE_BYTES)) return 'Всеки файл трябва да е между 1 байт и 10 MB.';
  if (files.reduce((n, f) => n + f.size, 0) > MAX_WORK_TOTAL_BYTES) return 'Общият размер на файловете трябва да е до 20 MB.';
  for (const f of files) {
    const name = workFileName(f.name), extension = name.split('.').at(-1)?.toLowerCase() || '';
    const format = Object.hasOwn(WORK_FILE_TYPES, extension) ? WORK_FILE_TYPES[extension] : undefined;
    if (!name || name.length > 200 || !format || f.type && f.type !== 'application/octet-stream' && f.type !== format.mime) return 'Използвай PDF, DOCX, TXT, JPG, PNG или WebP с име до 200 знака.';
  }
  return null;
}
export function workFileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.ceil(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} MB`;
}
