/** Tenant-scoped, aggregate device presence. Never store microphone, query or patient data. */
import {randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
const hash=(token,salt)=>createHmac('sha256',salt).update(token).digest('hex');
export function createDeviceStore({filePath,now=()=>new Date()}){
 let rows=[],loaded=false,queue=Promise.resolve();
 async function load(){
  if(loaded)return;
  try{const data=JSON.parse(await readFile(filePath,'utf8'));if(!Array.isArray(data.devices))throw Error('Bad device registry');rows=data.devices;}
  catch(e){if(e.code!=='ENOENT')throw e;}loaded=true;
 }
 function requireLoaded(){if(!loaded)throw Error('Not loaded');}
 async function persist(){
  const text=JSON.stringify({version:1,devices:rows});
  const op=queue.catch(()=>{}).then(async()=>{await mkdir(dirname(filePath),{recursive:true});await writeFile(filePath+'.tmp',text);await rename(filePath+'.tmp',filePath);});
  queue=op;await op;
 }
 function authenticate(id,token){
  requireLoaded();if(typeof token!=='string'||token.length>200)return false;
  const device=rows.find(v=>v.id===id&&!v.revoked);
  if(!device)return false;
  return timingSafeEqual(Buffer.from(hash(token,device.salt),'hex'),Buffer.from(device.hash,'hex'));
 }
 function list(){
  requireLoaded();const time=now().getTime();
  return rows.map(({id,name,createdAt,lastSeenAt,version,voiceReady,revoked})=>({
   id,name,createdAt,lastSeenAt:lastSeenAt||null,version:version||null,voiceReady:voiceReady??null,
   state:revoked?'revoked':lastSeenAt&&time-Date.parse(lastSeenAt)<=180000?'online':'offline'
  }));
 }
 async function enroll(name){
  requireLoaded();if(typeof name!=='string'||name.trim().length<2||name.length>70)throw Object.assign(Error('Device name invalid'),{code:400});
  if(rows.filter(x=>!x.revoked).length>=50)throw Object.assign(Error('Device limit reached'),{code:409});
  const token=randomBytes(32).toString('base64url'),salt=randomBytes(16).toString('hex');
  const id=randomBytes(12).toString('hex');
  rows.push({id,name:name.trim(),salt,hash:hash(token,salt),createdAt:now().toISOString()});
  await persist();return {id,name:name.trim(),token};
 }
 async function heartbeat(id,token,payload){
  requireLoaded();
  if(!authenticate(id,token))throw Object.assign(Error('Invalid device credentials'),{code:401});
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).some(k=>!['version','voiceReady'].includes(k))){
   throw Object.assign(Error('Invalid device payload'),{code:400});
  }
  if(payload.version!=null&&(typeof payload.version!=='string'||!(/^[a-zA-Z0-9._-]{1,36}$/).test(payload.version)))
   throw Object.assign(Error('Invalid device payload'),{code:400});
  if(payload.voiceReady!=null&&typeof payload.voiceReady!=='boolean')throw Object.assign(Error('Invalid device payload'),{code:400});
  const item=rows.find(v=>v.id===id);
  item.lastSeenAt=now().toISOString();
  if(payload.version!=null)item.version=payload.version;
  if(payload.voiceReady!=null)item.voiceReady=payload.voiceReady;
  await persist();return {online:true};
 }
 async function revoke(id){
  requireLoaded();const item=rows.find(x=>x.id===id);
  if(!item)throw Object.assign(Error('Device not found'),{code:404});
  item.revoked=true;await persist();
 }
 return {load,enroll,authenticate,heartbeat,revoke,list};
}
