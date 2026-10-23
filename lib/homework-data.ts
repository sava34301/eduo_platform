import type { SchoolRecord } from './school-data';

export type RubricCriterion = { id: string; title: string; description: string; maxPoints: number };
export type CriterionScore = { id: string; points: number; note: string };
export const submissionLabels:Record<string,string>={submitted:'За проверка',revision:'За поправка',reviewed:'Проверено'};
export const submissionColor=(status:string)=>status==='reviewed'?'green':status==='revision'?'orange':'blue';
export function submissionVersion(record?:SchoolRecord|null){return record?.version||0}
export function submissionAttempt(record?:SchoolRecord|null){return record?.attempt||1}
export function snapshotSubmission(record:SchoolRecord){
  return {attempt:submissionAttempt(record),body:record.body,files:record.files||[],aiUse:!!record.aiUse,submittedAt:record.submittedAt||record.createdAt,status:record.status,feedback:record.feedback||'',flag:!!record.flag,reviewedAt:record.reviewedAt,score:record.score||null,criteria:record.criteria||[],assignmentSnapshot:record.assignmentSnapshot||null,reviews:record.reviews||[]};
}
export function scoreRubric(criteria:RubricCriterion[],scores:CriterionScore[]){
  if(!criteria.length)return null;
  const points=scores.reduce((sum,s)=>sum+s.points,0),maxPoints=criteria.reduce((sum,c)=>sum+c.maxPoints,0);
  return {points,maxPoints,percent:Math.round(points/maxPoints*100),details:criteria.map(c=>({...c,...scores.find(s=>s.id===c.id)}))};
}
