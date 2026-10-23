import { currentGrades } from './enrichment-data';
import {type Role, type SchoolRecord} from './school-data';
import {schoolToday,plusDays} from './platform-data';

// These are presentation scopes inside an owner-private demo, not school RBAC.
export function roleRecords(records:SchoolRecord[],role:Role){
  const staff=role==='teacher'||role==='admin';
  return records.filter(r=>{
    if(['task','note'].includes(r.kind)) return (r.role||'student')===role;
    if(r.kind==='read-state') return r.role===role;
    if(r.kind==='audit') return staff;
    if(r.kind==='document'&&!staff) return r.status!=='draft';
    if(['grade','attendance','submission','attempt','practice','remark','learning-event','learning-note'].includes(r.kind)&&!staff) return (r.studentId??0)===0;
    if(r.kind==='quiz'&&!staff) return r.status==='published';
    if(r.kind==='message'&&role==='student') return r.thread!=='parents';
    if(r.kind==='material'&&!staff) return (r.status==='published'||!r.status&&!['test','lesson'].includes(r.format))&&r.format!=='test';
    if(r.kind==='fee'&&role==='student')return false;
    return true;
  }).map(r=>{if(r.kind==='fee'&&!staff)return {...r,charges:r.charges.filter((x:any)=>x.studentId===0)};if(r.kind==='substitutions'&&!staff)return {...r,items:r.items.map(({reason,history,...x}:any)=>x)};if(r.kind!=='document'||staff)return r;const {draft,...visible}=r;return {...visible,events:(r.events||[]).filter((e:any)=>['publish-document','acknowledge','withdraw-document'].includes(e.type))};});
}
export const roleHeadings:Record<Role,string>={student:'Моят ден',teacher:'Работно табло',parent:'За моето дете',admin:'Училищен обзор'};
export function averageGrade(input:SchoolRecord[]){const records=currentGrades(input);return records.length?(records.reduce((n,r)=>n+r.value,0)/records.length).toFixed(2):'—'}
export type SchoolNotice={id:string;title:string;detail:string;kind:'homework'|'review'|'document'|'message'|'quiz'|'attendance'|'grade'|'fee'|'remark'|'substitution'|'event';at?:string;section:string;record?:SchoolRecord;unread:boolean};
export function schoolNotices(records:SchoolRecord[],role:Role):SchoolNotice[]{
  const visible=roleRecords(records,role),staff=role==='teacher'||role==='admin';
  const read=new Set(visible.find(r=>r.kind==='read-state')?.ids||[]);
  const items:Omit<SchoolNotice,'unread'>[]=[];
  const assignments=visible.filter(r=>r.kind==='assignment'&&!r.archived);
  for(const r of visible){
    if(r.kind==='assignment'&&!r.archived&&role==='student'&&r.due<=plusDays(schoolToday(),7)&&!visible.some(s=>s.kind==='submission'&&s.assignmentId===r.id&&s.status!=='revision'))
      items.push({id:r.id+':'+r.due,title:r.title,detail:'Домашно · срок '+r.due,kind:'homework',section:'homework',record:r});
    if(r.kind==='submission'&&staff&&r.status==='submitted'){
      const a=assignments.find(a=>a.id===r.assignmentId);if(a)items.push({id:r.id+':'+(r.submittedAt||r.createdAt),title:a.title,detail:'Предадена работа за преглед',kind:'review',section:'homework',record:a});
    }
    if(r.kind==='submission'&&!staff&&r.feedback){const a=assignments.find(a=>a.id===r.assignmentId);if(a)items.push({id:r.id+':'+(r.reviewedAt||r.updatedAt||r.status),title:'Обратна връзка по домашно',detail:a.title,kind:'review',section:'homework',record:a});}
    if(r.kind==='document'&&r.status==='pending'&&role!=='student')items.push({id:r.id+':'+(r.version||1),title:r.title,detail:role==='parent'?'Очаква твоето потвърждение':'Очаква родителски преглед',kind:'document',section:'documents',record:r});
    if(r.kind==='document'&&r.status==='acknowledged'&&staff)items.push({id:r.id+':ack:'+(r.receipt?.id||r.ackAt),title:'Потвърден документ',detail:r.title,kind:'document',section:'documents',record:r});
    if(r.kind==='document'&&r.status==='withdrawn'&&role==='parent')items.push({id:r.id+':withdrawn:'+r.withdrawnAt,title:'Оттеглена заявка',detail:r.title,kind:'document',section:'documents',record:r});
    if(r.kind==='attempt'&&staff&&r.status!=='reviewed')items.push({id:r.id,title:r.quizTitle,detail:'Резултат от тест за обратна връзка',kind:'quiz',section:'quizzes'});
    if(r.kind==='attendance'&&r.explanation?.status==='pending'&&staff)items.push({id:r.id+':explanation:'+r.explanation.submittedAt,title:'Обяснение за отсъствие',detail:'Очаква учителски преглед · '+r.date,kind:'attendance',section:'gradebook?tab=attendance&mode=requests'});
    if(r.kind==='attendance'&&role==='parent'&&['approved','rejected','cancelled'].includes(r.explanation?.status))items.push({id:r.id+':review:'+r.explanation.reviewedAt,title:r.explanation.status==='approved'?'Отсъствието е извинено':r.explanation.status==='rejected'?'Нужно е уточнение':'Присъствието е коригирано',detail:r.subject||r.date,kind:'attendance',section:'gradebook?tab=attendance&mode=history'});
    if(r.kind==='attendance'&&role==='parent'&&['absent','late'].includes(r.status)&&!r.explanation)items.push({id:r.id+':absence',title:'Отбелязано отсъствие или закъснение',detail:r.subject||r.date,kind:'attendance',section:'gradebook?tab=attendance&mode=history'});
    if(r.kind==='grade'&&!staff)items.push({id:r.id+':'+(r.updatedAt||r.createdAt||r.date),title:'Нова оценка: '+r.value,detail:r.subject,kind:'grade',section:'gradebook',at:r.updatedAt||r.createdAt||r.date});
    if(r.kind==='remark'&&!r.withdrawn&&!staff)items.push({id:r.id,title:r.category==='praise'?'Похвала от учителя':'Бележка от учителя',detail:r.body.slice(0,100),kind:'remark',section:'profile',at:r.createdAt});
    if(r.kind==='fee'&&role==='parent'){const charge=r.charges.find((x:any)=>x.studentId===0);if(charge&&charge.status!=='confirmed')items.push({id:r.id+':'+charge.status,title:r.title,detail:charge.status==='declared'?'Плащането очаква проверка':'Ново начисление · срок '+r.due,kind:'fee',section:'fees',at:charge.updatedAt||r.createdAt});}
    if(r.kind==='fee'&&role==='admin'&&r.charges.some((x:any)=>x.status==='declared'))items.push({id:r.id+':'+r.revision,title:'Плащане за проверка',detail:r.title,kind:'fee',section:'fees',at:r.updatedAt||r.createdAt});
    if(r.kind==='substitutions'&&r.date>=schoolToday()&&r.items.some((x:any)=>x.status!=='cancelled'))items.push({id:r.id+':'+r.revision,title:'Промяна в учебния ден',detail:'Замествания · '+r.date,kind:'substitution',section:(staff?'substitutions':'schedule')+'?date='+r.date,at:r.updatedAt||r.createdAt});
    if(r.kind==='event'&&r.status==='active'&&r.date>=schoolToday())items.push({id:r.id+':'+(r.updatedAt||r.date),title:r.title,detail:'Събитие · '+r.date+' '+r.time,kind:'event',section:'calendar?date='+r.date,at:r.updatedAt||r.createdAt||r.date});
    if(r.kind==='message'&&r.from!==role)items.push({id:r.id,title:r.thread==='parents'?'Родителски кът':r.thread==='class'?'Новини от 6. А':'Консултация с класния',detail:r.body.slice(0,100),kind:'message',section:'messages'});
  }
  return items.map(n=>{const r=visible.find(r=>n.id===r.id||n.id.startsWith(r.id+':'));return {...n,at:n.at||r?.reviewedAt||r?.updatedAt||r?.createdAt||r?.date||r?.submittedAt||'',unread:!read.has(n.id)}}).sort((a,b)=>(b.at||'').localeCompare(a.at||''));
}
