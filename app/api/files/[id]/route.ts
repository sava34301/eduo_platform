import {getChatGPTUser} from '@/app/chatgpt-auth';
import {getRecord,decrypt} from '@/lib/store';
import {env} from 'cloudflare:workers';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const user=await getChatGPTUser();if(!user)return new Response('Необходим е вход.',{status:401});
 try{const {id}=await params;const file=await getRecord(user.userId,id);if(file?.kind!=='file'||!env.BUCKET)return new Response('Файлът не е намерен.',{status:404});const object=await env.BUCKET.get(file.objectKey);if(!object)return new Response('Файлът не е намерен.',{status:404});const bytes=await decrypt(new Uint8Array(await object.arrayBuffer()),user.userId);return new Response(bytes,{headers:{'Content-Type':file.mime,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}});}catch{return new Response('Файлът временно не е достъпен.',{status:503});}
}
