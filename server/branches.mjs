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
import {createDeviceStore} from './devices.mjs';
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
  const payg=record.plan==='payg';
  const credits=Number.isSafeInteger(record.credits)&&record.credits>=0?record.credits:0;
  const active=payg?(status==='active'&&credits>0):(status==='active'&&!!expiresAt&&Number.isFinite(Date.parse(expiresAt))&&Date.parse(expiresAt)>now.getTime());
  return {status:payg?(status==='paused'?'paused':status!=='active'?'pending':active?'active':'out-of-credits'):active?'active':status==='paused'?'paused':status==='pending'?'pending':'expired',active,
    expiresAt:payg?null:expiresAt,plan:typeof record.plan==='string'?record.plan:'starter',
    credits:payg?credits:null,creditUnit:payg?'signed-url-issuance':null,
    daysLeft:payg?null:active?Math.max(0,Math.ceil((Date.parse(expiresAt)-now.getTime())/86400000)):0};
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
    const devices=createDeviceStore({filePath:join(folder,'devices.json')});
    await devices.load();
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
      slug:row.slug,analytics,devices,
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
  function authorizeLogin(slug,loginName,code){
    if(typeof loginName!=='string'||typeof code!=='string'||code.length>200)return false;
    const row=registry.get(slug);
    if(!row||!row.loginName||!row.loginSalt||!row.loginHash||row.loginName!==loginName)return false;
    return timingSafeEqual(Buffer.from(safeHash(code,row.loginSalt),'hex'),Buffer.from(row.loginHash,'hex'));
  }
  function list(){return [...registry.values()].map(({slug,name,createdAt,subscription,loginName,payg})=>({slug,name,createdAt,loginName:loginName||null,subscription:subscriptionState(subscription?{...subscription,credits:payg?.balance??0}:subscription)}));}
  function subscription(slug,now=new Date()){
    const row=registry.get(validateBranchSlug(slug));
    if(!row)throw Object.assign(Error('Салбар олдсонгүй.'),{code:404});
    return subscriptionState(row.subscription?{...row.subscription,credits:row.payg?.balance??0}:row.subscription,now);
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
    if(input.plan!=null&&!['starter','pro','enterprise','payg'].includes(input.plan))throw Object.assign(Error('Багц буруу.'),{code:400});
    if(input.note!=null&&(typeof input.note!=='string'||input.note.length>160))throw Object.assign(Error('Тэмдэглэл хэт урт.'),{code:400});
    const expiresAt=input.expiresAt!=null?parseEndDate(input.expiresAt):null;
    const work=writes.catch(()=>{}).then(async()=>{
      const row=registry.get(slug);
      if(!row)throw Object.assign(Error('Салбар олдсонгүй.'),{code:404});
      const old=row.subscription||{status:'pending',expiresAt:null,plan:'starter'};
      const next={status:input.status||'active',plan:input.plan||old.plan||'starter',
        expiresAt:expiresAt||old.expiresAt||null,updatedAt:at};
      if(next.status==='active'&&next.plan!=='payg'&&!next.expiresAt)throw Object.assign(Error('Эрхийн дуусах огноо шаардлагатай.'),{code:400});
      const event={at,action:next.status==='paused'?'paused':'granted',status:next.status,
        plan:next.plan,expiresAt:next.expiresAt,note:typeof input.note==='string'?input.note.trim():''};
      const replacement={...row,subscription:next,subscriptionHistory:[...(row.subscriptionHistory||[]),event].slice(-150)};
      const all=[...registry.values()].map(v=>v.slug===slug?replacement:v);
      await atomicWrite(registryFile,{version:1,branches:all});
      registry.set(slug,replacement);
      return subscriptionState({...next,credits:row.payg?.balance??0},new Date(at));
    });
    writes=work.then(()=>{},()=>{});
    return work;
  }
  function creditHistory(slug){
    const row=registry.get(validateBranchSlug(slug));
    if(!row)throw Object.assign(Error('Салбар олдсонгүй.'),{code:404});
    return [...(row.payg?.events||[])].slice(-100);
  }
  function paygStatus(slug){
    const row=registry.get(validateBranchSlug(slug));
    if(!row)throw Object.assign(Error('Салбар олдсонгүй.'),{code:404});
    return {enabled:row.subscription?.plan==='payg',balance:row.payg?.balance??0,spent:row.payg?.spent??0,unit:'signed-url-issuance'};
  }
  // Mutations are serialized and durably written before confirming to the caller.
  // This is an INTERNAL per-signed-URL allowance ledger. It is not ElevenLabs'
  // actual metered provider credit balance or billed minutes.
  async function changePayg(slug,action,{amount=1,note='',eventId}={}){
    validateBranchSlug(slug);
    if(action==='topup'&&(!Number.isSafeInteger(amount)||amount<1||amount>100000))throw Object.assign(Error('Кредит 1–100000 хооронд байна.'),{code:400});
    if(typeof note!=='string'||note.length>160)throw Object.assign(Error('Тэмдэглэл буруу.'),{code:400});
    const work=writes.catch(()=>{}).then(async()=>{
      const row=registry.get(slug);
      if(!row)throw Object.assign(Error('Салбар олдсонгүй.'),{code:404});
      const payg=row.payg||{balance:0,spent:0,events:[]};
      if(action==='reserve'&&(row.subscription?.plan!=='payg'||row.subscription?.status!=='active'||payg.balance<1))
        throw Object.assign(Error('PAYG кредит хүрэлцэхгүй эсвэл эрх идэвхгүй.'),{code:402});
      if(action==='refund'&&(!eventId||!(payg.events||[]).some(x=>x.id===eventId&&x.action==='reserve')))
        throw Object.assign(Error('Буцаах эрхийн бүртгэл олдсонгүй.'),{code:400});
      if(action==='refund'&&(payg.events||[]).some(x=>x.action==='refund'&&x.reversalOf===eventId))
        return {balance:payg.balance,spent:payg.spent,eventId,duplicate:true};
      const nextBalance=action==='topup'?payg.balance+amount:action==='reserve'?payg.balance-1:payg.balance+1;
      if(!Number.isSafeInteger(nextBalance)||nextBalance<0||nextBalance>1000000)throw Object.assign(Error('Кредитийн хэмжээ зөвшөөрөгдөхгүй.'),{code:409});
      const nextSpent=action==='reserve'?payg.spent+1:action==='refund'?Math.max(0,payg.spent-1):payg.spent;
      const id=randomBytes(16).toString('hex');
      const event={id,at:new Date().toISOString(),action,amount:action==='topup'?amount:1,note:note.trim(),...(action==='refund'?{reversalOf:eventId}:{})};
      const replacement={...row,payg:{balance:nextBalance,spent:nextSpent,events:[...(payg.events||[]),event].slice(-1000)}};
      await atomicWrite(registryFile,{version:1,branches:[...registry.values()].map(x=>x.slug===slug?replacement:x)});
      registry.set(slug,replacement);
      return {balance:nextBalance,spent:nextSpent,eventId:id};
    });
    writes=work.then(()=>{},()=>{});
    return work;
  }
  async function grantCredits(slug,input){return changePayg(slug,'topup',input);}
  async function consumeCredit(slug){return changePayg(slug,'reserve');}
  async function refundCredit(slug,eventId){return changePayg(slug,'refund',{eventId});}
  async function rotateCredentials(slug,{loginName,loginCode,adminToken}={}){
    validateBranchSlug(slug);
    if(loginName!==undefined&&(typeof loginName!=='string'||!/^[a-z][a-z0-9._-]{2,39}$/.test(loginName)))throw Object.assign(Error('Нэвтрэх нэр буруу.'),{code:400});
    if(loginCode!==undefined&&(typeof loginCode!=='string'||loginCode.length<16||loginCode.length>128))throw Object.assign(Error('Нэвтрэх код 16–128 тэмдэгт байна.'),{code:400});
    if(adminToken!==undefined&&(typeof adminToken!=='string'||adminToken.length<24||adminToken.length>128))throw Object.assign(Error('Админ токен 24–128 тэмдэгт байна.'),{code:400});
    if(loginName===undefined&&loginCode===undefined&&adminToken===undefined)throw Object.assign(Error('Өөрчлөх мэдээлэл алга.'),{code:400});
    const op=writes.catch(()=>{}).then(async()=>{
      const previous=registry.get(slug);
      if(!previous)throw Object.assign(Error('Байгууллага олдсонгүй.'),{code:404});
      const row={...previous};
      if(loginName!==undefined)row.loginName=loginName;
      if(loginCode!==undefined){
        row.loginSalt=randomBytes(16).toString('hex');
        row.loginHash=safeHash(loginCode,row.loginSalt);
      }
      if(adminToken!==undefined){
        row.salt=randomBytes(16).toString('hex');
        row.hash=safeHash(adminToken,row.salt);
      }
      const all=[...registry.values()].map(v=>v.slug===slug?row:v);
      await atomicWrite(registryFile,{version:1,branches:all});
      registry.set(slug,row);
      return {slug,loginName:row.loginName,loginCodeChanged:loginCode!==undefined,adminTokenChanged:adminToken!==undefined};
    });
    writes=op.then(()=>{},()=>{});
    return op;
  }
  async function create({slug,name,loginName='admin'}){
    if(typeof loginName!=='string'||!/^[a-z][a-z0-9._-]{2,39}$/.test(loginName))throw Object.assign(Error('Нэвтрэх нэр 3–40 жижиг латин тэмдэгт байна.'),{code:400});
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
      const loginCode=randomBytes(24).toString('base64url');
      const loginSalt=randomBytes(16).toString('hex');
      const row={slug,name:name.trim(),createdAt:new Date().toISOString(),salt,hash:safeHash(token,salt),loginName,loginSalt,loginHash:safeHash(loginCode,loginSalt)};
      const next=[...registry.values(),row];
      await mkdir(root,{recursive:true});
      await atomicWrite(registryFile,{version:1,branches:next});
      registry.set(slug,row);
      instances.set(slug,await loadInstance(row));
      return {slug,name:row.name,createdAt:row.createdAt,adminToken:token,loginName,loginCode,subscription:subscriptionState(row.subscription)};
    });
    writes=work.then(()=>{},()=>{});
    return work;
  }
  return {load,get,list,create,authorize,authorizeLogin,subscription,history,grantSubscription,rotateCredentials,grantCredits,consumeCredit,refundCredit,creditHistory,paygStatus};
}
