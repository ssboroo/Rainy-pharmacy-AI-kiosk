/**
 * Multi-pharmacy branches with independent data and administrator credentials.
 * Existing legacy default branch is not migrated, moved or overwritten.
 * New branches live under DATA_DIR/branches/{slug}, each with own files and counters.
 * Registry stores only salted hashes of random one-time admin tokens.
 */
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import {createAnalyticsStore} from './analytics.mjs';
import {DEFAULT_SETTINGS,DEMO_CATALOG,validateSettings,validateCatalog} from './core.mjs';

export function validateBranchSlug(input){
  if(typeof input!=='string'||!(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).test(input)||input.length<3||input.length>40||
    ['admin','api','default','main','root','public','assets','null'].includes(input)){
    throw Object.assign(Error('Салбарын код 3–40 жижиг латин үсэг, тоо, зураас байна.'),{code:400});
  }
  return input;
}
async function atomicWrite(file,data){
  await mkdir(dirname(file),{recursive:true});
  await writeFile(file+'.tmp',JSON.stringify(data,null,2));
  await rename(file+'.tmp',file);
}
const safeHash=(token,salt)=>createHmac('sha256',salt).update(token,'utf8').digest('hex');

const parseEndDate=value=>{
  if(typeof value!=='string'||!(/^\d{4}-\d{2}-\d{2}$/).test(value)||
     new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)
    throw Object.assign(Error('Subscription огноо YYYY-MM-DD форматтай, хүчинтэй огноо байна.'),{code:400});
  return value+'T23:59:59.999Z';
};
export function subscriptionState(subscription,now=new Date()){
  const record=subscription&&typeof subscription==='object'?subscription:{};
  const status=record.status==='active'||record.status==='paused'?record.status:'pending';
  const expiresAt=typeof record.expiresAt==='string'?record.expiresAt:null;
  const active=status==='active'&&!!expiresAt&&Number.isFinite(Date.parse(expiresAt))&&Date.parse(expiresAt)>now.getTime();
  return {status:active?'active':status==='paused'?'paused':status==='pending'?'pending':'expired',active,
    expiresAt,plan:typeof record.plan==='string'?record.plan:'starter',
    daysLeft:active?Math.max(0,Math.ceil((Date.parse(expiresAt)-now.getTime())/86400000)):0};
}


