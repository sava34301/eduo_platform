"use client";
import { useState } from 'react';
import { Upload, LoaderCircle, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import type { SchoolRecord } from '@/lib/school-data';
import type { Ctx } from './school-app';
export function FilePicker({ files, setFiles, capture = false, onUploading, ...c }: Ctx & {
    files: SchoolRecord[];
    setFiles: (files: SchoolRecord[]) => void;
    capture?: boolean;
    onUploading?: (value:boolean)=>void;
}) { const [uploading, setUploading] = useState(false); return <div className="file-picker"><label className={`upload-zone ${uploading ? 'uploading' : ''}`}><input type="file" accept=".pdf,.docx,.txt,image/jpeg,image/png,image/webp" capture={capture ? 'environment' : undefined} disabled={uploading || files.length >= 3} onChange={async (e) => { const f = e.target.files?.[0]; if (!f)
    return; setUploading(true); onUploading?.(true); try {
    if (f.size > 10 * 1024 * 1024)
        throw new Error('Файлът трябва да е до 10 MB.');
    const saved = await c.upload(f);
    setFiles([...files, saved]);
    toast.success('Файлът е качен');
}
catch (e) {
    toast.error(e instanceof Error ? e.message : 'Неуспешно качване.');
}
finally {
    setUploading(false);
    onUploading?.(false);
    e.target.value = '';
} }}/>{uploading ? <LoaderCircle size={23} className="spin"/> : <Upload size={23}/>}<strong>{uploading ? 'Качване…' : 'Избери файл или снимка'}</strong><span>PDF, DOCX, TXT, JPG, PNG · до 10 MB · до 3 файла</span></label>{files.map(f => <div className="attached-file" key={f.id}><Paperclip size={16}/><a href={`/api/files/${f.id}`}>{f.name}</a><button type="button" aria-label={`Премахни ${f.name}`} onClick={() => setFiles(files.filter(x => x.id !== f.id))}><X size={16}/></button></div>)}</div>; }
