"use client";
import { apiJson, apiContracts } from '@/lib/api-client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, CheckCheck, Circle, CalendarCheck, GraduationCap, FileCheck2, Inbox, LoaderCircle, LockKeyhole, MessageSquare, RefreshCw, Search, Send, ShieldCheck, Sparkles } from 'lucide-react';
import { schoolToday, plusDays } from '@/lib/platform-data';
import { toast } from 'sonner';
import { Button, Choice, PageHeading, Pill, Blank } from './eduo-ui';
import { schoolRoleLabels, type SchoolRole } from '@/lib/school-directory-data';
import { inboxKindLabels, inboxHomeworkDestination, type ClassworkInboxHome, type ClassworkNotice, type InboxKind } from '@/lib/classwork-inbox-data';

const icons = { assignment: BookOpen, update: RefreshCw, submission: Send, feedback: MessageSquare, revision: FileCheck2, state: Inbox, grade: GraduationCap, attendance: CalendarCheck, explanation: MessageSquare, announcement: MessageSquare, document: FileCheck2 };
const day = (s: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Sofia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(s));
const dayLabel = (s: string) => day(s) === schoolToday() ? 'Днес' : day(s) === plusDays(schoolToday(), -1) ? 'Вчера' : new Date(s).toLocaleDateString('bg-BG', { timeZone: 'Europe/Sofia', day: 'numeric', month: 'long', year: 'numeric' });
const time = (s: string) => new Date(s).toLocaleTimeString('bg-BG', { timeZone: 'Europe/Sofia', hour: '2-digit', minute: '2-digit' });
const descriptions = {
  student: 'Оценки, присъствия, задачи и насоки от учителя — на едно място.',
  teacher: 'Промени в дневника, предавания и обяснения, които очакват твоя преглед.',
  parent: 'Оценки, присъствия, обяснения и домашни само за свързаните с твоя акаунт деца.',
  admin: 'Работата с класовете, дневникът и разрешените обяснения в училищната среда.',
};

