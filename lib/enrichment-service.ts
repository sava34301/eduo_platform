import { z } from 'zod';
import { getRecord, getRecords, recordSnapshot, saveGuarded } from './store';
import { subjects, students, lessons, roles, type SchoolRecord } from './school-data';
import { validDate } from './platform-service';
import { publicRecord, schoolToday, plusDays } from './platform-data';
import { learningNotes, gradeSuggestion, schoolYear } from './enrichment-data';
import { practiceBanks } from './practice-bank';
import { lessonsOn, mondayOf } from './school-operations';
const id=z.string().min(1).max(150), title=z.string().trim().min(3).max(200), revision=z.number().int().min(0), actor=z.enum(['teacher','admin']).default('teacher');
const student=z.number().int().min(0).max(students.length-1), subject=z.enum(subjects as [string,...string[]]);
const schemas:Record<string,z.ZodTypeAny>={
 grade:z.object({studentId:student,subject,value:z.number().int().min(2).max(6),type:title.max(80),comment:z.string().max(2000),date:validDate,gradeKind:z.enum(['current','term1','term2','annual']).default('current'),year:z.string().regex(/^\d{4}\/\d{4}$/).refine(v=>Number(v.slice(5))===Number(v.slice(0,4))+1).optional(),requestId:z.string().uuid().optional()}),
 'grade-attempt':z.object({attemptId:id,comment:z.string().max(2000).default(''),confirmed:z.literal(true)}),
 'learning-note':z.object({code:z.enum(Object.keys(learningNotes) as [string,...string[]]),active:z.boolean(),revision:revision.default(0)}),
 'learning-event':z.object({sourceId:id,action:z.enum(['read','adapt','video'])}),
 'start-practice':z.object({subject:z.enum(Object.keys(practiceBanks) as [string,...string[]]),requestId:z.string().uuid()}),
 remark:z.object({studentId:student,category:z.enum(['praise','note']),body:z.string().trim().min(5).max(2000),requestId:z.string().uuid(),actor}),
 'withdraw-remark':z.object({id,revision,reason:z.string().trim().min(5).max(500),actor}),
 fee:z.object({requestId:z.string().uuid(),title,description:z.string().max(2000),amountCents:z.number().int().min(1).max(1000000),due:validDate}),
 'fee-state':z.object({id,revision,studentId:student,action:z.enum(['declare','confirm','reopen']),note:z.string().trim().max(120).default('')}),
 'substitution-create':z.object({date:validDate,teacher:title.max(100),reason:z.string().trim().min(3).max(500),revision:revision.default(0)}),
 'substitution-update':z.object({date:validDate,slot:z.number().int().min(0).max(5),revision,action:z.enum(['cover','release','cancel']),teacher:z.string().max(100).optional(),note:z.string().trim().max(500).default('')}),
 'lesson-topic':z.object({date:validDate,slot:z.number().int().min(0).max(5),revision:revision.default(0),topic:title,body:z.string().max(3000).default(''),virtualUrl:z.union([z.literal(''),z.string().url().max(1000).refine(v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}})]).default('')}),
 'material-publish':z.object({id,revision:revision.default(0),status:z.enum(['draft','published'])})
};
export const handlesEnrichment=(type:string)=>Object.hasOwn(schemas,type);
const fail=(error:string,status=400)=>Response.json({error},{status});
export async function handleEnrichment(owner:string,type:string,input:unknown){
 const parsed=schemas[type].safeParse(input);if(!parsed.success)return fail('Проверете попълнените полета.');
 const d=parsed.data,now=new Date().toISOString();let record:SchoolRecord,previous:string|null=null,dependency:{id:string;payload:string}|undefined,event='Обновен училищен запис';
 const existing=async(key:string,kind:string,version?:number)=>{const snapshot=await recordSnapshot(owner,key);if(!snapshot.record||snapshot.record.kind!==kind)return null;if(version!==undefined&&(snapshot.record.revision||0)!==version)return false;return {...snapshot,record:snapshot.record!};};
 switch(type){
 case 'grade': {
  const year=d.year||schoolYear(d.date),key=d.gradeKind==='current'?'grade-'+(d.requestId||crypto.randomUUID()):`grade-final-${d.studentId}-${subjects.indexOf(d.subject)}-${year.replace('/','-')}-${d.gradeKind}`;
  const s=await recordSnapshot(owner,key);if(s.record){if(d.requestId&&s.record.requestId===d.requestId&&s.record.value===d.value&&s.record.comment===d.comment&&s.record.subject===d.subject&&s.record.studentId===d.studentId&&s.record.gradeKind===d.gradeKind&&s.record.year===year&&s.record.date===d.date&&s.record.type===d.type)return Response.json({record:s.record});return fail('Вече има оценка за този срок и предмет. Използвайте корекция на съществуващата оценка.',409);}
  record={...d,year,id:key,kind:'grade',revision:1,createdAt:now};event='Учителят вписа '+(d.gradeKind==='current'?'текуща':'срочна или годишна')+' оценка';break;
 }
 case 'grade-attempt':{
  const a=await getRecord(owner,d.attemptId);if(a?.kind!=='attempt')return fail('Резултатът не е намерен.',404);
  if(a.mode!=='assessment')return fail('Упражненията не се превръщат автоматично в оценки. Оценете усвоеното отделно.');
  const key='grade-for-'+a.id,s=await recordSnapshot(owner,key);if(s.record)return Response.json({record:s.record});
  record={id:key,kind:'grade',studentId:a.studentId,subject:a.subject,value:gradeSuggestion(a.percent),type:'Контролна работа',gradeKind:'current',year:schoolYear(),comment:d.comment||`Резултат от „${a.quizTitle}“: ${a.points}/${a.maxPoints} точки.`,date:schoolToday(),sourceAttemptId:a.id,revision:1,createdAt:now};event='Учителят потвърди оценка от тест';break;
 }
 case 'learning-note':{
  const key='learning-note-'+d.code,s=await recordSnapshot(owner,key);if((s.record?.revision||0)!==d.revision)return fail('Профилът е променен. Обновете и опитайте отново.',409);
  previous=s.payload;record={id:key,kind:'learning-note',studentId:0,code:d.code,active:d.active,revision:d.revision+1,updatedAt:now,createdAt:s.record?.createdAt||now};event=d.active?'Добавено учебно предпочитание':'Премахнато учебно предпочитание';break;
 }
 case 'learning-event':{
  const material=await getRecord(owner,d.sourceId);if(!lessons.some(l=>l.id===d.sourceId)&&!(material?.kind==='material'&&(material.status==='published'||!material.status&&!['test','lesson'].includes(material.format))))return fail('Материалът не е достъпен.',404);
  const key=`learning-event-${d.sourceId}-${d.action}-${schoolToday()}`,s=await recordSnapshot(owner,key);if(s.record)return Response.json({record:s.record});
  record={id:key,kind:'learning-event',studentId:0,...d,createdAt:now};event='Записана учебна дейност';break;
 }
 case 'start-practice':{
  const key='practice-quiz-'+d.requestId,s=await recordSnapshot(owner,key);if(s.record)return s.record.subject===d.subject?Response.json({record:publicRecord(s.record)}):fail('Заявката е използвана за друг предмет.',409);
  record={id:key,kind:'quiz',title:`Упражнение · ${d.subject}`,subject:d.subject,description:'Пет подготвени въпроса с обяснения. За упражнение, без оценка в дневника.',mode:'practice',origin:'practice-bank',status:'published',questions:practiceBanks[d.subject],due:plusDays(schoolToday(),365),createdAt:now,version:1};event='Подготвено лично упражнение';break;
 }
 case 'remark':{
  const key='remark-'+d.requestId,s=await recordSnapshot(owner,key);if(s.record)return s.record.body===d.body&&s.record.studentId===d.studentId&&s.record.category===d.category?Response.json({record:s.record}):fail('Тази заявка вече е използвана.',409);
  record={...d,id:key,kind:'remark',revision:1,author:roles[d.actor as 'teacher'|'admin'].name,createdAt:now};event=d.category==='praise'?'Добавена учителска похвала':'Добавена учителска бележка';break;
 }
 case 'withdraw-remark':{
  const s=await existing(d.id,'remark',d.revision);if(s===null)return fail('Бележката не е намерена.',404);if(s===false)return fail('Бележката е променена. Обновете страницата.',409);previous=s.payload;
  record={...s.record,withdrawn:true,withdrawalReason:d.reason,revision:d.revision+1,updatedAt:now};event='Оттеглена учителска бележка';break;
 }
 case 'fee':{
  const key='fee-'+d.requestId,s=await recordSnapshot(owner,key);if(s.record)return s.record.title===d.title&&s.record.description===d.description&&s.record.due===d.due&&s.record.amountCents===d.amountCents?Response.json({record:s.record}):fail('Тази заявка вече е използвана.',409);
  record={...d,id:key,kind:'fee',revision:1,charges:students.map((_,studentId)=>({studentId,status:'due'})),createdAt:now};event='Добавена такса за демонстрационния клас';break;
 }
 case 'fee-state':{
  const s=await existing(d.id,'fee',d.revision);if(s===null)return fail('Таксата не е намерена.',404);if(s===false)return fail('Регистърът е променен. Обновете и опитайте отново.',409);
  const charge=s.record.charges.find((x:any)=>x.studentId===d.studentId);if(!charge)return fail('Няма начисление за този ученик.',404);
  if(d.action==='declare'&&(d.studentId!==0||charge.status!=='due'))return fail('Деклариране е достъпно само за непотвърдена такса на демо детето.',409);
  if(d.action==='confirm'&&charge.status==='confirmed')return fail('Плащането вече е отбелязано.',409);
  if(d.action==='reopen'&&d.note.length<5)return fail('Посочете причина за връщането.');
  previous=s.payload;record={...s.record,revision:d.revision+1,updatedAt:now,charges:s.record.charges.map((x:any)=>x.studentId!==d.studentId?x:{...x,status:d.action==='declare'?'declared':d.action==='confirm'?'confirmed':'due',updatedAt:now,note:d.note,history:[...(x.history||[]),{from:x.status,action:d.action,note:d.note,at:now}]})};event='Обновен статус в регистъра на таксите';break;
 }
 case 'substitution-create':{
  if(d.date<schoolToday())return fail('Изберете днешен или бъдещ учебен ден.');
  const records=await getRecords(owner),entries=lessonsOn(records,d.date).filter(l=>l.teacher===d.teacher);
  if(!entries.length)return fail('Този преподавател няма часове в избрания ден.');
  const s=await recordSnapshot(owner,'substitutions-'+d.date);if((s.record?.revision||0)!==d.revision)return fail('Заместванията са променени. Обновете страницата.',409);
  const items=s.record?.items||[];if(entries.some(l=>items.some((x:any)=>x.slot===l.slot&&x.status!=='cancelled')))return fail('За тези часове вече има обявено заместване.',409);
  const week=await recordSnapshot(owner,'timetable-'+mondayOf(d.date));if(week.payload)dependency={id:week.record!.id,payload:week.payload};
  previous=s.payload;record={id:'substitutions-'+d.date,kind:'substitutions',date:d.date,revision:d.revision+1,createdAt:s.record?.createdAt||now,updatedAt:now,items:[...items.filter((x:any)=>!entries.some(l=>l.slot===x.slot)),...entries.map(l=>({...l,reason:d.reason,status:'open',cover:'',announcedAt:now}))]};event='Обявени часове за заместване';break;
 }
 case 'substitution-update':{
  if(d.date<schoolToday())return fail('Минало заместване не може да се променя.');
  const s=await existing('substitutions-'+d.date,'substitutions',d.revision);if(s===null)return fail('Заместването не е намерено.',404);if(s===false)return fail('Друг колега е променил часа. Обновете страницата.',409);
  const entry=s.record.items.find((x:any)=>x.slot===d.slot);if(!entry||entry.status==='cancelled')return fail('Часът вече не е достъпен.',409);
  if(d.action==='cover'){
   const records=await getRecords(owner),available=new Set(records.filter(r=>r.kind==='timetable-week').flatMap(r=>r.entries.map((x:any)=>x.teacher)).concat(lessonsOn(records,d.date).map(l=>l.teacher),['Мария Николова','Десислава Иванова','Петър Стоянов','Анна Колева','Иван Тодоров','Димитър Колев','Елица Георгиева']));
   if(!d.teacher||!available.has(d.teacher)||d.teacher===entry.teacher)return fail('Изберете друг преподавател от училището.');
   if(entry.cover)return fail('Часът вече е поет. Първо освободете заместването.',409);
   if(s.record.items.some((x:any)=>x.teacher===d.teacher&&x.status!=='cancelled'))return fail('Преподавателят е отбелязан като отсъстващ за този ден.',409);
   if(lessonsOn(records,d.date).some(l=>l.teacher===d.teacher&&l.start<entry.end&&entry.start<l.end)||s.record.items.some((x:any)=>x.cover===d.teacher&&x.status==='covered'&&x.start<entry.end&&entry.start<x.end))return fail('Преподавателят има друг час по това време.',409);
  }
  if(d.action==='cancel'&&d.note.length<5)return fail('Посочете причина за отмяната.');
  previous=s.payload;record={...s.record,revision:d.revision+1,updatedAt:now,items:s.record.items.map((x:any)=>x.slot!==d.slot?x:{...x,status:d.action==='cover'?'covered':d.action==='cancel'?'cancelled':'open',cover:d.action==='cover'?d.teacher:'',updatedAt:now,history:[...(x.history||[]),{action:d.action,teacher:d.teacher||'',note:d.note,at:now}]})};event='Обновено заместване';break;
 }
 case 'lesson-topic':{
  const all=await getRecords(owner),lesson=lessonsOn(all,d.date).find(l=>l.slot===d.slot);if(!lesson)return fail('Няма учебен час на тази дата и позиция.',404);
  const key=`lesson-topic-${d.date}-${d.slot}`,s=await recordSnapshot(owner,key);if((s.record?.revision||0)!==d.revision)return fail('Темата е променена. Обновете страницата.',409);
  previous=s.payload;record={...d,id:key,kind:'lesson-topic',lessonSnapshot:lesson,revision:d.revision+1,createdAt:s.record?.createdAt||now,updatedAt:now,history:s.record?[...(s.record.history||[]),{topic:s.record.topic,body:s.record.body,virtualUrl:s.record.virtualUrl,at:now}]:[]};event='Записана тема на учебния час';break;
 }
 case 'material-publish':{
  const s=await existing(d.id,'material',d.revision);if(s===null)return fail('Материалът не е намерен.',404);if(s===false)return fail('Материалът е променен. Обновете страницата.',409);
  if(s.record.format==='test'&&d.status==='published')return fail('Шаблоните с ключове за отговори са само за учителя. Създайте ученически тест.');
  previous=s.payload;record={...s.record,status:d.status,revision:d.revision+1,updatedAt:now};event=d.status==='published'?'Публикуван учебен материал':'Скрит учебен материал';break;
 }
 default:return fail('Непознато действие.');
 }
 if(!await saveGuarded(owner,record!,previous,event,dependency))return fail('Записът е променен едновременно. Обновете страницата и опитайте отново.',409);
 return Response.json({record:publicRecord(record!)});
}
