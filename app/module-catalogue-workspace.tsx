"use client";
import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Boxes, Check, CheckCircle2, ChevronRight, Compass, Download, FileText, GraduationCap, Layers3, MessageSquare, Search, ShieldCheck, SlidersHorizontal, Users, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { csvText, downloadFile } from '@/lib/platform-data';
import { roles } from '@/lib/school-data';
import { defaultModuleFilters, filteredModules, moduleCategories, modulePhaseLabels, moduleStates, schoolModules, type ModuleCategory, type ModuleFilters, type SchoolModule } from '@/lib/module-catalogue';
import { Blank, Button, Choice, PageHeading } from './eduo-ui';

const icons = { learning: GraduationCap, community: MessageSquare, operations: Boxes, records: FileText, staff: Users, access: ShieldCheck };
function StateLabel({ item }: { item: SchoolModule }) {
  return <span className={`module-state ${item.state}`}><i/>{moduleStates[item.state].label}</span>;
}
function routeFilters(): ModuleFilters {
  const q = new URLSearchParams(window.location.hash.split('?')[1]);
  return {
    query: (q.get('q') || '').slice(0, 200),
    category: q.get('category') && Object.hasOwn(moduleCategories, q.get('category')!) ? q.get('category')! : 'all',
    state: q.get('state') && Object.hasOwn(moduleStates, q.get('state')!) ? q.get('state')! : 'all',
    role: q.get('for') && Object.hasOwn(roles, q.get('for')!) ? q.get('for')! : 'all',
  };
}

