import { timetable, times, lessonEnds, type SchoolRecord } from './school-data';
import { plusDays, schoolToday } from './platform-data';

export type TimetableLesson = { day:number; slot:number; subject:string; teacher:string; room:string; start:string; end:string };
export const weekdays = ['Понеделник','Вторник','Сряда','Четвъртък','Петък'];
export const timetableSubjects = [...new Set(timetable.flat())];
const teachers:Record<string,string> = {'Математика':'Мария Николова','Български език':'Десислава Иванова','Човекът и природата':'Петър Стоянов','Английски език':'Анна Колева','История и цивилизации':'Иван Тодоров','География и икономика':'Иван Тодоров','Физическо възпитание':'Димитър Колев','Компютърно моделиране':'Елица Георгиева'};
export const defaultTimetable = ():TimetableLesson[] => timetable.flatMap((subjects,day)=>subjects.map((subject,slot)=>({day,slot,subject,teacher:teachers[subject],room:String(201+slot),start:times[slot],end:lessonEnds[slot]})));
export function mondayOf(date:string){const day=new Date(date+'T12:00:00Z').getUTCDay();return plusDays(date,-((day+6)%7))}
export function nextTeachingDate(){const date=schoolToday(),day=new Date(date+'T12:00:00Z').getUTCDay();return day===6?plusDays(date,2):day===0?plusDays(date,1):date}
export function timetableWeek(records:SchoolRecord[],monday:string){const saved=records.find(r=>r.kind==='timetable-week'&&r.week===monday);return {record:saved,version:saved?.version||0,entries:(saved?.entries??defaultTimetable()) as TimetableLesson[]}}
export function lessonsOn(records:SchoolRecord[],date:string){const day=(new Date(date+'T12:00:00Z').getUTCDay()+6)%7;return timetableWeek(records,mondayOf(date)).entries.filter(l=>l.day===day).sort((a,b)=>a.slot-b.slot)}
export const attendanceLabels:Record<string,string>={unmarked:'Не е отбелязано',present:'Присъства',absent:'Отсъства',late:'Закъснение',excused:'Извинено'};
export const explanationLabels:Record<string,string>={pending:'Чака преглед',approved:'Одобрено',rejected:'Върнато за уточнение',cancelled:'Приключено с корекция'};
export function attendanceSubject(record:SchoolRecord,records:SchoolRecord[]){return record.subject||lessonsOn(records,record.date).find(l=>l.slot===record.lesson)?.subject||`${record.lesson+1}. учебен час`}
