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
  function list(){
    return [...registry.values()].map(({slug,name,createdAt})=>({slug,name,createdAt}));
  }
  async function create({slug,name}){
    if(!loaded)throw Error('Branch registry not loaded.');
    validateBranchSlug(slug);
    if(typeof name!=='string'||name.trim().length<2||name.length>80){
      throw Object.assign(Error('Салбарын нэр 2–80 тэмдэгт байна.'),{code:400});
    }
    if(registry.has(slug))throw Object.assign(Error('Ийм кодтой салбар байна.'),{code:409});
    if(registry.size>=200)throw Object.assign(Error('Салбарын дээд хэмжээ хүрсэн.'),{code:409});
    const token=randomBytes(32).toString('base64url');
    const salt=randomBytes(16).toString('hex');
    const row={slug,name:name.trim(),createdAt:new Date().toISOString(),salt,hash:safeHash(token,salt)};
    const next=[...registry.values(),row];
    const work=writes.catch(()=>{}).then(async()=>{
      await mkdir(root,{recursive:true});
      await atomicWrite(registryFile,{version:1,branches:next});
    });
    writes=work;await work;
    registry.set(slug,row);
    instances.set(slug,await loadInstance(row));
    return {slug,name:row.name,createdAt:row.createdAt,adminToken:token};
  }
  return {load,get,list,create,authorize};
}
