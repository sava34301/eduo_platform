import { enrichmentSeedRecords } from './enrichment-data';
import { featureSeedRecords } from './platform-data';
import { env } from 'cloudflare:workers';
import { seedRecords, type SchoolRecord } from './school-data';
export function db(){if(!env.DB)throw new Error('Хранилището временно не е достъпно. Опитайте отново.');return env.DB;}
function secret(){const key=(env as any).SCHOOL_ENCRYPTION_KEY;if(!key||!/^[0-9a-f]{64}$/i.test(key))throw new Error('Защитеното хранилище още не е конфигурирано.');return key;}
async function key(){return crypto.subtle.importKey('raw',Uint8Array.from(secret().match(/../g)!.map((h:string)=>parseInt(h,16))),'AES-GCM',false,['encrypt','decrypt']);}
export async function encrypt(bytes:Uint8Array,owner:string){const iv=crypto.getRandomValues(new Uint8Array(12));const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(owner)},await key(),bytes as BufferSource));const all=new Uint8Array(12+ct.length);all.set(iv);all.set(ct,12);return all;}
export async function decrypt(bytes:Uint8Array,owner:string){return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12),additionalData:new TextEncoder().encode(owner)},await key(),bytes.slice(12)));}
function b64(bytes:Uint8Array){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);}
export async function stmt(owner:string,record:SchoolRecord){const payload=b64(await encrypt(new TextEncoder().encode(JSON.stringify(record)),owner));return db().prepare('INSERT INTO school_records(owner,id,kind,payload,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET payload=excluded.payload,kind=excluded.kind,updated_at=excluded.updated_at').bind(owner,record.id,record.kind,payload,new Date().toISOString());}
export async function getRecords(owner:string):Promise<SchoolRecord[]>{
 const rows=await db().prepare('SELECT payload FROM school_records WHERE owner=?').bind(owner).all<{payload:string}>();
 if(!rows.results.length){const seed=seedRecords();const statements=await Promise.all(seed.map(async r=>{const payload=b64(await encrypt(new TextEncoder().encode(JSON.stringify(r)),owner));return db().prepare('INSERT OR IGNORE INTO school_records(owner,id,kind,payload,updated_at) VALUES(?,?,?,?,?)').bind(owner,r.id,r.kind,payload,new Date().toISOString())}));await db().batch(statements);return getRecords(owner);}
 const records=await Promise.all(rows.results.map(async row=>JSON.parse(new TextDecoder().decode(await decrypt(Uint8Array.from(atob(row.payload),c=>c.charCodeAt(0)),owner)))));
 if(!records.some(r=>r.id==='eduo-features-v2')||!records.some(r=>r.id==='eduo-enrichment-v7')){const extra=[...(!records.some(r=>r.id==='eduo-features-v2')?featureSeedRecords():[]),...(!records.some(r=>r.id==='eduo-enrichment-v7')?enrichmentSeedRecords():[])];const statements=await Promise.all(extra.map(async r=>{const payload=b64(await encrypt(new TextEncoder().encode(JSON.stringify(r)),owner));return db().prepare('INSERT OR IGNORE INTO school_records(owner,id,kind,payload,updated_at) VALUES(?,?,?,?,?)').bind(owner,r.id,r.kind,payload,new Date().toISOString());}));await db().batch(statements);return getRecords(owner);}
 return records;
}
export async function save(owner:string,record:SchoolRecord,event:string){const audit:SchoolRecord={id:crypto.randomUUID(),kind:'audit',event,targetId:record.id,createdAt:new Date().toISOString()};await db().batch([await stmt(owner,record),await stmt(owner,audit)]);return record;}
export async function getRecord(owner:string,id:string){const row=await db().prepare('SELECT payload FROM school_records WHERE owner=? AND id=?').bind(owner,id).first<{payload:string}>();return row?JSON.parse(new TextDecoder().decode(await decrypt(Uint8Array.from(atob(row.payload),c=>c.charCodeAt(0)),owner))) as SchoolRecord:null;}

// Compare the encrypted value inside the transaction to prevent a stale editor
// from overwriting a newer attendance decision or timetable revision.
export async function recordSnapshot(owner:string,id:string){
 const row=await db().prepare('SELECT payload FROM school_records WHERE owner=? AND id=?').bind(owner,id).first<{payload:string}>();
 return {payload:row?.payload??null,record:row?JSON.parse(new TextDecoder().decode(await decrypt(Uint8Array.from(atob(row.payload),c=>c.charCodeAt(0)),owner))) as SchoolRecord:null};
}
export async function saveGuarded(owner:string,record:SchoolRecord,previousPayload:string|null,event:string,dependency?:{id:string;payload:string}){
 const now=new Date().toISOString();
 const payload=b64(await encrypt(new TextEncoder().encode(JSON.stringify(record)),owner));
 const audit:SchoolRecord={id:crypto.randomUUID(),kind:'audit',event,targetId:record.id,createdAt:now};
 const auditPayload=b64(await encrypt(new TextEncoder().encode(JSON.stringify(audit)),owner));
 const guard=dependency?' AND EXISTS (SELECT 1 FROM school_records AS dependency WHERE dependency.owner=? AND dependency.id=? AND dependency.payload=?)':'';
 const guardArgs=dependency?[owner,dependency.id,dependency.payload]:[];
 const change=previousPayload===null
   ?db().prepare('INSERT OR IGNORE INTO school_records(owner,id,kind,payload,updated_at) SELECT ?,?,?,?,? WHERE 1=1'+guard).bind(owner,record.id,record.kind,payload,now,...guardArgs)
   :db().prepare('UPDATE school_records SET payload=?,updated_at=? WHERE owner=? AND id=? AND payload=?'+guard).bind(payload,now,owner,record.id,previousPayload,...guardArgs);
 const auditChange=db().prepare('INSERT INTO school_records(owner,id,kind,payload,updated_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM school_records WHERE owner=? AND id=? AND payload=?)').bind(owner,audit.id,'audit',auditPayload,now,owner,record.id,payload);
 const results=await db().batch([change,auditChange]);
 return results[0].meta.changes===1;
}
