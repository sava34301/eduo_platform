"use client";
import { requestUUID } from '@/lib/client-id';
import './documents.css';
import { useEffect, useState } from 'react';
import { Check, CheckCheck, ClipboardCheck, Clock, Download, FileText, History, LockKeyhole, MailCheck, PenLine, Plus, RefreshCw, Search, ShieldCheck, Undo2, Users, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Button, Blank, Choice, PageHeading, Pill } from './eduo-ui';
import { FilePicker } from './file-picker';
import { csvText, downloadFile, formatDate, plusDays, schoolToday } from '@/lib/platform-data';
import { documentCategories, documentColor, documentLabels, documentReceiptText, documentReceiptHtml, documentRevision, documentSnapshot, documentVersion } from '@/lib/document-data';
import { drawnSignatureSchema, signatureDrawing, signatureMethodLabel } from '@/lib/document-signature';
import { SignatureImage, SignaturePad } from './signature-pad';
import type { SchoolRecord } from '@/lib/school-data';
import type { Ctx } from './school-app';

const params = () => typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.hash.split('?')[1]);
const stamp = (value?: string) => value ? new Date(value).toLocaleString('bg-BG', { timeZone: 'Europe/Sofia', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const dueText = (d: any) => !d.due ? 'Без посочен срок' : `${d.status === 'pending' && d.due < schoolToday() ? 'Срокът е изминал · ' : 'До '}${formatDate(d.due)}`;
const openDoc = (c: Ctx, id: string) => c.go(`documents?document=${encodeURIComponent(id)}`);

export function DocumentWorkspace(c: Ctx) {
  const [tab, setTab] = useState('all'), [search, setSearch] = useState(''), [category, setCategory] = useState('all');
  const docs = c.get('document'), selected = docs.find(d => d.id === params().get('document'));
  if (params().has('new') && c.staff) return <>
    <Back c={c}/><PageHeading eyebrow="ДОКУМЕНТООБОРОТ" title="Нов документ" description="Подгответе съдържанието, прегледайте го и запазете чернова."/>
    <DocumentEditor {...c} key="new-document"/>
  </>;
  if (selected) return <DocumentDetail {...c} key={selected.id} item={selected}/>;
  const matching = docs.filter(d => (category === 'all' || d.category === category) && `${d.title} ${d.content}`.toLocaleLowerCase('bg').includes(search.toLocaleLowerCase('bg')));
  const shown = matching.filter(d => tab === 'all' ? true : tab === 'draft' ? d.status === 'draft' || !!d.draft : d.status === tab)
    .sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || (a.status === 'pending' && b.status === 'pending' ? (a.due || '').localeCompare(b.due || '') : (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '')));
  const exportRegister = () => downloadFile('eduo-documents.csv', csvText([
    ['Документ', 'Вид', 'Версия', 'Състояние', 'Срок', 'Получател', 'Потвърдил', 'Потвърдено на', 'Начин', 'SHA-256'],
    ...shown.map(d => [d.title, d.category, documentVersion(d), documentLabels[d.status], d.due || '', 'Родител на Алекс Петров', d.ackName || '', d.ackAt || '', d.ackAt ? signatureMethodLabel(d) : '', d.contentHash || ''])
  ]), 'text/csv;charset=utf-8');
  return <>
    <PageHeading eyebrow={c.staff ? 'УЧИЛИЩНА КАНЦЕЛАРИЯ' : 'УЧИЛИЩЕ И СЕМЕЙСТВО'} title="Документи" description={c.staff ? 'От първата чернова до точната потвърдена версия.' : 'Важната информация за Алекс и вашите потвърждения.'}>
      {c.staff && <Button onClick={() => c.go('documents?new=1')}><Plus size={17}/>Нов документ</Button>}
    </PageHeading>
    <div className="docs-summary">
      {[{ icon: ClipboardCheck, count: docs.filter(d => d.status === 'pending').length, label: 'Очакват преглед', filter: 'pending', color: 'orange' },
        { icon: CheckCheck, count: docs.filter(d => d.status === 'acknowledged').length, label: 'Потвърдени', filter: 'acknowledged', color: 'green' },
        c.staff ? { icon: PenLine, count: docs.filter(d => d.status === 'draft' || d.draft).length, label: 'В подготовка', filter: 'draft', color: 'blue' } : { icon: History, count: docs.length, label: 'Във вашия архив', filter: 'all', color: 'blue' }].map(m =>
          <button key={m.filter} onClick={() => setTab(m.filter)}><span className={`docs-metric-icon ${m.color}`}><m.icon size={23}/></span><span><strong>{m.count}</strong><span>{m.label}</span></span></button>)}
    </div>
    <div className="docs-toolbar"><Tabs value={tab} onValueChange={setTab}><TabsList className="clean-tabs">
      <TabsTrigger value="all">Всички</TabsTrigger><TabsTrigger value="pending">За преглед</TabsTrigger>
      <TabsTrigger value="acknowledged">Потвърдени</TabsTrigger>{c.staff && <TabsTrigger value="draft">Чернови</TabsTrigger>}<TabsTrigger value="withdrawn">Оттеглени</TabsTrigger>
    </TabsList></Tabs><button className="icon-button" aria-label="Обнови документите" onClick={() => c.refresh()}><RefreshCw size={18}/></button></div>
    <div className="docs-filters"><label className="docs-search"><Search size={18}/><input aria-label="Търси документ" placeholder="Търси по заглавие или съдържание…" value={search} onChange={e => setSearch(e.target.value)}/></label>
      <Choice label="Вид документ" value={category} onChange={setCategory} options={[{ value: 'all', label: 'Всички видове' }, ...documentCategories.map(s => ({ value: s, label: s }))]}/>
      {c.staff && <Button variant="light" onClick={exportRegister}><Download size={17}/>Регистър</Button>}
    </div>
    <section className="docs-register"><div className="docs-register-heading"><h2>{tab === 'pending' ? 'Нуждаят се от внимание' : 'Документен регистър'}</h2><span>{shown.length} {shown.length === 1 ? 'документ' : 'документа'}</span></div>
      {shown.map(d => <button key={d.id} className="docs-register-row" onClick={() => openDoc(c, d.id)}>
        <span className={`docs-file-icon ${documentColor(d.status)}`}><FileText size={25}/></span>
        <span className="docs-row-copy"><span>{d.category} · версия {documentVersion(d)}</span><strong>{d.title}</strong><small>{d.status === 'acknowledged' ? `${d.ackName} · ${stamp(d.ackAt)}` : d.status === 'draft' ? 'Само за подготовка' : 'Родител на Алекс Петров · 6. А'}{d.draft ? ' · Нова чернова' : ''}</small></span>
        <span className="docs-row-meta"><Pill color={documentColor(d.status)}>{documentLabels[d.status]}</Pill><span className={d.status === 'pending' && d.due < schoolToday() ? 'docs-overdue' : ''}>{dueText(d)}</span></span>
      </button>)}
      {!shown.length && <Blank icon={FileText} title="Няма документи в този изглед" text={search ? 'Променете търсенето или вида на документа.' : c.staff ? 'Създайте чернова или изберете друг раздел.' : 'Новите заявки от училището ще се появят тук.'}/>}
    </section>
    <div className="docs-security-note"><LockKeyhole size={19}/><p>Рисуван подпис или потвърждение за запознаване — запазени шифровано с точната версия. Електронното подписване чрез доставчик е отделна възможност, която предстои да свържем. Получателите в този модул са примерни.</p></div>
  </>;
}

function Back({ c }: { c: Ctx }) { return <button className="docs-back" onClick={() => c.go('documents')}><Undo2 size={16}/>Всички документи</button>; }
function DocumentDetail(c: Ctx & { item: SchoolRecord }) {
  const d = c.item, [tab, setTab] = useState(d.status === 'draft' ? 'draft' : 'document');
  const [withdrawing, setWithdrawing] = useState(false), [reason, setReason] = useState('');
  const hasDraft = d.status === 'draft' || !!d.draft;
  async function revise() { const result = await c.mutate('revise-document', { id: d.id, revision: documentRevision(d), actor: c.role }); if (result) setTab('draft'); }
  return <>
    <Back c={c}/><PageHeading eyebrow="ДОКУМЕНТООБОРОТ" title={d.title} description={`${d.category} · версия ${documentVersion(d)}`}>
      <button className="icon-button" aria-label="Обнови документа" onClick={() => c.refresh()}><RefreshCw size={18}/></button>
    </PageHeading>
    <div className="docs-detail-tabs"><Tabs value={tab} onValueChange={setTab}><TabsList className="clean-tabs">
      {d.status !== 'draft' && <TabsTrigger value="document">Документ</TabsTrigger>}
      {c.staff && hasDraft && <TabsTrigger value="draft">{d.draft ? `Чернова · версия ${d.draft.version}` : 'Редакция на чернова'}</TabsTrigger>}
      <TabsTrigger value="history">История{d.versions?.length > 0 && <b>{d.versions.length + 1}</b>}</TabsTrigger>
    </TabsList></Tabs><Pill color={documentColor(d.status)}>{documentLabels[d.status]}</Pill></div>
    <div hidden={tab !== 'draft'}>{c.staff && hasDraft && <DocumentEditor {...c} key={`${d.id}-${d.draft?.version || d.version}`} item={d} onPublished={() => setTab('document')}/>}</div>
    <div hidden={tab !== 'history'}><DocumentHistory {...c} item={d}/></div>
    <div hidden={tab !== 'document'}><div className="docs-reading-layout"><DocumentPaper {...c} item={d}/><aside className="docs-action-column">
      {d.status === 'acknowledged' ? <Receipt item={d} id={d.id}/> : d.status === 'withdrawn' ? <section className="docs-action-card"><span className="docs-card-icon gray"><Undo2 size={24}/></span><h2>Заявката е оттеглена</h2><p>{d.withdrawalReason}</p><small>{stamp(d.withdrawnAt)}</small><p className="docs-secondary">Тази версия не очаква потвърждение. Предишните записи остават в историята.</p></section> : c.role === 'parent' ? <Acknowledgment {...c} key={`${d.id}-${d.version}-${d.contentHash || 'legacy'}`} item={d}/> : <section className="docs-action-card"><span className="docs-card-icon orange"><Clock size={25}/></span><h2>Очаква родителски преглед</h2><p>Родител на Алекс Петров · 6. А</p><span className="docs-deadline">{dueText(d)}</span><p className="docs-secondary">Потвърждението и разписката ще се покажат тук.</p></section>}
      {c.staff && <section className="docs-staff-actions"><h3>Управление на документа</h3>{d.draft ? <><p>Версия {d.draft.version} се подготвя. Родителят продължава да вижда версия {documentVersion(d)}.</p><Button variant="light" onClick={() => setTab('draft')}><PenLine size={17}/>Продължи черновата</Button></> : <Button variant="light" disabled={c.busy} onClick={revise}><PenLine size={17}/>Подготви нова версия</Button>}
        {d.status === 'pending' && !withdrawing && <button className="docs-withdraw-link" onClick={() => setWithdrawing(true)}>Оттегли заявката</button>}
        {d.status === 'pending' && withdrawing && <form className="docs-withdraw-form" onSubmit={async e => { e.preventDefault(); const r = await c.mutate('withdraw-document', { id: d.id, revision: documentRevision(d), reason, actor: c.role }); if (r) { setWithdrawing(false); setReason(''); } }}><label>Причина за оттегляне<textarea aria-label="Причина за оттегляне" rows={3} minLength={5} maxLength={1500} value={reason} onChange={e => setReason(e.target.value)}/></label><p>Родителят ще вижда причината. Потвърждаването на тази версия ще бъде затворено.</p><div><Button variant="light" onClick={() => setWithdrawing(false)}>Отказ</Button><Button type="submit" disabled={c.busy || reason.trim().length < 5}>Оттегли</Button></div></form>}
      </section>}
      <CopyButton item={d} id={d.id}/><div className="docs-mini-note"><ShieldCheck size={17}/><span>Частна демонстрация с примерен родител. Рисуваният подпис се пази с точната версия на документа.</span></div>
    </aside></div></div>
  </>;
}

const templates = [
  { label: 'Информация', category: 'Информация', title: 'Информация за родителска среща', content: 'Уважаеми родители,\n\nКаним ви на родителска среща на [дата] от [час] в [място].\n\nЩе обсъдим:\n• [тема]\n• [тема]\n\nМоля, запознайте се с информацията. За въпроси се свържете с класния ръководител.' },
  { label: 'Учебно посещение', category: 'Родителско съгласие', title: 'Информация за учебно посещение', content: 'Уважаеми родители,\n\nПодготвяме учебно посещение на [място] на [дата].\nСборен пункт: [място и час].\nВръщане: [час].\nПридружаващи учители: [имена].\nНеобходимо за ученика: [подготовка].\n\nТози образец служи за запознаване с организацията в пилотната среда. Не замества изисквано удостоверено съгласие.' }
];
function DocumentEditor(c: Ctx & { item?: SchoolRecord; onPublished?: () => void }) {
  const d = c.item, source = d?.draft || d;
  const [title, setTitle] = useState(source?.title || ''), [content, setContent] = useState(source?.content || ''), [category, setCategory] = useState(source?.category || 'Информация'), [due, setDue] = useState(source?.due || plusDays(schoolToday(), 7));
  const [files, setFiles] = useState<SchoolRecord[]>((source?.files || []).map((id: string) => c.records.find(r => r.id === id)).filter(Boolean));
  const [revision, setRevision] = useState(d ? documentRevision(d) : 0), [requestId] = useState(() => requestUUID()), [uploading, setUploading] = useState(false), [preview, setPreview] = useState(false), [discarding, setDiscarding] = useState(false);
  const draftVersion = source?.version || 1;
  const valid = title.trim().length >= 3 && content.trim().length > 0 && !!due;
  const values = { title: title.trim(), content: content.trim(), category, due, files: files.map(f => f.id) };
  const dirty = !source || ['title', 'content', 'category', 'due'].some(k => values[k as keyof typeof values] !== source[k]) || JSON.stringify(values.files) !== JSON.stringify(source.files || []);
  async function save(e: React.FormEvent) { e.preventDefault(); const result = await c.mutate(d ? 'save-document-draft' : 'document', { ...values, ...(d ? { id: d.id, revision } : { requestId }), actor: c.role }); if (result) { setRevision(documentRevision(result)); if (!d) openDoc(c, result.id); } }
  return <div className="docs-editor-layout"><div>
    <div className="docs-editor-switch"><button type="button" className={!preview ? 'selected' : ''} onClick={() => setPreview(false)}><PenLine size={16}/>Редакция</button><button type="button" className={preview ? 'selected' : ''} onClick={() => setPreview(true)}><FileText size={16}/>Преглед</button><span>{dirty ? 'Незапазени промени' : 'Черновата е запазена'}</span></div>
    <div hidden={!preview}><DocumentPaper {...c} item={{ id: d?.id || 'draft', kind: 'document', ...values, version: draftVersion, status: 'draft' }} draft/></div>
    <div hidden={preview}><form className="docs-editor" onSubmit={save}>
      {!d && !title && !content && <div className="docs-templates"><span>Започнете с образец</span>{templates.map(t => <button type="button" key={t.label} onClick={() => { setTitle(t.title); setContent(t.content); setCategory(t.category); }}><FileText size={17}/>{t.label}</button>)}</div>}
      <label>Заглавие<input required minLength={3} maxLength={200} value={title} onChange={e => setTitle(e.target.value)} placeholder="Кратко и ясно заглавие"/></label>
      <div className="docs-form-pair"><label>Вид документ<Choice label="Вид на документа" value={category} onChange={setCategory} options={documentCategories.map(s => ({ value: s, label: s }))}/></label><label>Срок за преглед<input type="date" required aria-label="Срок за преглед" value={due} onChange={e => setDue(e.target.value)}/></label></div>
      <label>Съдържание<textarea required rows={13} maxLength={20000} value={content} onChange={e => setContent(e.target.value)} placeholder="Опишете какво трябва да знае родителят…"/></label><span className="docs-character-count">{content.length.toLocaleString('bg-BG')} / 20 000</span>
      <div className="docs-attachment-heading"><h3>Приложения</h3><span>По избор</span></div><FilePicker {...c} files={files} setFiles={setFiles} onUploading={setUploading}/>
      <div className="docs-editor-save"><p>Запазването на чернова не създава заявка за родителя.</p><Button type="submit" disabled={c.busy || uploading || !valid || !dirty}><Check size={17}/>Запази чернова</Button></div>
    </form></div>
    {preview && <div className="docs-preview-save"><Button variant="light" onClick={() => setPreview(false)}><PenLine size={17}/>Към редакцията</Button></div>}
  </div><aside className="docs-action-column"><section className="docs-action-card docs-publish-card"><span className="docs-card-icon blue"><MailCheck size={25}/></span><h2>Готов за родителски преглед?</h2><p>Версия {draftVersion} ще се появи в документите на родителя на Алекс.</p><div className="docs-recipient"><Users size={20}/><span><strong>Елена Петрова</strong><small>Родител на Алекс · 6. А · демо</small></span></div>
    <ol className="docs-publish-steps"><li>Попълнете текста и приложенията.</li><li>Прегледайте и запазете черновата.</li><li>Предоставете точната запазена версия.</li></ol>
    <Button disabled={!d || dirty || uploading || c.busy || !valid} onClick={async () => { const r = await c.mutate('publish-document', { id: d!.id, revision, actor: c.role }); if (r) c.onPublished?.(); }}><MailCheck size={17}/>Предостави за преглед</Button>
    <p className="docs-secondary">{dirty ? 'Първо запазете промените.' : 'След предоставяне съдържанието се променя само чрез нова версия.'} Заявката остава в тази среда; не изпраща имейл.</p>
    {d?.draft && <div className="docs-discard">{discarding ? <><p>Да отменим ли новата чернова? Предоставената версия и разписката остават.</p><Button variant="light" disabled={c.busy} onClick={async () => { const r = await c.mutate('discard-document-draft', { id: d.id, revision, actor: c.role }); if (r) c.onPublished?.(); }}>Отмени черновата</Button><button className="text-button" onClick={() => setDiscarding(false)}>Продължи редакцията</button></> : <button className="docs-withdraw-link" onClick={() => setDiscarding(true)}>Откажи новата чернова</button>}</div>}
    </section><div className="docs-mini-note"><LockKeyhole size={17}/><span>Документът и приложенията се съхраняват шифровано.</span></div></aside></div>;
}

function DocumentPaper(c: Ctx & { item: any; draft?: boolean }) {
  const d = c.item;
  return <article className="docs-paper"><div className="docs-letterhead"><span>eduo<span>.</span></span><div>Демо училище<small>Училище и семейство · 6. А</small></div></div>
    <div className="docs-paper-meta"><span>{d.category}</span><Pill color={c.draft ? 'gray' : documentColor(d.status)}>{c.draft ? 'Непубликувана чернова' : `Версия ${d.version || 1}`}</Pill></div>
    <h2>{d.title || 'Заглавие на документа'}</h2><p className="docs-paper-recipient">До родителя на Алекс Петров</p><div className="docs-paper-body">{d.content || 'Съдържанието ще се появи тук.'}</div>
    {(d.files || []).length > 0 && <div className="docs-paper-attachments"><h3>Приложения към тази версия</h3>{d.files.map((id: string) => { const f = d.attachments?.find((a: any) => a.id === id) || c.records.find(r => r.id === id); return <a key={id} href={`/api/files/${id}`}><FileText size={21}/><span><strong>{f?.name || 'Прикачен файл'}</strong><small>{f?.size ? `${(f.size / 1024).toFixed(0)} KB · ` : ''}Изтегляне</small></span><Download size={17}/></a>; })}</div>}
    <footer><span>{d.due ? `Срок за преглед: ${formatDate(d.due)}` : 'Чернова'}</span><span>Примерен училищен документ</span></footer>
  </article>;
}
function Acknowledgment(c: Ctx & { item: SchoolRecord }) {
  const d = c.item, [name, setName] = useState(''), [accepted, setAccepted] = useState(false);
  const [method, setMethod] = useState<'drawn-signature' | 'acknowledgment'>('drawn-signature');
  const [signature, setSignature] = useState(() => signatureDrawing([])), [drawing, setDrawing] = useState(false);
  const hasSignature = drawnSignatureSchema.safeParse(signature).success;
  const valid = !c.busy && !drawing && c.writable && d.status === 'pending' && accepted && name.trim().length >= 3 && (method !== 'drawn-signature' || hasSignature);
  useEffect(() => {
    if (!name && !signature.strokes.length) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [name, signature.strokes.length]);
  return <form className="docs-action-card docs-ack-form" onSubmit={async e => { e.preventDefault(); if (!valid) return; await c.mutate('acknowledge', { id: d.id, version: documentVersion(d), contentHash: d.contentHash, name, accepted, method, ...(method === 'drawn-signature' ? { signature } : {}) }); }}>
    <span className="docs-card-icon blue"><PenLine size={26}/></span><h2>Вашият подпис</h2><p>Прегледайте документа и приложенията към версия {documentVersion(d)}.</p><span className="docs-deadline">{dueText(d)}</span>
    <fieldset className="document-signing-methods" disabled={c.busy || drawing}><legend>Начин на потвърждение</legend>
      <label className={`document-signing-option${method === 'drawn-signature' ? ' selected' : ''}`}><input type="radio" name={`signing-${d.id}`} value="drawn-signature" checked={method === 'drawn-signature'} onChange={() => { setMethod('drawn-signature'); setAccepted(false); }}/><span><strong>Рисуван подпис</strong><small>Подпишете директно на екрана.</small></span><PenLine size={18}/></label>
      <label className="document-signing-option unavailable"><input type="radio" name={`signing-${d.id}`} value="provider-signature" disabled/><span><strong>Електронен подпис чрез доставчик</strong><small>Предстои свързване на доставчик.</small></span><ShieldCheck size={18}/></label>
      <label className={`document-signing-option${method === 'acknowledgment' ? ' selected' : ''}`}><input type="radio" name={`signing-${d.id}`} value="acknowledgment" checked={method === 'acknowledgment'} onChange={() => { setMethod('acknowledgment'); setAccepted(false); }}/><span><strong>Само запознаване</strong><small>Потвърдете прочитането без рисуване.</small></span><ClipboardCheck size={18}/></label>
    </fieldset>
    <label>Име на родителя<input disabled={c.busy || drawing} autoComplete="name" required minLength={3} maxLength={100} value={name} onChange={e => { setName(e.target.value); setAccepted(false); }} placeholder="Име и фамилия"/></label>
    {method === 'drawn-signature' && <SignaturePad value={signature} disabled={c.busy} onDrawingChange={setDrawing} onChange={next => { setSignature(next); setAccepted(false); }}/>}
    <label className="check-label"><Checkbox disabled={c.busy || drawing} checked={accepted} onCheckedChange={v => setAccepted(v === true)}/>{method === 'drawn-signature' ? `Прочетох версия ${documentVersion(d)} и потвърждавам полагането на показания подпис върху нея.` : 'Прочетох тази версия и потвърждавам запознаването си с нея.'}</label>
    <Button type="submit" disabled={!valid}><CheckCheck size={18}/>{c.busy ? 'Запазваме…' : method === 'drawn-signature' ? 'Подпиши и изпрати' : 'Потвърди запознаването'}</Button>
    {!c.writable && <p className="docs-secondary">Примерен преглед. За запазване е необходим вход в частната среда.</p>}
    <p className="docs-secondary"><LockKeyhole size={14}/> Защитена връзка и шифровано съхранение. Запазваме името, часа, точната версия{method === 'drawn-signature' ? ' и нарисувания подпис' : ''}. Действието остава в тази демонстрация.</p>
  </form>;
}
function CopyButton({ id, item }: { id: string; item: any }) { return <div className="docs-copy-actions"><Button variant="light" onClick={() => downloadFile(`eduo-document-v${item.version || 1}.html`, documentReceiptHtml(id, item), 'text/html;charset=utf-8')}><Download size={17}/>{item.drawnSignature ? 'Копие с подпис и разписка' : item.ackAt ? 'Копие с разписка' : 'Изтегли копие'}</Button>{item.drawnSignature && <button type="button" className="docs-text-copy" onClick={() => downloadFile(`eduo-receipt-v${item.version || 1}.txt`, documentReceiptText(id, item))}>Разписка като текст</button>}</div>; }
function Receipt({ item: d, id }: { item: any; id: string }) {
  return <section className="docs-action-card docs-receipt"><span className="docs-card-icon green"><CheckCheck size={26}/></span><h2>{d.ackMethod === 'drawn-signature' ? 'Подписът е запазен' : 'Запознаването е потвърдено'}</h2>{d.drawnSignature && <SignatureImage drawing={d.drawnSignature.drawing}/>}<dl><div><dt>Родител</dt><dd>{d.ackName}</dd></div><div><dt>Начин</dt><dd>{signatureMethodLabel(d)}</dd></div><div><dt>Версия</dt><dd>{d.version || 1}</dd></div><div><dt>Час на потвърждение</dt><dd>{stamp(d.ackAt)}</dd></div></dl>
    <details><summary>Данни за разписката</summary>{d.receipt?.id && <p>Номер: {d.receipt.id}</p>}<p>{d.contentHash ? `SHA-256 на документа: ${d.contentHash}` : 'Примерен запис от началните данни — няма изчислен отпечатък.'}</p>{d.drawnSignature?.sha256 && <p>SHA-256 на подписа: {d.drawnSignature.sha256}</p>}{d.receipt?.evidenceHash && <p>SHA-256 на разписката: {d.receipt.evidenceHash}</p>}<p>{d.hashFormat === 'eduo-document-v1' ? 'Отпечатъкът включва съдържанието, данните на версията и отпечатъците на приложенията.' : d.contentHash ? 'По-ранен формат: отпечатък само на текста.' : 'Публикуваните чрез новия процес документи получават отпечатък на цялата версия.'}</p></details>
    <p className="docs-secondary">Потвърдена е конкретната версия. Бъдеща промяна изисква нов преглед.</p>
  </section>;
}
const eventLabels: Record<string, string> = { document: 'Създадена чернова', 'save-document-draft': 'Запазена чернова', 'revise-document': 'Започната нова версия', 'publish-document': 'Предоставен за преглед', acknowledge: 'Потвърдено запознаване', 'withdraw-document': 'Заявката е оттеглена', 'discard-document-draft': 'Новата чернова е отменена' };
function DocumentHistory(c: Ctx & { item: SchoolRecord }) {
  const d = c.item, versions = [...(d.versions || []), ...(d.status === 'draft' ? [] : [documentSnapshot(d)])].reverse();
  return <div className="docs-history-layout"><section className="docs-version-list"><div className="docs-section-title"><History size={21}/><div><h2>Запазени версии</h2><p>Точното съдържание и потвърждение за всяка предоставена версия.</p></div></div>
    {versions.map((v, i) => <details className="docs-version" key={v.version} open={i === 0}><summary><span className="docs-version-number">{v.version}</span><span><strong>Версия {v.version}{i === 0 ? ' · текуща' : ''}</strong><small>{v.title}</small></span><Pill color={documentColor(v.status)}>{documentLabels[v.status]}</Pill></summary><div className="docs-version-content"><p className="docs-history-content">{v.content}</p>{v.files?.length > 0 && <div className="docs-history-files">{v.files.map((id: string) => <a key={id} href={`/api/files/${id}`}><FileText size={16}/>{v.attachments?.find((a: any) => a.id === id)?.name || c.records.find(r => r.id === id)?.name || 'Прикачен файл'}<Download size={15}/></a>)}</div>}<p className="docs-secondary">{dueText(v)}{v.publishedAt ? ` · Предоставен ${stamp(v.publishedAt)}` : ''}</p>{v.ackAt && <Receipt item={v} id={d.id}/>} {v.withdrawalReason && <p className="docs-history-withdrawal">Оттеглен: {v.withdrawalReason}</p>}<CopyButton item={v} id={d.id}/></div></details>)}
    {!versions.length && <Blank icon={History} title="Историята започва с предоставянето" text="Документът още е чернова. След предоставяне тук ще се пази точната версия."/>}
  </section><aside className="docs-timeline"><h2>Движение на документа</h2>{d.events?.length ? d.events.slice().reverse().map((e: any, i: number) => <div className="docs-timeline-event" key={i}><span><Check size={13}/></span><div><strong>{eventLabels[e.type] || 'Обновен документ'}</strong><p>{e.by} · версия {e.version}</p>{e.note && <p>{e.note}</p>}<small>{stamp(e.at)}</small></div></div>) : <p className="docs-secondary">По-ранен примерен запис. Новите действия ще се показват тук.</p>}</aside></div>;
}
