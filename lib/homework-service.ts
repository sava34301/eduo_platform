import { z } from 'zod';
import { validDate } from './platform-service';
import { getRecord, recordSnapshot, saveGuarded } from './store';
import { roles, type SchoolRecord } from './school-data';
import { scoreRubric, snapshotSubmission, submissionAttempt } from './homework-data';

const id=z.string().min(1).max(100),version=z.number().int().min(0).default(0);
const actor=z.enum(['teacher','admin']).default('teacher');
const criterion=z.object({id:z.string().min(1).max(50),title:z.string().trim().min(3).max(100),description:z.string().trim().max(500),maxPoints:z.number().int().min(1).max(100)});
const schemas:Record<string,z.ZodTypeAny>={
 'assignment-rubric':z.object({id,version,criteria:z.array(criterion).max(6),actor}),
 'edit-assignment':z.object({id,version,title:z.string().trim().min(1).max(200),description:z.string().trim().min(1).max(20000),due:validDate,actor}),
 'archive-assignment':z.object({id,version,archived:z.boolean(),actor}),
 submission:z.object({assignmentId:id,version,assignmentVersion:version,body:z.string().trim().max(20000),aiUse:z.boolean(),files:z.array(id).max(3)}).refine(d=>d.body.length>0||d.files.length>0),
 review:z.object({id,version,feedback:z.string().trim().min(1).max(3000),status:z.enum(['reviewed','revision']),flag:z.boolean(),scores:z.array(z.object({id:z.string().min(1).max(50),points:z.number().int().min(0).max(100),note:z.string().trim().max(500)})).max(6).default([]),actor})
};
const fail=(error:string,status=400)=>Response.json({error},{status});
const conflict=()=>fail('Има по-нова версия. Обновете данните и отворете работата отново. Текстът във формуляра остава тук.',409);
export const handlesHomework=(type:string)=>Object.hasOwn(schemas,type);
export async function handleHomework(owner:string,type:string,input:unknown){
 const parsed=schemas[type].safeParse(input);
 if(!parsed.success)return fail('Проверете полетата и точките по критериите.');
 const d=parsed.data,now=new Date().toISOString();
 const target=type==='submission'?`submission-${d.assignmentId}-0`:d.id;
 const original=await recordSnapshot(owner,target),old=original.record;
 const kind=type==='submission'||type==='review'?'submission':'assignment';
 if(type!=='submission'&&old?.kind!==kind)return fail('Записът не е намерен.',404);
 if((old?.version||0)!==d.version)return conflict();
 let record:SchoolRecord,event:string,dependency:{id:string;payload:string}|undefined;
 if(type==='submission'){
   const source=await recordSnapshot(owner,d.assignmentId),a=source.record;
   if(a?.kind!=='assignment'||a.archived)return fail('Домашното не е намерено.',404);
   if((a.version||0)!==d.assignmentVersion)return conflict();
   if(new Set(d.files).size!==d.files.length)return fail('Един файл е добавен повече от веднъж.');
   for(const fileId of d.files)if((await getRecord(owner,fileId))?.kind!=='file')return fail('Невалиден прикачен файл.');
   if(old?.status==='submitted'&&old.body===d.body&&old.aiUse===d.aiUse&&JSON.stringify(old.files||[])===JSON.stringify(d.files)&&old.assignmentSnapshot?.version===(a.version||0))return Response.json({record:old});
   // Keep prior attempts intact, including their original task, files and feedback.
   record={id:target,kind:'submission',assignmentId:a.id,studentId:0,body:d.body,aiUse:d.aiUse,files:d.files,status:'submitted',feedback:'',flag:false,score:null,reviews:[],attempt:old?submissionAttempt(old)+1:1,version:d.version+1,createdAt:old?.createdAt||now,submittedAt:now,updatedAt:now,criteria:a.criteria||[],assignmentSnapshot:{title:a.title,description:a.description,subject:a.subject,due:a.due,version:a.version||0},history:[...(old?.history||[]),...(old?[snapshotSubmission(old)]:[])]};
   dependency={id:a.id,payload:source.payload!};
   event=old?'Предадена нова версия на домашно':'Предадено домашно';
 }else if(type==='review'){
   const criteria=old!.criteria||[];
   if(new Set(d.scores.map((s:any)=>s.id)).size!==d.scores.length)return fail('Критерий е оценен повече от веднъж.');
   if(d.scores.some((s:any)=>!criteria.some((c:any)=>c.id===s.id&&s.points<=c.maxPoints)))return fail('Точките не съответстват на критериите за тази версия.');
   if(d.scores.length>0&&d.scores.length!==criteria.length||d.status==='reviewed'&&d.scores.length!==criteria.length)return fail('Оценете всеки критерий или върнете работата с насоки без точки.');
   const score=d.scores.length?scoreRubric(criteria,d.scores):null;
   const previous=old!.reviews?.length?old!.reviews:old!.feedback?[{at:old!.reviewedAt||old!.updatedAt||old!.createdAt,status:old!.status,feedback:old!.feedback,flag:old!.flag,score:old!.score||null,by:roles.teacher.name}]:[];
   const review={at:now,status:d.status,feedback:d.feedback,flag:d.flag,score,by:roles[d.actor as 'teacher'|'admin'].name};
   record={...old!,...review,reviewedAt:now,updatedAt:now,version:d.version+1,reviews:[...previous,review]};
   event=d.status==='revision'?'Домашно, върнато за поправка':'Домашно с обратна връзка и критерии';
 }else{
   record={...old!,version:d.version+1,updatedAt:now,updatedBy:roles[d.actor as 'teacher'|'admin'].name};
   if(type==='assignment-rubric'){
     if(new Set(d.criteria.map((c:any)=>c.id)).size!==d.criteria.length)return fail('Всеки критерий трябва да е уникален.');
     if(d.criteria.reduce((sum:number,c:any)=>sum+c.maxPoints,0)>100)return fail('Общият брой точки трябва да е до 100.');
     record.criteria=d.criteria;event='Обновени критерии за бъдещи предавания';
   }else if(type==='edit-assignment'){
     record={...record,title:d.title,description:d.description,due:d.due};event='Редактирано домашно';
   }else{record.archived=d.archived;event=d.archived?'Архивирано домашно':'Възстановено домашно';}
 }
 if(!await saveGuarded(owner,record,original.payload,event,dependency))return conflict();
 return Response.json({record});
}
