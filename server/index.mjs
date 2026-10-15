import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,rename,mkdir,stat} from 'node:fs/promises';
import {timingSafeEqual} from 'node:crypto';
import {createAnalyticsStore,analyticsCSV,metricForAnswer} from './analytics.mjs';
import {createBranchRegistry} from './branches.mjs';
import {createDeviceStore} from './devices.mjs';
import {createAuditStore,organizationReport,slaSnapshot} from './operations.mjs';
import {createBackupManager} from './backups.mjs';
import {createPostgresMirror} from './postgres-mirror.mjs';
import {createOffsiteBackup} from './offsite-backup.mjs';
import {parseInventorySnapshot,applyInventorySnapshot,buildProviderStatus,shouldEscalateVoiceText} from './phase2.mjs';
import {AVATARS,DEFAULT_SETTINGS,DEMO_CATALOG,evaluateQuestion,searchCatalog,normalizeText,validateCatalog,validateSettings,voiceAllowed,voiceConnectionStatus,mergeLegacyDemoCatalog} from './core.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..'),dist=path.join(root,'dist');
const dataDir=path.resolve(process.env.DATA_DIR||path.join(root,'storage'));
const settingsPath=path.join(dataDir,'settings.json');
const catalogPath=path.join(dataDir,'catalog.json');
const analytics=createAnalyticsStore({filePath:path.join(dataDir,'analytics.json')});
const defaultDevices=createDeviceStore({filePath:path.join(dataDir,'devices.json')});
const audit=createAuditStore({filePath:path.join(dataDir,'operations-audit.json')});
const backupManager=createBackupManager({directory:path.join(dataDir,'scheduled-backups'),dataDir});
const db=process.env.DATABASE_URL?createPostgresMirror(process.env.DATABASE_URL):null;
const offsite=createOffsiteBackup({
 endpoint:process.env.BACKUP_S3_ENDPOINT,region:process.env.BACKUP_S3_REGION,urlStyle:process.env.BACKUP_S3_URL_STYLE,
 bucket:process.env.BACKUP_S3_BUCKET,accessKeyId:process.env.BACKUP_S3_ACCESS_KEY_ID,
 secretAccessKey:process.env.BACKUP_S3_SECRET_ACCESS_KEY,encryptionKey:process.env.BACKUP_ENCRYPTION_KEY
});
const operationsState={postgresConnected:false,offsiteLastVerifiedAt:null,offsiteLastKey:null,offsiteError:null,postgresError:null};
const port=Number(process.env.PORT||3000);
const registry=createBranchRegistry({dataDir,defaultSettings:DEFAULT_SETTINGS,defaultCatalog:DEMO_CATALOG});
let settings={...DEFAULT_SETTINGS},catalog=DEMO_CATALOG.map(v=>({...v}));
async function automatedSnapshot(){
  const scrub=ctx=>({
    settings:{...ctx.settings,agentId:''},catalog:ctx.catalog,
    analytics:ctx.analytics.report(90),devices:ctx.devices.list()
  });
  const branches=registry.list().map(row=>({
    slug:row.slug,name:row.name,subscription:row.subscription,
    ...scrub(registry.get(row.slug))
  }));
  const payload={default:scrub(defaultBranch),branches};
  const local=await backupManager.snapshot(payload);
  if(db){
    try{
      await db.sync('default',payload.default);
      for(const item of branches)await db.sync(item.slug,item);
      operationsState.postgresConnected=true;
      operationsState.postgresError=null;
      console.log('PostgreSQL branch shadow sync verified:',branches.length+1,'branches');
    }catch(err){operationsState.postgresConnected=false;operationsState.postgresError=err.message;console.warn('Postgres mirror sync failed:',err.message);}
  }
  if(offsite){
    try{
      const upload=await offsite.save(payload);
      const drill=await offsite.restoreDrill(upload.key);
      operationsState.offsiteLastKey=upload.key;
      operationsState.offsiteLastVerifiedAt=drill.verified?new Date().toISOString():null;
      operationsState.offsiteError=null;
      console.log('Encrypted offsite backup upload/read/decrypt verified:',drill.verified);
    }catch(err){operationsState.offsiteError=err.message;console.warn('Encrypted offsite backup failed:',err.message);}
  }
  return {...local,postgresMirrored:operationsState.postgresConnected,offsiteVerified:!!operationsState.offsiteLastVerifiedAt,offsiteKey:operationsState.offsiteLastKey};
}
async function loadData(){
  await mkdir(dataDir,{recursive:true});
  try{settings=validateSettings(JSON.parse(await readFile(settingsPath,'utf8')),settings);}catch(e){if(e.code!=='ENOENT')console.warn('Settings not loaded:',e.message);}
  try{
    const stored=validateCatalog(JSON.parse(await readFile(catalogPath,'utf8')));
    catalog=mergeLegacyDemoCatalog(stored);
    if(catalog!==stored){
      await writeFile(catalogPath,JSON.stringify(catalog,null,2));
      console.log('Expanded three legacy demo items into 30 unverified examples.');
    }
  }catch(e){if(e.code!=='ENOENT')console.warn('Catalog not loaded:',e.message);}
}
const defaultBranch={
  get settings(){return settings;},
  get catalog(){return catalog;},
  analytics,devices:defaultDevices,
  async updateSettings(input){
    const value=validateInput(()=>validateSettings(input,settings));
    await persist(settingsPath,value);settings=value;
    return value;
  },
  async updateCatalog(input){
    const value=validateInput(()=>validateCatalog(input));
    await persist(catalogPath,value);catalog=value;
    return value;
  }
};
let saves=Promise.resolve();
function persist(filename,value){
  saves=saves.catch(()=>{}).then(async()=>{
    const tmp=filename+'.tmp';
    await writeFile(tmp,JSON.stringify(value,null,2));
    await rename(tmp,filename);
  });
  return saves;
}
function validateInput(fn){try{return fn();}catch(error){error.code=400;throw error;}}
function respond(res,status,data){
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(data));
}
function secured(res){
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Permissions-Policy','camera=(self), microphone=(self), geolocation=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' https://api.elevenlabs.io wss://*.elevenlabs.io https://*.elevenlabs.io; worker-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'");
}
function isAdmin(req){
  const expected=process.env.ADMIN_TOKEN;
  if(!expected||expected.length<24)return false;
  const raw=req.headers.authorization||'';
  if(!raw.startsWith('Bearer '))return false;
  const a=Buffer.from(raw.slice(7)),b=Buffer.from(expected);
  return a.length===b.length&&timingSafeEqual(a,b);
}
async function bodyJson(req,max=6000000){
  if(!String(req.headers['content-type']||'').startsWith('application/json'))throw Object.assign(Error('JSON content-type required'),{code:415});
  let count=0,parts=[];
  for await(const chunk of req){
    count+=chunk.length;
    if(count>max)throw Object.assign(Error('Хүсэлт хэт том байна'),{code:413});
    parts.push(chunk);
  }
  try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw Object.assign(Error('JSON буруу байна'),{code:400});}
}
const requests=new Map();
function limited(req){
  const ip=String(req.socket.remoteAddress||'unknown');
  const now=Date.now();
  const value=requests.get(ip);
  if(!value||now-value.started>60000){requests.set(ip,{started:now,count:1});return false;}
  value.count++;
  return value.count>100;
}
async function external(url,opts){
  const response=await fetch(url,{...opts,signal:AbortSignal.timeout(22000)});
  if(!response.ok)throw Object.assign(Error('AI service unavailable ('+response.status+')'),{code:502});
  return response.json();
}
const agentId=ctx=>ctx.settings.agentId||(ctx===defaultBranch?process.env.ELEVENLABS_AGENT_ID:'')||'';
function voiceEnvironment(ctx){
  // Existing clinic-reviewed default remains unchanged. Newly onboarded branches
  // need an explicit *per-branch* provider-side professional review approval,
  // otherwise a global gate could accidentally activate an unreviewed assistant.
  if(ctx===defaultBranch)return process.env;
  const approved=String(process.env.VOICE_AGENT_APPROVED_BRANCHES||'').split(',')
    .map(x=>x.trim()).filter(Boolean);
  const allowed=process.env.VOICE_AGENT_CLINICAL_APPROVED==='true'&&approved.includes(ctx.slug);
  return {...process.env,VOICE_AGENT_CLINICAL_APPROVED:allowed?'true':'false'};
}
function agentDiagnostics(ctx){
  const status=voiceConnectionStatus(voiceEnvironment(ctx),agentId(ctx));
  return {...status,agentIdMasked:status.agentConfigured?(agentId(ctx).slice(0,6)+'••••'+agentId(ctx).slice(-4)):'',message:!status.agentConfigured?'ElevenLabs Agent ID дутуу.':!status.keyConfigured?'Railway дээр ELEVENLABS_API_KEY дутуу.':!status.clinicalApproved?'Эмийн аюулгүй байдлыг эм зүйч баталгаажуулсны дараа VOICE_AGENT_CLINICAL_APPROVED=true тохируулна.':'Voice Agent яриа эхлүүлэхэд бэлэн.'};
}
async function checkAgentConnection(ctx){
  const status=agentDiagnostics(ctx);
  if(!status.agentConfigured||!status.keyConfigured)return {...status,connected:false,connectionMessage:'Agent ID болон API key-г эхлээд тохируулна.'};
  try{
    const url='https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id='+encodeURIComponent(agentId(ctx));
    const result=await external(url,{headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY}});
    return {...status,connected:typeof result.signed_url==='string',connectionMessage:typeof result.signed_url==='string'?'ElevenLabs API key болон Agent ID холболт зөв. Нийтийн киоск дээр ашиглахын өмнө эм зүйчийн зөвшөөрөл шаардлагатай.':'ElevenLabs signed URL ирсэнгүй.'};
  }catch(error){
    const match=String(error.message).match(/\((\d{3})\)/);
    const code=match?Number(match[1]):null;
    const reason=code===401?'ElevenLabs API key буруу эсвэл хугацаа дууссан.':code===403?'ElevenLabs key-д Agent ашиглах эрх хүрэлцэхгүй.':code===404||code===422?'Agent ID буруу эсвэл Agent олдсонгүй.':code===429?'ElevenLabs хүсэлтийн хязгаар хүрсэн.':'ElevenLabs-тай холбогдож чадсангүй.';
    return {...status,connected:false,providerStatus:code,connectionMessage:reason};
  }
}
async function signedUrl(ctx){
  if(!voiceAllowed(voiceEnvironment(ctx),agentId(ctx)))throw Object.assign(Error('ElevenLabs Agent холболт эсвэл мэргэжлийн аюулгүй байдлын зөвшөөрөл тохируулагдаагүй.'),{code:503});
  const url='https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id='+encodeURIComponent(agentId(ctx));
  const result=await external(url,{headers:{'xi-api-key':process.env.ELEVENLABS_API_KEY}});
  if(typeof result.signed_url!=='string')throw Object.assign(Error('Signed URL олдсонгүй'),{code:502});
  return {signedUrl:result.signed_url};
}
function textFromResponse(result){
  if(typeof result.output_text==='string')return result.output_text;
  return (result.output||[]).flatMap(row=>row.content||[]).filter(v=>v.type==='output_text').map(v=>v.text||'').join(' ');
}
async function vision(image,ctx){
  if(!process.env.OPENAI_API_KEY)throw Object.assign(Error('Зураг таних AI API тохируулаагүй байна.'),{code:503});
  if(typeof image!=='string'||image.length>5600000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image))throw Object.assign(Error('JPEG/PNG/WebP зураг 4 MB-аас бага байх шаардлагатай.'),{code:400});
  const data=await external('https://api.openai.com/v1/responses',{
    method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({
      model:process.env.OPENAI_VISION_MODEL||'gpt-4.1-mini',
      store:false,max_output_tokens:160,
      instructions:'You are OCR only. Identify visible medicine names from packaging exactly as printed. Respond with names and label text only, no advice, indications, diagnosis or dosage. If uncertain, say Unclear.',
      input:[{role:'user',content:[{type:'input_text',text:'Read the product names on this medicine package. No medical advice.'},{type:'input_image',image_url:image,detail:'high'}]}]
    })
  });
  const text=textFromResponse(data).slice(0,800);
  const matched=ctx.catalog.filter(v=>[v.name,...(v.aliases||[])].some(n=>normalizeText(text).includes(normalizeText(n)))).slice(0,5);
  return {recognizedText:text||'Нэрийг тодорхой таньсангүй.',matches:matched,needsConfirmation:true};
}
async function handoff(ctx){
  const hook=process.env.PHARMACIST_WEBHOOK_URL;
  if(!hook)return {sent:false,message:'Эм зүйчид цахимаар мэдэгдэх холболт одоогоор тохируулаагүй. Эмийн сангийн ажилтанд биечлэн хандана уу.'};
  if(!/^https:\/\//.test(hook))throw Object.assign(Error('Webhook HTTPS байх шаардлагатай.'),{code:503});
  const response=await fetch(hook,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'pharmacist_requested',station:ctx.settings.locationName,at:new Date().toISOString()}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Object.assign(Error('Ажилтан дуудах систем хариу өгөөгүй.'),{code:502});
  return {sent:true,message:'Эм зүйчид хүсэлт илгээлээ. Ажилтан ирэх хүртэл хүлээнэ үү.'};
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.ico':'image/x-icon','.png':'image/png'};
async function staticFile(res,pathname){
  const target=pathname==='/'?'/index.html':pathname==='/admin'?'/admin.html':pathname;
  const resolved=path.resolve(dist,'.'+decodeURIComponent(target));
  if(resolved!==dist&&!resolved.startsWith(dist+path.sep)){respond(res,403,{error:'Forbidden'});return;}
  try{
    const info=await stat(resolved);
    if(!info.isFile())throw Error('not a file');
    res.writeHead(200,{'Content-Type':mime[path.extname(resolved)]||'application/octet-stream','Cache-Control':'no-cache'});
    res.end(await readFile(resolved));
  }catch{respond(res,404,{error:'Not found: run npm run build first.'});}
}
async function handle(req,res){
  secured(res);
  if(limited(req))return respond(res,429,{error:'Хэт олон хүсэлт илгээлээ. Түр хүлээнэ үү.'});
  let url;
  try{url=new URL(req.url,'http://localhost');}catch{return respond(res,400,{error:'Invalid URL'});}
  const route=url.pathname;
  const hasBranch=url.searchParams.has('branch');
  let ctx;
  try{
    ctx=hasBranch?registry.get(url.searchParams.get('branch')):defaultBranch;
    const entitlement=hasBranch?registry.subscription(url.searchParams.get('branch')):{status:'active',active:true,expiresAt:null,plan:'legacy'};
    // Branch admins may continue managing the catalog after expiration;
    // however no public AI, inventory, tracking or vision endpoints run.
    if(hasBranch&&!entitlement.active&&route.startsWith('/api/')&&!route.startsWith('/api/admin/')&&route!=='/api/health'&&route!=='/api/bootstrap')
      return respond(res,403,{error:'Салбарын үйлчилгээний эрх идэвхгүй эсвэл хугацаа дууссан. Админтай холбогдоно уу.',subscription:entitlement});
    if(req.method==='GET'&&route==='/api/health')return respond(res,200,{status:'ok',service:'RAINY Pharmacy'});
    if(req.method==='GET'&&route==='/api/bootstrap')return respond(res,200,{
      pharmacyName:ctx.settings.pharmacyName,assistantName:ctx.settings.assistantName,greeting:ctx.settings.greeting,defaultAvatar:ctx.settings.defaultAvatar,accent:ctx.settings.accent,locationName:ctx.settings.locationName,idleTimeoutSec:ctx.settings.idleTimeoutSec??120,resetOnDisconnect:ctx.settings.resetOnDisconnect!==false,logoData:ctx.settings.logoData||'',branchSlug:hasBranch?url.searchParams.get('branch'):'',subscription:entitlement,
      avatars:AVATARS,voiceReady:voiceAllowed(voiceEnvironment(ctx),agentId(ctx)),voiceConfigured:!!(process.env.ELEVENLABS_API_KEY&&agentId(ctx)),visionReady:!!process.env.OPENAI_API_KEY,staffReady:!!process.env.PHARMACIST_WEBHOOK_URL,
      demoMode:ctx.catalog.some(v=>!v.verified)
    });
    if(req.method==='POST'&&route==='/api/device/heartbeat'){
      const value=await bodyJson(req,500);
      if(!value||typeof value!=='object'||typeof value.id!=='string'||typeof value.token!=='string')
        return respond(res,400,{error:'Device identity missing'});
      return respond(res,200,await ctx.devices.heartbeat(value.id,value.token,value.status));
    }
    if(req.method==='GET'&&route==='/api/integrations/status'){
      return respond(res,200,{services:buildProviderStatus(process.env,agentId(ctx),voiceEnvironment(ctx).VOICE_AGENT_CLINICAL_APPROVED==='true'),subscription:entitlement});
    }
    if(req.method==='POST'&&route==='/api/voice/triage'){
      const value=await bodyJson(req,1500);
      if(typeof value?.text!=='string'||value.text.length>1000)return respond(res,400,{error:'Voice text invalid'});
      // Deterministic redirection only: no recordings or transcripts stored.
      const escalation=shouldEscalateVoiceText(value.text);
      return respond(res,200,{requiresPharmacist:escalation,message:escalation?'Энэ асуудлыг эм зүйч шийдвэрлэнэ. Дуудаарай.':'Ерөнхий мэдээллийг баталгаажсан каталогоос шалгана уу.'});
    }
    if(req.method==='GET'&&route==='/api/catalog')return respond(res,200,{items:searchCatalog(url.searchParams.get('q')||'',ctx.catalog),demoMode:ctx.catalog.some(v=>!v.verified)});
    if(req.method==='GET'&&route==='/api/catalog/names')return respond(res,200,{
      items:ctx.catalog.map(({id,name,aliases})=>({id,name,aliases}))
    });
    if(req.method==='GET'&&route==='/api/catalog/medicine'){
      const id=url.searchParams.get('id');
      if(typeof id!=='string'||id.length>80||!/^[a-zA-Z0-9_-]+$/.test(id))return respond(res,400,{error:'Бүтээгдэхүүний ID буруу.'});
      const item=ctx.catalog.find(x=>x.id===id);
      if(!item)return respond(res,404,{error:'Эмийн мэдээлэл олдсонгүй.'});
      return respond(res,200,{item:{
        id:item.id,name:item.name,category:item.category,form:item.form,
        description:item.description,warnings:item.warnings,storage:item.storage,
        verified:item.verified===true
      }});
    }
    if(req.method==='POST'&&route==='/api/analytics/event'){
      const value=await bodyJson(req,350);
      // Public events contain a fixed enum only. Never record a question, identity, drug name or transcript.
      if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==1||typeof value.event!=='string'){
        return respond(res,400,{error:'Зөвхөн зөвшөөрөгдсөн event нэрийг илгээнэ.'});
      }
      try{await ctx.analytics.recordPublic(value.event);}
      catch(error){if(error.message==='Invalid public event.')return respond(res,400,{error:'Event нэр зөвшөөрөгдөөгүй.'});throw error;}
      return respond(res,200,{recorded:true});
    }
    if(req.method==='POST'&&route==='/api/ask'){
      const value=await bodyJson(req,4000);
      if(typeof value.question!=='string'||value.question.length>500)return respond(res,400,{error:'Асуултын урт буруу.'});
      const answer=evaluateQuestion(value.question,ctx.catalog);
      await ctx.analytics.recordInternal(metricForAnswer(answer));
      return respond(res,200,answer);
    }
    if(req.method==='POST'&&route==='/api/vision'){
      const value=await bodyJson(req);
      if(value.consent!==true)return respond(res,400,{error:'Зургийг AI-д илгээх зөвшөөрөл шаардлагатай.'});
      await ctx.analytics.recordInternal(['visionAttempts']);
      const result=await vision(value.image,ctx);
      if(result.matches?.length)await ctx.analytics.recordInternal(['visionRecognitions']);
      return respond(res,200,result);
    }
    if(req.method==='POST'&&route==='/api/handoff'){
      await ctx.analytics.recordInternal(['staffRequests']);
      const result=await handoff(ctx);
      if(result.sent)await ctx.analytics.recordInternal(['staffRequestsSent']);
      return respond(res,200,result);
    }
    if(req.method==='GET'&&route==='/api/agent/signed-url')return respond(res,200,await signedUrl(ctx));
    if(route.startsWith('/api/admin/')){
      // The platform token manages the legacy/default instance and branch creation.
      // Each new branch has a separate randomly generated admin token that cannot
      // read or modify another branch's settings, catalog or analytics.
      const bearer=String(req.headers.authorization||'').startsWith('Bearer ')
        ?String(req.headers.authorization).slice(7):'';
      if(!hasBranch && (!process.env.ADMIN_TOKEN||process.env.ADMIN_TOKEN.length<24))
        return respond(res,503,{error:'ADMIN_TOKEN тохируулаагүй.'});
      let branchLoginAuthorized=false;
      if(hasBranch&&String(req.headers.authorization||'').startsWith('Basic ')){
        try{
          const raw=Buffer.from(String(req.headers.authorization).slice(6),'base64').toString('utf8');
          const separator=raw.indexOf(':');
          if(separator>0)branchLoginAuthorized=registry.authorizeLogin(url.searchParams.get('branch'),raw.slice(0,separator),raw.slice(separator+1));
        }catch{}
      }
      const authorized=hasBranch?(registry.authorize(url.searchParams.get('branch'),bearer)||branchLoginAuthorized):isAdmin(req);
      if(!authorized)return respond(res,401,{error:'Зөвшөөрөлгүй.'});
      if(route==='/api/admin/subscription'){
        if(req.method==='GET')return respond(res,200,{subscription:entitlement,history:hasBranch?registry.history(url.searchParams.get('branch')):[]});
      }
      if(route==='/api/admin/organization/storage'&&req.method==='GET'){
        if(hasBranch)return respond(res,403,{error:'Зөвхөн төв админ.'});
        return respond(res,200,{postgresConfigured:!!db,postgresMirrorConnected:operationsState.postgresConnected,
          postgresStatus:operationsState.postgresError?'unavailable':'connected-or-pending',
          postgresRole:'shadow-mirror-not-primary',offsiteConfigured:!!offsite,
          offsiteLastVerifiedAt:operationsState.offsiteLastVerifiedAt,
          lastOffsiteError:operationsState.offsiteError?'Last backup check failed':null});
      }
      if(route==='/api/admin/organization/backups'&&req.method==='GET'){
        if(hasBranch)return respond(res,403,{error:'Зөвхөн төв админ.'});
        return respond(res,200,{files:await backupManager.list(),location:'local-volume',
          offsiteConfigured:!!offsite,offsiteReplicated:!!operationsState.offsiteLastVerifiedAt,offsiteVerified:!!operationsState.offsiteLastVerifiedAt,
          offsiteLastVerifiedAt:operationsState.offsiteLastVerifiedAt,
          postgresMirrorConnected:operationsState.postgresConnected,livePrimary:'existing-file-store',
          restoreTested:!!operationsState.offsiteLastVerifiedAt});
      }
      if(route==='/api/admin/organization/backups/file'&&req.method==='GET'){
        if(hasBranch)return respond(res,403,{error:'Зөвхөн төв админ.'});
        const result=await backupManager.verify(url.searchParams.get('filename'));
        return respond(res,200,result);
      }
      if(route==='/api/admin/organization/backups/create'&&req.method==='POST'){
        if(hasBranch)return respond(res,403,{error:'Зөвхөн төв админ.'});
        const result=await automatedSnapshot();
        return respond(res,201,{backup:result,offsiteVerified:result.offsiteVerified});
      }
      if(route==='/api/admin/organization/report'&&req.method==='GET'){
        if(hasBranch)return respond(res,403,{error:'Төв админ шаардлагатай.'});
        const window=[7,30,90].includes(Number(url.searchParams.get('days')))?Number(url.searchParams.get('days')):30;
        return respond(res,200,organizationReport({days:window,
          legacy:{name:settings.pharmacyName,analytics,devices:defaultDevices},
          branches:registry.list().map(row=>({...row,analytics:registry.get(row.slug).analytics,devices:registry.get(row.slug).devices}))}));
      }
      if(route==='/api/admin/organization/sla'&&req.method==='GET'){
        if(hasBranch)return respond(res,403,{error:'Төв админ шаардлагатай.'});
        return respond(res,200,slaSnapshot({devices:[{slug:'default',store:defaultDevices},...registry.list().map(v=>({slug:v.slug,store:registry.get(v.slug).devices}))]}));
      }
      if(route==='/api/admin/audit'&&req.method==='GET'){
        if(hasBranch)return respond(res,200,{events:audit.list({branch:url.searchParams.get('branch')||''}) .filter(v=>v.branch===url.searchParams.get('branch'))});
        return respond(res,200,{events:audit.list({limit:200})});
      }
      if(route==='/api/admin/branches/subscription'){
        if(hasBranch)return respond(res,403,{error:'Зөвхөн төв админ эрх сунгана.'});
        if(req.method==='PUT'){
          const input=await bodyJson(req,2000);
          if(!input||typeof input!=='object'||typeof input.slug!=='string')return respond(res,400,{error:'Салбарын код шаардлагатай.'});
          const result=await registry.grantSubscription(input.slug,{
            status:input.status,expiresAt:input.expiresAt,plan:input.plan,note:input.note
          });
          await audit.record('subscription.updated',input.slug);
          return respond(res,200,{subscription:result});
        }
      }
      // Platform owner can configure a particular organization without borrowing its password.
      // Explicit branch slug, small allowlist and server-side owner authorization.
      if(route==='/api/admin/branches/config'){
        if(hasBranch)return respond(res,403,{error:'Зөвхөн төв админ.'});
        if(req.method==='GET'){
          const slug=url.searchParams.get('slug');
          const branch=registry.get(slug);
          return respond(res,200,{slug,settings:{
            pharmacyName:branch.settings.pharmacyName,assistantName:branch.settings.assistantName,
            agentId:branch.settings.agentId,idleTimeoutSec:branch.settings.idleTimeoutSec??120,
            resetOnDisconnect:branch.settings.resetOnDisconnect!==false
          }});
        }
        if(req.method==='PUT'){
          const input=await bodyJson(req,2400);
          if(!input||typeof input.slug!=='string'||!input.settings||typeof input.settings!=='object'||
             Array.isArray(input.settings)||Object.keys(input.settings).some(k=>!['pharmacyName','assistantName','agentId','idleTimeoutSec','resetOnDisconnect'].includes(k)))
            return respond(res,400,{error:'Байгууллагын тохиргоо буруу.'});
          const branch=registry.get(input.slug);
          const settings=await branch.updateSettings(input.settings);
          await audit.record('settings.updated',input.slug);
          return respond(res,200,{slug:input.slug,settings:{
            pharmacyName:settings.pharmacyName,assistantName:settings.assistantName,
            agentId:settings.agentId,idleTimeoutSec:settings.idleTimeoutSec??120,
            resetOnDisconnect:settings.resetOnDisconnect!==false
          }});
        }
      }
      if(route==='/api/admin/branches'){
        if(hasBranch)return respond(res,403,{error:'Салбарын эрхээр бусад салбарын мэдээлэл харах боломжгүй.'});
        if(req.method==='GET')return respond(res,200,{branches:registry.list()});
        if(req.method==='POST'){
          const input=await bodyJson(req,1500);
          if(!input||typeof input!=='object'||Array.isArray(input)||
            Object.keys(input).some(key=>!['slug','name','loginName'].includes(key)))return respond(res,400,{error:'Салбарын хүсэлт буруу.'});
          const result=await registry.create(input);
          await audit.record('branch.created',result.slug);
          return respond(res,201,{branch:result,notice:'Админ токеныг одоо аюулгүй хадгална уу. Дараа дахин харуулахгүй.'});
        }
      }
      if(req.method==='GET'&&route==='/api/admin/analytics'){
        return respond(res,200,ctx.analytics.report(url.searchParams.get('days')));
      }
      if(req.method==='GET'&&route==='/api/admin/analytics.csv'){
        const report=ctx.analytics.report(url.searchParams.get('days'));
        const csv=analyticsCSV(report);
        res.writeHead(200,{
          'Content-Type':'text/csv; charset=utf-8',
          'Content-Disposition':'attachment; filename="rainy-pharmacy-analytics-'+report.from+'-to-'+report.to+'.csv"',
          'Cache-Control':'no-store',
          'X-Content-Type-Options':'nosniff'
        });
        res.end(csv);
        return;
      }
      if(req.method==='GET'&&route==='/api/admin/voice-status')return respond(res,200,agentDiagnostics(ctx));
      if(req.method==='POST'&&route==='/api/admin/voice-test')return respond(res,200,await checkAgentConnection(ctx));
      if(route==='/api/admin/integrations/status'&&req.method==='GET'){
        return respond(res,200,{services:buildProviderStatus(process.env,agentId(ctx),voiceEnvironment(ctx).VOICE_AGENT_CLINICAL_APPROVED==='true'),voiceDiagnostics:agentDiagnostics(ctx)});
      }
      if(route==='/api/admin/inventory/snapshot'&&req.method==='PUT'){
        const snapshot=parseInventorySnapshot(await bodyJson(req,150000));
        const next=applyInventorySnapshot(ctx.catalog,snapshot);
        await ctx.updateCatalog(next);
        await audit.record('inventory.updated',hasBranch?url.searchParams.get('branch'):'default');
        return respond(res,200,{updated:next.filter((item,i)=>item.verified===true&&snapshot.some(row=>row.id===item.id)).length,
          ignoredUnverified:snapshot.filter(row=>ctx.catalog.some(item=>item.id===row.id&&!item.verified)).length,
          mode:'manual-snapshot',livePOSConnected:false});
      }
      if(route==='/api/admin/devices'){
        if(req.method==='GET')return respond(res,200,{devices:ctx.devices.list()});
        if(req.method==='POST'){
          const value=await bodyJson(req,300);
          if(!value||typeof value.name!=='string')return respond(res,400,{error:'Device name required'});
          const device=await ctx.devices.enroll(value.name);
          await audit.record('device.enrolled',hasBranch?url.searchParams.get('branch'):'default');
          return respond(res,201,{device});
        }
      }
      if(route==='/api/admin/devices/revoke'&&req.method==='POST'){
        const value=await bodyJson(req,300);
        if(!value||typeof value.id!=='string')return respond(res,400,{error:'Device ID required'});
        await ctx.devices.revoke(value.id);
        await audit.record('device.revoked',hasBranch?url.searchParams.get('branch'):'default');
        return respond(res,200,{revoked:true});
      }
      if(route==='/api/admin/backup'&&req.method==='GET'){
        // Portable manual export only. Never export passwords, device tokens,
        // branch authentication hashes or upstream API secrets.
        const snapshot={
          version:1,generatedAt:new Date().toISOString(),
          branch:hasBranch?url.searchParams.get('branch'):'default',
          settings:{...ctx.settings,agentId:''},
          catalog:ctx.catalog,analytics:ctx.analytics.report(90),
          devices:ctx.devices.list(),subscription:entitlement
        };
        await audit.record('backup.exported',hasBranch?url.searchParams.get('branch'):'default');
        return respond(res,200,{backup:snapshot});
      }
      if(req.method==='GET'&&route==='/api/admin/settings')return respond(res,200,{settings:ctx.settings});
      if(req.method==='GET'&&route==='/api/admin/catalog')return respond(res,200,{items:ctx.catalog});
      if(req.method==='PUT'&&route==='/api/admin/settings'){
        const input=await bodyJson(req,305000);
        const value=await ctx.updateSettings(input);
        await audit.record('settings.updated',hasBranch?url.searchParams.get('branch'):'default');
        return respond(res,200,{settings:value});
      }
      if(req.method==='PUT'&&route==='/api/admin/catalog'){
        const input=await bodyJson(req,1000000);
        const value=await ctx.updateCatalog(input);
        await audit.record('catalog.updated',hasBranch?url.searchParams.get('branch'):'default');
        return respond(res,200,{count:value.length});
      }
      return respond(res,404,{error:'Not found'});
    }
    if(route.startsWith('/api/'))return respond(res,404,{error:'Unknown API'});
    if(req.method!=='GET'&&req.method!=='HEAD')return respond(res,405,{error:'Method not allowed'});
    return staticFile(res,route);
  }catch(error){
    const status=error.code>=400&&error.code<600?error.code:500;
    if(status===500)console.error('Server error:',error.message);
    return respond(res,status,{error:status===500?'Серверийн алдаа гарлаа.':error.message});
  }
}
await loadData();
await analytics.load();
await defaultDevices.load();
await registry.load();
await audit.load();
if(db){
 try{await db.init();operationsState.postgresConnected=true;}
 catch(err){operationsState.postgresError=err.message;console.warn('PostgreSQL init pending:',err.message);}
}
// Avoid blocking HTTP startup on external bucket network calls. Reports show
// whether the off-site upload and non-destructive decrypt verification succeeded.
void automatedSnapshot().catch(err=>console.warn('Operational backup unavailable:',err.message));
setInterval(()=>automatedSnapshot().catch(err=>console.warn('Operational backup failed:',err.message)),86400000).unref();
http.createServer(handle).listen(port,'0.0.0.0',()=>console.log('RAINY Pharmacy on port '+port));