export function createBranchRegistry({dataDir,defaultSettings=DEFAULT_SETTINGS,defaultCatalog=DEMO_CATALOG}){
  if(!dataDir)throw Error('DATA_DIR required.');
  const root=resolve(dataDir),registryFile=join(root,'branches-registry.json');
  const registry=new Map(),instances=new Map();
  let loaded=false,writes=Promise.resolve();

  function safeDir(slug){return join(root,'branches',validateBranchSlug(slug));}
  async function loadInstance(row){
    const folder=safeDir(row.slug);
    let settings=validateSettings({pharmacyName:row.name,agentId:'',logoData:''},{...defaultSettings,agentId:'',logoData:''});
    let catalog=validateCatalog(defaultCatalog);
    try{settings=validateSettings(JSON.parse(await readFile(join(folder,'settings.json'),'utf8')),settings);}
    catch(e){if(e.code!=='ENOENT')throw e;}
    try{catalog=validateCatalog(JSON.parse(await readFile(join(folder,'catalog.json'),'utf8')));}
    catch(e){if(e.code!=='ENOENT')throw e;}
    const analytics=createAnalyticsStore({filePath:join(folder,'analytics.json')});
    await analytics.load();
    let saveQueue=Promise.resolve();
    async function persist(name,value){
      const step=saveQueue.catch(()=>{}).then(async()=>{
        await mkdir(folder,{recursive:true});
        const file=join(folder,name);
        await writeFile(file+'.tmp',JSON.stringify(value,null,2));
        await rename(file+'.tmp',file);
      });
      saveQueue=step;await step;
    }
    const instance={
      slug:row.slug,analytics,
      get settings(){return settings;},
      get catalog(){return catalog;},
      async updateSettings(input){
        const next=validateSettings(input,settings);
        await persist('settings.json',next);
        settings=next;
        return next;
      },
      async updateCatalog(input){
        const next=validateCatalog(input);
        await persist('catalog.json',next);
        catalog=next;
        return next;
      }
    };
    return instance;
  }
  async function load(){
    if(loaded)return;
    let records=[];
    try{
      const content=JSON.parse(await readFile(registryFile,'utf8'));
      if(content?.version!==1||!Array.isArray(content.branches))throw Error('Invalid branches registry.');
      records=content.branches;
    }catch(e){if(e.code!=='ENOENT')throw e;}
    for(const row of records){
      validateBranchSlug(row.slug);
      if(typeof row.hash!=='string'||!(/^[a-f0-9]{64}$/).test(row.hash)||
        typeof row.salt!=='string'||!(/^[a-f0-9]{32}$/).test(row.salt)||registry.has(row.slug)){
        throw Error('Invalid tenant credentials registry.');
      }
      registry.set(row.slug,row);
      instances.set(row.slug,await loadInstance(row));
    }
    loaded=true;
  }
  function get(slug){
    if(!loaded)throw Error('Branch registry not loaded.');
    const key=validateBranchSlug(slug);
    const item=instances.get(key);
    if(!item)throw Object.assign(Error('Салбар олдсонгүй.'),{code:404});
    return item;
  }
  function authorize(slug,token){
    if(typeof token!=='string'||token.length>200)return false;
    const row=registry.get(slug);
    if(!row)return false;
    const candidate=Buffer.from(safeHash(token,row.salt),'hex');
    const expected=Buffer.from(row.hash,'hex');
    return timingSafeEqual(candidate,expected);
  }
  function list(){return [...registry.values()].map(({slug,name,createdAt,subscription})=>({slug,name,createdAt,subscription:subscriptionState(subscription)}));}
  function subscription(slug,now=new Date()){
    const row=registry.get(validateBranchSlug(slug));
    if(!row)throw Object.assign(Error('Салбар олдсонгүй.'),{code:404});
    return subscriptionState(row.subscription,now);
  }
  function history(slug){
    const row=registry.get(validateBranchSlug(slug));
    if(!row)throw Object.assign(Error('Салбар олдсонгүй.'),{code:404});
    return Array.isArray(row.subscriptionHistory)?row.subscriptionHistory.map(x=>({...x})):[];
  }
  async function grantSubscription(slug,input,at=new Date().toISOString()){
    validateBranchSlug(slug);
    if(!input||typeof input!=='object'||Array.isArray(input))throw Object.assign(Error('Эрхийн хүсэлт буруу.'),{code:400});
    if(input.status!=null&&!['active','paused'].includes(input.status))throw Object.assign(Error('Эрхийн төлөв буруу.'),{code:400});
    if(input.plan!=null&&!['starter','pro','enterprise'].includes(input.plan))throw Object.assign(Error('Багц буруу.'),{code:400});
    if(input.note!=null&&(typeof input.note!=='string'||input.note.length>160))throw Object.assign(Error('Тэмдэглэл хэт урт.'),{code:400});
    const expiresAt=input.expiresAt!=null?parseEndDate(input.expiresAt):null;
    const work=writes.catch(()=>{}).then(async()=>{
      const row=registry.get(slug);
      if(!row)throw Object.assign(Error('Салбар олдсонгүй.'),{code:404});
      const old=row.subscription||{status:'pending',expiresAt:null,plan:'starter'};
      const next={status:input.status||'active',plan:input.plan||old.plan||'starter',
        expiresAt:expiresAt||old.expiresAt||null,updatedAt:at};
      if(next.status==='active'&&!next.expiresAt)throw Object.assign(Error('Эрхийн дуусах огноо шаардлагатай.'),{code:400});
      const event={at,action:next.status==='paused'?'paused':'granted',status:next.status,
        plan:next.plan,expiresAt:next.expiresAt,note:typeof input.note==='string'?input.note.trim():''};
      const replacement={...row,subscription:next,subscriptionHistory:[...(row.subscriptionHistory||[]),event].slice(-150)};
      const all=[...registry.values()].map(v=>v.slug===slug?replacement:v);
      await atomicWrite(registryFile,{version:1,branches:all});
      registry.set(slug,replacement);
      return subscriptionState(next,new Date(at));
    });
    writes=work.then(()=>{},()=>{});
    return work;
  }
  async function create({slug,name}){
    if(!loaded)throw Error('Branch registry not loaded.');
    validateBranchSlug(slug);
    if(typeof name!=='string'||name.trim().length<2||name.length>80){
      throw Object.assign(Error('Салбарын нэр 2–80 тэмдэгт байна.'),{code:400});
    }
    // Serialize check + persist + registration to prevent lost branches
    // when platform administrators create two branches simultaneously.
    const work=writes.catch(()=>{}).then(async()=>{
      if(registry.has(slug))throw Object.assign(Error('Ийм кодтой салбар байна.'),{code:409});
      if(registry.size>=200)throw Object.assign(Error('Салбарын дээд хэмжээ хүрсэн.'),{code:409});
      const token=randomBytes(32).toString('base64url');
      const salt=randomBytes(16).toString('hex');
      const row={slug,name:name.trim(),createdAt:new Date().toISOString(),salt,hash:safeHash(token,salt)};
      const next=[...registry.values(),row];
      await mkdir(root,{recursive:true});
      await atomicWrite(registryFile,{version:1,branches:next});
      registry.set(slug,row);
      instances.set(slug,await loadInstance(row));
      return {slug,name:row.name,createdAt:row.createdAt,adminToken:token,subscription:subscriptionState(row.subscription)};
    });
    writes=work.then(()=>{},()=>{});
    return work;
  }
  return {load,get,list,create,authorize,subscription,history,grantSubscription};
}
