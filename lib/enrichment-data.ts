import type { SchoolRecord } from './school-data';
import { schoolToday, plusDays } from './platform-data';
export const gradeKinds = { current:'Текуща', term1:'I срок', term2:'II срок', annual:'Годишна' };
export function schoolYear(date=schoolToday()){const y=Number(date.slice(0,4))-(Number(date.slice(5,7))<9?1:0);return `${y}/${y+1}`;}
export const currentGrades=(records:SchoolRecord[])=>records.filter(r=>r.kind==='grade'&&(!r.gradeKind||r.gradeKind==='current'));
export const gradeSuggestion=(percent:number)=>percent>=90?6:percent>=75?5:percent>=60?4:percent>=45?3:2;
export const learningNotes = {
 examples:'Разбирам по-добре с конкретен пример.', steps:'Предпочитам една стъпка наведнъж.', visual:'Схемите и сравненията ми помагат.', recap:'Искам кратко обобщение след обяснението.', practice:'Уча, когато опитам задача сам.', check:'Искам проверяващ въпрос след всяка важна идея.'
};
export const money=(cents:number)=>new Intl.NumberFormat('bg-BG',{style:'currency',currency:'EUR'}).format(cents/100);
export function learningStats(records:SchoolRecord[],studentId=0){
 const own=records.filter(r=>(r.studentId??0)===studentId), attempts=own.filter(r=>r.kind==='attempt'), practice=own.filter(r=>r.kind==='practice'), submissions=own.filter(r=>r.kind==='submission');
 const events=own.filter(r=>r.kind==='learning-event'), grades=currentGrades(own), questions=own.filter(r=>r.kind==='ai-request'&&r.succeeded);
 const onTime=submissions.filter(s=>{const a=records.find(r=>r.id===s.assignmentId);const due=s.assignmentSnapshot?.due||a?.due;return due&&(s.submittedAt||s.createdAt||'').slice(0,10)<=due});
 const read=new Set(events.filter(r=>r.action==='read').map(r=>r.sourceId)).size;
 const score=grades.length?grades.reduce((s,g)=>s+g.value,0)/grades.length:0;
 const badges=[{id:'punctual',title:'Винаги навреме',detail:'3 предадени работи, всички в срок',earned:submissions.length>=3&&onTime.length===submissions.length},{id:'curious',title:'Любознателен',detail:'5 успешни въпроса към помощника',earned:questions.length>=5},{id:'reader',title:'Чета още',detail:'3 различни прочетени материала',earned:read>=3},{id:'consistent',title:'Постоянство',detail:'3 завършени упражнения',earned:attempts.filter(a=>a.mode!=='assessment').length+practice.length>=3},{id:'mastery',title:'Добра подготовка',detail:'Поне 3 текущи оценки със среден успех 5,50+',earned:grades.length>=3&&score>=5.5}];
 return {attempts,practice,submissions,onTime:onTime.length,late:submissions.length-onTime.length,read,videos:events.filter(r=>r.action==='video').length,adaptations:events.filter(r=>r.action==='adapt').length,questions:questions.length,average:grades.length?score.toFixed(2):'—',badges};
}
export function weeklySummary(records:SchoolRecord[],studentId=0,today=schoolToday()){
 const since=plusDays(today,-6), own=records.filter(r=>(r.studentId??0)===studentId), inWeek=(r:SchoolRecord)=>(r.date||r.createdAt||'').slice(0,10)>=since&&(r.date||r.createdAt||'').slice(0,10)<=today;
 const grades=currentGrades(own).filter(inWeek), marks=own.filter(r=>r.kind==='attendance'&&inWeek(r)), submissions=own.filter(r=>r.kind==='submission'&&(r.submittedAt||r.createdAt||'').slice(0,10)>=since&&(r.submittedAt||r.createdAt||'').slice(0,10)<=today), attempts=own.filter(r=>r.kind==='attempt'&&inWeek(r));
 const due=records.filter(r=>r.kind==='assignment'&&!r.archived&&r.due>=today&&r.due<=plusDays(today,7)&&!own.some(s=>s.kind==='submission'&&s.assignmentId===r.id&&s.status!=='revision'));
 const praise=own.filter(r=>r.kind==='remark'&&r.category==='praise'&&!r.withdrawn&&inWeek(r));
 const lines=[grades.length?`Записани са ${grades.length} текущи оценки със среден успех ${(grades.reduce((s,g)=>s+g.value,0)/grades.length).toFixed(2)}.`:'Няма нови текущи оценки през последните 7 дни.',`Предадени домашни: ${submissions.length}. Завършени тестове и упражнения: ${attempts.length}.`,`Отбелязани неизвинени отсъствия: ${marks.filter(r=>r.status==='absent').length}; закъснения: ${marks.filter(r=>r.status==='late').length}.`];
 const encouragement=praise.length?'Учителят е добавил похвала. Прочетете я заедно в профила.':submissions.length||attempts.length?'Отделете време да похвалите конкретната завършена работа и да попитате кое е било трудно.':'Попитайте как протича ученето. Липсата на записи не означава липса на усилие.';
 const next=due.length?`Предстоят ${due.length} домашни. Първото е „${due.slice().sort((a,b)=>a.due.localeCompare(b.due))[0].title}“.`:'Няма непредадени домашни със срок през следващите 7 дни.';
 return {since,today,lines,encouragement,next,evidence:{grades:grades.length,submissions:submissions.length,attempts:attempts.length}};
}
export function enrichmentSeedRecords():SchoolRecord[]{const today=schoolToday(),nextMonday=plusDays(today,((8-new Date(today+'T12:00:00Z').getUTCDay())%7)||7);return [
 {id:'eduo-enrichment-v7',kind:'system',version:7},
 {id:'substitutions-'+nextMonday,kind:'substitutions',date:nextMonday,revision:1,createdAt:today+'T08:00:00Z',updatedAt:today+'T08:00:00Z',items:[{day:0,slot:0,subject:'Математика',teacher:'Мария Николова',room:'201',start:'08:00',end:'08:40',reason:'Примерно служебно обучение',status:'covered',cover:'Анна Колева',announcedAt:today+'T08:00:00Z'}]},
 {id:'remark-welcome-v7',kind:'remark',studentId:0,category:'praise',body:'Алекс обясни решението си ясно и помогна на съученик да намери общ знаменател.',createdAt:today+'T08:00:00Z',author:'Мария Николова',revision:1},
 {id:'fee-museum-v7',kind:'fee',title:'Учебно посещение · музей',description:'Примерна такса за транспорт и вход. Това е демонстрационен регистър, без онлайн плащане.',amountCents:1200,due:plusDays(today,10),createdAt:today+'T08:00:00Z',revision:1,charges:Array.from({length:8},(_,studentId)=>({studentId,status:'due'}))},
 {id:'library-fractions-v7',kind:'material',title:'Дроби: от парчето към цялото',subject:'Математика',format:'lesson',status:'published',revision:1,body:'Една идея\nДробта описва равни части от едно цяло. Знаменателят показва общия брой равни части, а числителят — колко вземаме.\n\nОбщ знаменател\nМожем да събираме части с еднакъв размер. При 1/3 + 1/6 превръщаме 1/3 в 2/6.\n\nПример\nШоколад с 6 парчета: две парчета и още едно са 3/6, тоест 1/2.\n\nПровери резултата\n1/3 е по-малко от 1/2. След прибавяне на 1/6 получаваме точно 1/2.\n\nОпитай сам\nНамери 1/4 + 1/2. Обясни защо знаменателите не се събират.',createdAt:today+'T07:00:00Z',author:'Мария Николова'}
];}
export function lessonSlides(title:string,body:string){const paragraphs=body.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean), chunks=paragraphs.length>5?Array.from({length:5},(_,i)=>paragraphs.slice(Math.floor(i*paragraphs.length/5),Math.floor((i+1)*paragraphs.length/5)).join('\n\n')):paragraphs;return [{title,body:'Прочети, помисли и обясни със свои думи.'},...chunks.map((text,i)=>{const [first,...rest]=text.split('\n');return {title:rest.length?first:`Идея ${i+1}`,body:rest.length?rest.join('\n'):first}}),{title:'Провери разбирането си',body:'Коя е основната идея?\nКак би я обяснил с един собствен пример?'}];}
