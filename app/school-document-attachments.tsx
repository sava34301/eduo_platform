"use client";
import { useEffect, useRef, useState } from 'react';
import { Download, FileText, LoaderCircle, Paperclip, Plus, RotateCcw, X } from 'lucide-react';
import type { ClassAttachmentView } from '@/lib/classwork-data';
import { WORK_FILE_ACCEPT, workFileChoiceError, workFileSize } from '@/lib/classwork-file-policy';
import { schoolDocumentFileUrl } from '@/lib/school-document-data';

export function DocumentAttachmentChoices({ files, setFiles, retained, setRetained, available, disabled }: { files: File[]; setFiles: (value: File[]) => void; retained: ClassAttachmentView[]; setRetained: (value: ClassAttachmentView[]) => void; available: ClassAttachmentView[]; disabled: boolean }) {
  const input = useRef<HTMLInputElement>(null), [error, setError] = useState('');
  const choose = (nextFiles: File[], nextRetained = retained) => {
    const invalid = workFileChoiceError([...nextRetained.map(f => ({ name: f.name, size: f.size, type: f.mime })), ...nextFiles], 'една версия');
    setError(invalid || ''); if (invalid) return;
    setFiles(nextFiles); setRetained(nextRetained);
  };
  return <section className="sd-attachment-picker" aria-label="Приложения към черновата"><div className="sd-files-heading"><h3><Paperclip size={18}/>Приложения към документа</h3><span>{files.length + retained.length} / 3</span></div>
    <p>До 3 файла · 10 MB на файл · общо 20 MB. PDF, DOCX, TXT, JPG, PNG или WebP.</p>
    <input ref={input} className="sd-file-input" type="file" multiple accept={WORK_FILE_ACCEPT} aria-label="Избери приложения към документа" disabled={disabled} onChange={event => { choose([...files, ...Array.from(event.target.files || [])]); event.target.value = ''; }}/>
    <button className="sd-add-files" type="button" disabled={disabled || files.length + retained.length >= 3} onClick={() => input.current?.click()}><Plus size={17}/>Избери файлове</button>
    <ul className="sd-file-choices">{retained.map(f => <li key={f.id}><FileText size={20}/><span><strong>{f.name}</strong><small>{workFileSize(f.size)} · запазен файл</small></span><button type="button" disabled={disabled} aria-label={`Изключи ${f.name} от черновата`} onClick={() => choose(files, retained.filter(item => item.id !== f.id))}><X size={17}/></button></li>)}{files.map((f, i) => <li key={i}><FileText size={20}/><span><strong>{f.name}</strong><small>{workFileSize(f.size)} · чака запазване</small></span><button type="button" disabled={disabled} aria-label={`Премахни избрания файл ${f.name}`} onClick={() => choose(files.filter((_, index) => index !== i))}><X size={17}/></button></li>)}</ul>
    {available.filter(f => !retained.some(r => r.id === f.id)).map(f => <button className="sd-restore-file" type="button" key={f.id} disabled={disabled} onClick={() => choose(files, [...retained, f])}><RotateCcw size={14}/>Върни {f.name}</button>)}
    {error && <p className="directory-error" role="alert">{error}</p>}<p className="sd-muted">Изключването променя само черновата. Файловете в предоставените версии се запазват. При неуспешен запис изборът остава тук.</p>
  </section>;
}

export function DocumentAttachments({ files, schoolId, documentId, edition, draftRevision, disabled }: { files: ClassAttachmentView[]; schoolId: string; documentId: string; edition?: number; draftRevision?: number; disabled: boolean }) {
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), current = useRef<AbortController | null>(null);
  useEffect(() => () => current.current?.abort(), []);
  useEffect(() => { current.current?.abort(); setBusy(''); setError(''); }, [documentId, edition, draftRevision]);
  async function download(file: ClassAttachmentView) {
    const controller = new AbortController(); current.current = controller; setBusy(file.id); setError('');
    try {
      const response = await fetch(schoolDocumentFileUrl(schoolId, documentId, file.id, { edition, draftRevision }), { credentials: 'same-origin', cache: 'no-store', redirect: 'manual', signal: controller.signal });
      const mime = (response.headers.get('Content-Type') || '').split(';')[0].trim();
      if (!response.ok) { let message = 'Файлът не е достъпен. Обновете документа и опитайте отново.'; if (mime === 'application/json') { const data: unknown = await response.json(); if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') message = data.error; } throw new Error(message); }
      if (response.redirected || mime !== file.mime) throw new Error('Не получихме очаквания файл. Влезте отново в Eduo и опитайте отново.');
      const bytes = await response.arrayBuffer(), digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
      if (bytes.byteLength !== file.size || digest !== file.sha256) throw new Error('Полученият файл не съвпада с тази версия. Опитайте отново.');
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(new Blob([bytes], { type: file.mime })), anchor = document.createElement('a'); anchor.href = url; anchor.download = file.name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Изтеглянето не е потвърдено. Опитайте отново.'); }
    finally { if (current.current === controller && !controller.signal.aborted) setBusy(''); }
  }
  if (!files.length) return null;
  return <section className="sd-saved-files"><div className="sd-files-heading"><h3><Paperclip size={18}/>Приложения · {edition ? `версия ${edition}` : 'чернова'}</h3><span>{files.length}</span></div><p>Тези файлове са част от показаната версия. Изтеглете ги отделно от копието на документа.</p><div>{files.map(f => <div className="sd-saved-file" key={f.id}><button type="button" disabled={disabled || !!busy} onClick={() => download(f)} aria-label={`Изтегли ${f.name}`}><FileText size={21}/><span><strong>{f.name}</strong><small>{workFileSize(f.size)}</small></span>{busy === f.id ? <LoaderCircle size={18} className="spin"/> : <Download size={18}/>}</button><details><summary>Отпечатък на файла</summary><p>SHA-256: {f.sha256}</p></details></div>)}</div>{error && <p className="directory-error" role="alert">{error}</p>}</section>;
}
