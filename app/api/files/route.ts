import { getChatGPTUser } from '@/app/chatgpt-auth';
import { env } from 'cloudflare:workers';
import { encrypt, save } from '@/lib/store';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'Необходим е вход.'},{status:401});
 if(request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Невалидна заявка.'},{status:403});
 try{
 if(Number(request.headers.get('content-length'))>11*1024*1024)return Response.json({error:'Максималният размер е 10 MB.'},{status:413});
 if(!env.BUCKET)throw new Error('storage unavailable');const form=await request.formData();const f=form.get('file');
 if(!(f instanceof File)||!f.size||f.size>10*1024*1024)return Response.json({error:'Изберете файл до 10 MB.'},{status:400});
 const allowed=['application/pdf','image/jpeg','image/png','image/webp','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
 if(!allowed.includes(f.type))return Response.json({error:'Използвайте PDF, DOCX, TXT, JPG, PNG или WebP.'},{status:400});
 const id=crypto.randomUUID();const objectKey=`files/${crypto.randomUUID()}`;const source=new Uint8Array(await f.arrayBuffer());const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',source)),b=>b.toString(16).padStart(2,'0')).join('');const bytes=await encrypt(source,user.userId);
 await env.BUCKET.put(objectKey,bytes,{httpMetadata:{contentType:'application/octet-stream'}});
 const record={id,kind:'file',name:f.name.slice(0,200),size:f.size,mime:f.type,objectKey,sha256,createdAt:new Date().toISOString()};
 try{await save(user.userId,record,'Качен шифрован файл');}catch(e){await env.BUCKET.delete(objectKey);throw e;}
 return Response.json({record:{...record,objectKey:undefined}});
 }catch(e){console.error('upload failed');return Response.json({error:'Файлът не бе качен. Опитайте отново.'},{status:503});}
}