export function ModuleCatalogueWorkspace({ go, available }: { go: (destination: string) => void; available: string[] }) {
  const [filters, setFilters] = useState<ModuleFilters>(defaultModuleFilters);
  const [selected, setSelected] = useState<SchoolModule | null>(null);
  useEffect(() => {
    setFilters(routeFilters());
    const id = new URLSearchParams(window.location.hash.split('?')[1]).get('module');
    setSelected(schoolModules.find(m => m.id === id) || null);
  }, []);
  function address(next: ModuleFilters, item: SchoolModule | null) {
    const q = new URLSearchParams();
    if (next.query) q.set('q', next.query);
    if (next.category !== 'all') q.set('category', next.category);
    if (next.state !== 'all') q.set('state', next.state);
    if (next.role !== 'all') q.set('for', next.role);
    if (item) q.set('module', item.id);
    window.history.replaceState(null, '', '#modules' + (q.size ? '?' + q : ''));
  }
  function change(next: Partial<ModuleFilters>) { const value = { ...filters, ...next }; setFilters(value); address(value, selected); }
  function inspect(item: SchoolModule | null) { setSelected(item); address(filters, item); }
  const visible = filteredModules(filters);
  const count = (state: string) => schoolModules.filter(m => m.state === state).length;
  const exportView = () => downloadFile('eduo-module-catalogue.csv', csvText([
    ['Модул', 'Област', 'Статус', 'Роли', 'Етап', 'Налично', 'Оставащ обхват'],
    ...visible.map(m => [m.title, moduleCategories[m.category], moduleStates[m.state].label, m.roles.map(r => roles[r].label).join('; '), modulePhaseLabels[m.phase], m.current, m.remaining.join(' · ')]),
  ]), 'text/csv;charset=utf-8');
  return <div className="module-catalogue-workspace">
    <PageHeading eyebrow="ЕДНА ПЛАТФОРМА · ЦЯЛОТО УЧИЛИЩЕ" title="Модули на Eduo" description="Намери точния раздел и виж какво вече можеш да използваш.">
      <Button variant="light" disabled={!visible.length} onClick={exportView}><Download size={17}/>Изтегли каталога</Button>
    </PageHeading>
    <section className="module-hero">
      <div className="module-hero-copy"><span className="module-hero-label"><Compass size={16}/>ТВОЯТ УЧИЛИЩЕН КОМПАС</span><h2>От първия урок<br/>до последния документ.</h2><p>Обучение, организация и общност в свързана среда. Всеки модул има ясен обхват и собствен работен процес.</p><div className="module-hero-actions"><Button onClick={() => go('school-announcements')}><CheckCircle2 size={17}/>Ново: училищни съобщения<ArrowRight size={17}/></Button><Button variant="light" onClick={() => go('school')}>Училищен акаунт<ChevronRight size={17}/></Button></div></div>
      <div className="module-hero-map" aria-hidden="true"><div className="module-map-core"><BookOpen size={27}/><strong>eduo.</strong><span>училищна среда</span></div><div className="module-map-orbit"><span><GraduationCap size={21}/>Учене</span><span><Users size={21}/>Общност</span><span><Boxes size={21}/>Организация</span><span><FileText size={21}/>Документи</span></div></div>
    </section>
    <div className="module-stat-grid">
      <section><Layers3 size={20}/><strong>{schoolModules.length}</strong><span>модула в обхвата</span></section>
      <section><ShieldCheck size={20}/><strong>{count('connected')}</strong><span>със свързана пилотна част</span></section>
      <section><Compass size={20}/><strong>{count('demo')}</strong><span>с работещо демо</span></section>
      <section><ArrowRight size={20}/><strong>{count('planned') + count('integration') + count('service')}</strong><span>за следващи етапи</span></section>
    </div>
    <div className="module-catalogue-body">
      <aside className="module-category-panel"><h2>Области</h2><button type="button" aria-pressed={filters.category === 'all'} onClick={() => change({ category: 'all' })}><Layers3 size={18}/><span>Всички модули</span><small>{schoolModules.length}</small></button>{Object.entries(moduleCategories).map(([key, label]) => { const Icon = icons[key as ModuleCategory]; return <button type="button" key={key} aria-pressed={filters.category === key} onClick={() => change({ category: key })}><Icon size={18}/><span>{label}</span><small>{schoolModules.filter(m => m.category === key).length}</small></button>; })}<p><ShieldCheck size={18}/>Статусът описва готовността на модула. Училищните права се определят от одобрения акаунт.</p></aside>
      <div className="module-results">
        <div className="module-filter-bar"><label className="module-search"><Search size={18}/><input maxLength={200} value={filters.query} onChange={e => change({ query: e.target.value })} aria-label="Търси в каталога на модулите" placeholder="Модул, задача или ключова дума…"/>{filters.query && <button type="button" aria-label="Изчисти търсенето" onClick={() => change({ query: '' })}><X size={16}/></button>}</label><Choice value={filters.role} label="Модули за роля; филтърът не променя училищни права" onChange={v => change({ role: v })} options={[{ value: 'all', label: 'За всички роли' }, ...Object.entries(roles).map(([value, r]) => ({ value, label: r.label }))]}/></div>
        <div className="module-state-filters" role="group" aria-label="Готовност на модулите"><button type="button" aria-pressed={filters.state === 'all'} onClick={() => change({ state: 'all' })}>Всички състояния</button>{Object.entries(moduleStates).map(([key, value]) => <button type="button" key={key} aria-pressed={filters.state === key} onClick={() => change({ state: key })}>{value.label}</button>)}</div>
        <div className="module-result-heading" aria-live="polite"><p><strong>{visible.length}</strong> {visible.length === 1 ? 'модул' : 'модула'}{filters.category !== 'all' ? ' · ' + moduleCategories[filters.category as ModuleCategory] : ''}</p>{Object.entries(filters).some(([k, v]) => v !== defaultModuleFilters[k as keyof ModuleFilters]) && <button type="button" onClick={() => { setFilters(defaultModuleFilters); address(defaultModuleFilters, selected); }}><SlidersHorizontal size={15}/>Изчисти филтрите</button>}</div>
        {visible.length ? <div className="module-card-grid">{visible.map(m => { const Icon = icons[m.category]; return <article className={`module-card ${m.category}`} key={m.id}><header><span className="module-card-icon"><Icon size={22}/></span><StateLabel item={m}/></header><h2>{m.title}</h2><p>{m.summary}</p><div className="module-role-dots">{m.roles.map(r => <span key={r}>{roles[r].label}</span>)}</div><footer><span>{modulePhaseLabels[m.phase]}</span><button type="button" onClick={() => inspect(m)} aria-label={`Обхват и достъп: ${m.title}`}>Виж модула<ArrowRight size={17}/></button></footer></article>; })}</div> : <Blank icon={Search} title="Няма модул с тези филтри" text="Промени ролята, областта или търсенето."><Button variant="light" onClick={() => { setFilters(defaultModuleFilters); address(defaultModuleFilters, selected); }}>Покажи всички модули</Button></Blank>}
      </div>
    </div>
    <section className="module-legend"><h2>Как да четеш статуса</h2><div>{Object.entries(moduleStates).map(([key, value]) => <p key={key}><span className={`module-state ${key}`}><i/>{value.label}</span><span>{value.description}</span></p>)}</div></section>
    <Dialog open={!!selected} onOpenChange={open => !open && inspect(null)}><DialogContent showCloseButton={false} className="school-dialog module-detail"><button className="modal-close" type="button" aria-label="Затвори детайлите на модула" onClick={() => inspect(null)}><X size={19}/></button>{selected && <><DialogHeader><DialogTitle>{selected.title}</DialogTitle><DialogDescription>{selected.summary}</DialogDescription></DialogHeader><div className="dialog-scroll"><StateLabel item={selected}/><p className="module-detail-state">{moduleStates[selected.state].description}</p><section><h2><CheckCircle2 size={19}/>Налично сега</h2><p>{selected.current}</p></section><section><h2><Layers3 size={19}/>Оставащ обхват</h2><ul>{selected.remaining.map(text => <li key={text}><span/><p>{text}</p></li>)}</ul></section><div className="module-detail-meta"><span>Роли: {selected.roles.map(r => roles[r].label).join(', ')}</span><span>Етап: {modulePhaseLabels[selected.phase]}</span></div>{selected.links?.some(link => available.includes(link.section)) && <div className="module-detail-actions">{selected.links.filter(link => available.includes(link.section)).map(link => <Button variant={link.section.startsWith('school') || link.section === 'classwork' ? '' : 'light'} key={link.section} onClick={() => { inspect(null); go(link.section); }}>{link.label}<ArrowRight size={17}/></Button>)}</div>}<p className="module-detail-note"><Check size={16}/>Филтрите в каталога не дават нови права. Свързаните раздели проверяват достъпа при отваряне.</p></div></>}</DialogContent></Dialog>
  </div>;
}
