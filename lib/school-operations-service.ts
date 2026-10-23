import { z } from 'zod';
import { validDate } from './platform-service';
import { getRecords, recordSnapshot, saveGuarded } from './store';
import { schoolToday, plusDays } from './platform-data';
import { roles, type SchoolRecord } from './school-data';
import { timetableSubjects, timetableWeek, lessonsOn, weekdays, type TimetableLesson } from './school-operations';

const version=z.number().int().min(0).default(0);
const clock=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const actor=z.enum(['teacher','admin']).default('teacher');
const entry=z.object({day:z.number().int().min(0).max(4),slot:z.number().int().min(0).max(5),subject:z.enum(timetableSubjects as [string,...string[]]),teacher:z.string().trim().min(3).max(100),room:z.string().trim().min(1).max(80),start:clock,end:clock});
const schemas:Record<string,z.ZodTypeAny>={
 'timetable-week':z.object({week:validDate,version,entries:z.array(entry).max(30),actor}),
 attendance:z.object({studentId:z.number().int().min(0).max(7),date:validDate,lesson:z.number().int().min(0).max(5),status:z.enum(['unmarked','present','absent','late','excused']),version,actor}),
 'explain-absence':z.object({id:z.string().min(1).max(100),version,body:z.string().trim().min(5).max(1500)}),
 'review-absence':z.object({id:z.string().min(1).max(100),version,decision:z.enum(['approved','rejected']),note:z.string().trim().min(3).max(1000),actor})
};
const fail=(error:string,status=400)=>Response.json({error},{status});
export const handlesSchoolOperation=(type:string)=>Object.hasOwn(schemas,type);
const conflict=()=>fail('Има по-нова промяна. Обновете данните и прегледайте записа отново.',409);
export async function handleSchoolOperation(owner:string,type:string,input:unknown){
 const parsed=schemas[type].safeParse(input);
 if(!parsed.success)return fail('Проверете полетата, датата и часовете.');
 const d=parsed.data,now=new Date().toISOString();
 const id=type==='timetable-week'?`timetable-${d.week}`:type==='attendance'?`attendance-${d.studentId}-${d.date}-${d.lesson}`:d.id;
 const snapshot=await recordSnapshot(owner,id),old=snapshot.record;
 if(['explain-absence','review-absence'].includes(type)&&(old?.kind!=='attendance'||(type==='explain-absence'&&old.studentId!==0)))return fail('Присъствието не е намерено.',404);
 if((old?.version||0)!==d.version)return conflict();
 let record:SchoolRecord,action:string;
 if(type==='timetable-week'){
   if(new Date(d.week+'T12:00:00Z').getUTCDay()!==1)return fail('Седмицата трябва да започва в понеделник.');
   const entries=[...d.entries].sort((a,b)=>a.day-b.day||a.slot-b.slot) as TimetableLesson[];
   for(let day=0;day<5;day++){
     const daily=entries.filter(e=>e.day===day);
     if(new Set(daily.map(e=>e.slot)).size!==daily.length)return fail(`${weekdays[day]}: учебните часове се повтарят.`);
     for(let i=0;i<daily.length;i++){
       if(daily[i].end<=daily[i].start)return fail('Краят на часа трябва да е след началото.');
       if(i>0&&daily[i].start<daily[i-1].end)return fail(`${weekdays[day]}: часовете се застъпват или не са подредени.`);
     }
   }
   const all=await getRecords(owner),before=timetableWeek(all,d.week).entries;
   for(let day=0;day<5;day++)for(let slot=0;slot<6;slot++){
     const a=before.find(e=>e.day===day&&e.slot===slot),b=entries.find(e=>e.day===day&&e.slot===slot);
     if(JSON.stringify(a)===JSON.stringify(b))continue;
     const date=plusDays(d.week,day);
     if(date<schoolToday())return fail('Миналите учебни дни се пазят непроменени.');
     if(all.some(r=>r.kind==='substitutions'&&r.date===date&&r.items.some((x:any)=>x.slot===slot&&x.status!=='cancelled')))return fail('Първо отменете активното заместване за този час.');
     if(all.some(r=>r.kind==='attendance'&&r.date===date&&r.lesson===slot&&r.status!=='unmarked'))return fail('Час с отбелязани присъствия не може да бъде променен.');
   }
   record={id,kind:'timetable-week',week:d.week,className:'6. А',entries,version:d.version+1,createdAt:old?.createdAt||now,updatedAt:now,updatedBy:roles[d.actor as 'teacher'|'admin'].name};
   action='Обновена седмична учебна програма';
 }else if(type==='attendance'){
   if(d.date>schoolToday())return fail('Присъствие се отбелязва за днес или за минал ден.');
   const all=await getRecords(owner),lesson=lessonsOn(all,d.date).find(l=>l.slot===d.lesson);
   if(!lesson&&!old)return fail('За тази дата и час няма занятие в програмата.');
   if(old?.status===d.status)return Response.json({record:old});
   const history=[...(old?.history||[]),{at:now,event:'attendance',from:old?.status||'unmarked',to:d.status,by:roles[d.actor as 'teacher'|'admin'].name}];
   const explanation=old?.explanation?{...old.explanation,status:'cancelled',reviewedAt:now,reviewNote:'Присъствието е коригирано от учител.',reviewedBy:roles[d.actor as 'teacher'|'admin'].name,previousStatus:old.explanation.status}:undefined;
   record={...old,id,kind:'attendance',studentId:d.studentId,date:d.date,lesson:d.lesson,status:d.status,subject:old?.subject||lesson?.subject,start:old?.start||lesson?.start,end:old?.end||lesson?.end,room:old?.room||lesson?.room,version:d.version+1,createdAt:old?.createdAt||now,updatedAt:now,history,explanation};
   action='Обновено присъствие';
 }else{
   if(old?.kind!=='attendance')return fail('Присъствието не е намерено.',404);
   if(type==='explain-absence'){
     if(old.studentId!==0)return fail('Присъствието не е намерено.',404);
     if(!['absent','late'].includes(old.status))return fail('Обяснение се добавя към отсъствие или закъснение.');
     if(old.explanation?.status==='pending')return fail('Обяснението вече чака преглед.',409);
     const explanation={body:d.body,status:'pending',submittedAt:now,submittedBy:roles.parent.name};
     record={...old,explanation,version:d.version+1,updatedAt:now,history:[...(old.history||[]),{at:now,event:'explanation',by:roles.parent.name,body:d.body,previousExplanation:old.explanation||null}]};
     action='Добавено родителско обяснение за отсъствие';
   }else{
     if(old.explanation?.status!=='pending'||!['absent','late'].includes(old.status))return fail('Няма чакащо обяснение за преглед.',409);
     const status=d.decision==='approved'?'excused':old.status;
     record={...old,status,version:d.version+1,updatedAt:now,explanation:{...old.explanation,status:d.decision,reviewNote:d.note,reviewedAt:now,reviewedBy:roles[d.actor as 'teacher'|'admin'].name},history:[...(old.history||[]),{at:now,event:'review',decision:d.decision,from:old.status,to:status,note:d.note,by:roles[d.actor as 'teacher'|'admin'].name}]};
     action=d.decision==='approved'?'Одобрено обяснение и извинено отсъствие':'Върнато обяснение за уточнение';
   }
 }
 if(!await saveGuarded(owner,record,snapshot.payload,action))return conflict();
 return Response.json({record});
}