export function ClassworkInboxWorkspace({ go, onUnread }: { go: (destination: string) => void; onUnread?: (count: number) => void }) {
  const [home, setHome] = useState<ClassworkInboxHome | null>(null), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [previewRole, setPreviewRole] = useState<SchoolRole>('teacher'), [query, setQuery] = useState(''), [filter, setFilter] = useState('all'), [kind, setKind] = useState('all'), [classId, setClassId] = useState('all'), [pupilId, setPupilId] = useState('all');
  const generation = useRef(0);
  useEffect(() => { if (home) onUnread?.(home.unreadCount); }, [home, onUnread]);
  async function load(school?: string, role = previewRole) {
    const token = ++generation.current; setLoading(true); setError('');
    try {
      const q = new URLSearchParams({ preview: role }); if (school) q.set('school', school);
      const d = await apiJson<ClassworkInboxHome>('/api/classwork/inbox?' + q, {}, apiContracts.inbox);
      if (token === generation.current) setHome(d);
    } catch (e) { if (token === generation.current) setError(e instanceof Error ? e.message : 'Не успяхме да заредим входящите.'); }
    finally { if (token === generation.current) setLoading(false); }
  }
  useEffect(() => { const q = new URLSearchParams(window.location.hash.split('?')[1]), requested = q.get('preview'), role = requested && Object.hasOwn(schoolRoleLabels, requested) ? requested as SchoolRole : previewRole; setPreviewRole(role); load(q.get('school') || undefined, role); return () => { generation.current++; }; }, []);
  const ctx = home?.context, self = ctx?.self;
  async function mark(ids: string[], read: boolean) {
    if (!home?.writable || !ctx || !ids.length || busy || loading) return;
    const token = generation.current; setBusy(true); setError('');
    try {
      const d = await apiJson<ClassworkInboxHome>('/api/classwork/inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schoolId: ctx.school.id, directoryRevision: ctx.school.revision, ids, read }) }, apiContracts.inbox);
      if (token === generation.current) setHome(d);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Отметката не е запазена. Опитай отново.';
      if (token === generation.current) setError(message); toast.error(message);
    } finally { if (token === generation.current) setBusy(false); }
  }
  async function open(n: ClassworkNotice) {
    if (!ctx || busy || loading) return;
    if (n.unread && home?.writable) await mark([n.id], true);
    go(inboxHomeworkDestination(ctx.school.id, n) + (home?.preview ? '&preview=' + previewRole : ''));
  }
  function school(s: string) {
    setClassId('all'); setPupilId('all'); setQuery('');
    window.history.pushState(null, '', '#school-inbox?school=' + encodeURIComponent(s)); load(s);
  }
  if (!home) return <div className="directory-loading">{loading ? <><LoaderCircle className="spin"/><p>Зареждаме училищните входящи…</p></> : <><Inbox/><h2>Входящите не са достъпни</h2><p role="alert">{error}</p><Button onClick={() => load()}>Опитай отново</Button></>}</div>;
  const active = self?.status === 'active', role = self?.role || 'teacher';
  const list = home.notices.filter(n => (filter === 'all' || filter === 'unread' && n.unread || filter === 'read' && !n.unread || filter === 'action' && n.needsAction) && (kind === 'all' || n.kind === kind) && (classId === 'all' || n.classId === classId) && (pupilId === 'all' || n.pupilId === pupilId || !n.pupilId && ctx?.pupils.some(p => p.id === pupilId && p.classId === n.classId)) && [n.title, n.assignmentTitle, n.subject, n.className, n.pupilName || ''].join(' ').toLocaleLowerCase('bg').includes(query.trim().toLocaleLowerCase('bg')));
  const unreadIds = list.filter(n => n.unread).map(n => n.id);
  const classes = Array.from(new Map(home.notices.map(n => [n.classId, n.className])).entries());
  const pupils = (ctx?.pupils || []).filter(p => home.notices.some(n => n.pupilId === p.id));
  return <div className="classwork-workspace school-inbox-workspace" aria-busy={loading || busy}>
    <PageHeading eyebrow="РАБОТА С КЛАСА" title="Училищни входящи" description={active ? descriptions[role] : 'Запазени учебни промени за одобрените училищни акаунти.'}>
      {home.schools.length > 1 && <Choice label="Училище за входящите" value={ctx?.school.id || ''} disabled={busy || loading} onChange={school} options={home.schools.map(s => ({ value: s.id, label: s.name }))}/>}
      <Button variant="light" disabled={busy || loading} onClick={() => load(ctx?.school.id)}><RefreshCw size={17} className={loading ? 'spin' : ''}/>Обнови</Button>
      <Button disabled={busy || loading} variant="light" onClick={() => go('classwork' + (ctx ? '?school=' + encodeURIComponent(ctx.school.id) + (home.preview ? '&preview=' + previewRole : '') : ''))}><BookOpen size={17}/>Домашни</Button>
    </PageHeading>
    <div className="classwork-account"><ShieldCheck size={18}/><span>{self ? `${self.name} · ${schoolRoleLabels[self.role]} · ${ctx?.school.name}` : 'Необходим е одобрен училищен акаунт'}</span><Button variant="light" onClick={() => go('school')}>Училищна среда</Button></div>
    {home.preview && <div className="classwork-preview"><p>Измислени данни · отметките в този преглед не се записват.</p><Choice label="Примерен училищен профил" disabled={busy || loading} value={previewRole} onChange={v => { setPreviewRole(v as SchoolRole); setPupilId('all'); setClassId('all'); load(ctx?.school.id, v as SchoolRole); }} options={Object.entries(schoolRoleLabels).map(([value, label]) => ({ value, label }))}/></div>}
    {error && <p className="directory-error" role="alert">{error}</p>}
    {!ctx || !active ? <section className="panel classwork-access"><LockKeyhole size={30}/><h2>{ctx?.status === 'suspended' ? 'Училищният достъп е спрян' : 'Свържи акаунта с училището си'}</h2><p>След одобрение на ролята и връзката с клас или ученик тук ще се показва достъпната за твоя акаунт работа.</p><Button onClick={() => go('school')}>Отвори училищната среда</Button></section> : <>
      <div className="school-inbox-summary">
        <div className="school-inbox-intro"><span className="school-inbox-intro-icon"><Inbox size={27}/></span><div><span>ТВОЯТ УЧИЛИЩЕН ПРЕГЛЕД</span><h2>{!home.notices.length ? 'Тук ще се появи училищната активност' : home.unreadCount ? 'Има нови записи за преглед' : 'Всичко в този преглед е прочетено'}</h2><p>Прегледай промените в оценките, присъствията и учебната работа.</p></div></div>
        <div className="school-inbox-metrics"><button onClick={() => setFilter('unread')} aria-pressed={filter === 'unread'}><strong>{home.unreadCount}</strong><span>непрочетени</span></button><button onClick={() => setFilter('action')} aria-pressed={filter === 'action'}><strong>{home.actionCount}</strong><span>за твое действие</span></button></div>
      </div>
      <div className="school-inbox-layout">
        <section className="school-inbox-main" aria-label="Училищна активност">
          <div className="school-inbox-toolbar">
            <div className="classwork-filter-buttons" role="group" aria-label="Преглед на входящите">{[{ id: 'all', label: 'Всички' }, { id: 'unread', label: 'Непрочетени' }, { id: 'action', label: 'За действие' }, { id: 'read', label: 'Прочетени' }].map(f => <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>)}</div>
            <Button variant="light" disabled={!home.writable || loading || busy || !unreadIds.length} onClick={() => mark(unreadIds, true)}><CheckCheck size={17}/>{busy ? 'Запазваме…' : 'Маркирай като прочетени'}</Button>
          </div>
          <div className="school-inbox-filters">
            <label className="inline-search"><Search size={17}/><input aria-label="Търси във входящите" value={query} onChange={e => setQuery(e.target.value)} placeholder="Оценка, присъствие, задача или ученик…"/></label>
            <Choice label="Вид училищна активност" value={kind} onChange={setKind} options={[{ value: 'all', label: 'Всички видове' }, ...Object.entries(inboxKindLabels).map(([value, label]) => ({ value, label }))]}/>
            {classes.length > 1 && <Choice label="Клас за входящите" value={classId} onChange={setClassId} options={[{ value: 'all', label: 'Всички класове' }, ...classes.map(([value, label]) => ({ value, label }))]}/>}
            {pupils.length > 1 && <Choice label={role === 'parent' ? 'Дете за входящите' : 'Ученик за входящите'} value={pupilId} onChange={setPupilId} options={[{ value: 'all', label: role === 'parent' ? 'Всички свързани деца' : 'Всички ученици' }, ...pupils.map(p => ({ value: p.id, label: p.name }))]}/>}
          </div>
          <div className="school-inbox-list-meta" role="status"><span>{loading ? 'Обновяваме входящите…' : `${list.length} записа в този изглед`}</span><span>Часове · България</span></div>
          <div className="school-inbox-feed">{list.map((n, i) => <div key={n.id}>{(i === 0 || day(list[i - 1].at) !== day(n.at)) && <h3 className="school-inbox-day">{dayLabel(n.at)}</h3>}<NoticeCard notice={n} disabled={loading || busy} writable={home.writable} open={() => open(n)} mark={() => mark([n.id], n.unread)}/></div>)}</div>
          {!list.length && <Blank icon={filter === 'unread' ? CheckCheck : Inbox} title={home.notices.length ? 'Няма записи с тези филтри' : 'Работата за класа започва тук'} text={home.notices.length ? 'Промени филтрите или разгледай всички записи.' : 'Оценките, значимите промени в присъствията, домашните и обратната връзка ще се появят тук.'}>{home.notices.length > 0 && <Button variant="light" onClick={() => { setFilter('all'); setKind('all'); setClassId('all'); setPupilId('all'); setQuery(''); }}>Изчисти филтрите</Button>}</Blank>}
          {home.truncated && <p className="school-inbox-window">Показани са последните {home.window} достъпни записа. По-ранната история остава в съответния дневник, час или домашно.</p>}
        </section>
        <aside className="school-inbox-guide"><div className="school-inbox-guide-top"><Sparkles size={22}/><span>ЯСНА СЛЕДВАЩА СТЪПКА</span></div><h2>Всяка промяна има своето място.</h2><p>{role === 'parent' ? 'Отвори запис за оценката, присъствието или работата на детето. Върнатите обяснения могат да получат ново уточнение от родител.' : role === 'student' ? 'Отвори точния дневник, час или задача. Предаването и поправката на работа остават изрични действия.' : 'Отвори конкретния запис за преглед. Права за корекция, обратна връзка или решение се проверяват от съответния модул.'}</p><div className="school-inbox-guide-note"><Circle size={13}/><p><strong>Непрочетено</strong> е твоя лична отметка.</p></div><div className="school-inbox-guide-note"><FileCheck2 size={16}/><p><strong>За действие</strong> следва текущото състояние на работата.</p></div><div className="school-inbox-guide-bottom"><ShieldCheck size={17}/><p>Достъпът следва одобрената училищна роля и връзките с класове и ученици.</p></div></aside>
      </div>
    </>}
    <p className="classwork-footer">Входящите показват запазената активност в платформата. Отметката „прочетено“ е лична и не потвърждава изпълнение или получаване от друг човек. За новите промени използвай „Обнови“.</p>
  </div>;
}

function NoticeCard({ notice: n, disabled, writable, open, mark }: { notice: ClassworkNotice; disabled: boolean; writable: boolean; open: () => void; mark: () => void }) {
  const Icon = icons[n.kind as InboxKind];
  return <article className={'school-inbox-card kind-' + n.kind + (n.unread ? ' is-unread' : '')}>
    <span className="school-inbox-card-icon"><Icon size={21}/></span>
    <div className="school-inbox-card-body"><div className="school-inbox-card-meta"><span>{inboxKindLabels[n.kind]}</span><time dateTime={n.at}>{time(n.at)}</time>{n.unread && <span className="school-inbox-unread"><i/>Непрочетено</span>}</div><h4>{n.title}</h4><p className="school-inbox-task">{n.assignmentTitle}</p><p className="school-inbox-card-description">{n.summary}</p><div className="school-inbox-card-context"><span>{n.subject}</span><span>{n.className}</span>{n.pupilName && <span>{n.pupilName}</span>}{n.needsAction && <Pill color="orange">За твое действие</Pill>}</div><div className="school-inbox-card-actions"><button className="school-inbox-open" disabled={disabled} onClick={open} aria-label={`${n.title} · ${n.assignmentTitle}${n.pupilName ? ' · ' + n.pupilName : ''} — отвори записа`}>Отвори {n.gradeId ? 'оценката' : n.documentId ? 'документа' : n.attendanceId ? 'часа' : n.pupilId ? 'работата' : 'домашното'}<ArrowRight size={16}/></button><button className="school-inbox-read" disabled={disabled || !writable} onClick={mark} aria-label={`${n.unread ? 'Маркирай като прочетено' : 'Маркирай като непрочетено'} · ${n.assignmentTitle}`}><CheckCheck size={16}/>{n.unread ? 'Прочетено' : 'Непрочетено'}</button></div></div>
  </article>;
}
