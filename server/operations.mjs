import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
const allowed=new Set(['branch.created','subscription.updated','settings.updated','catalog.updated','inventory.updated','device.enrolled','device.revoked','backup.exported']);
export function createAuditStore({filePath,now=()=>new Date()}){
 let records=[],queue=Promise.resolve(),loaded=false;
 async function load(){
  if(loaded)return;
  try{const doc=JSON.parse(await readFile(filePath,'utf8'));if(doc.version!==1||!Array.isArray(doc.events))throw Error('Bad audit file');records=doc.events;}
  catch(e){if(e.code!=='ENOENT')throw e;}loaded=true;
 }
 async function record(type,branch='default'){
  if(!loaded)throw Error('Not loaded');
  if(!allowed.has(type)||typeof branch!=='string'||!/^(default|[a-z0-9]+(?:-[a-z0-9]+)*)$/.test(branch))throw Error('Invalid audit event');
  const prev=records.at(-1)?.hash||'GENESIS';
  const row={at:now().toISOString(),type,branch,prev};
  row.hash=createHash('sha256').update(JSON.stringify(row)).digest('hex');
  const next=[...records,row].slice(-2000);
  const op=queue.catch(()=>{}).then(async()=>{await mkdir(dirname(filePath),{recursive:true});await writeFile(filePath+'.tmp',JSON.stringify({version:1,events:next}));await rename(filePath+'.tmp',filePath);records=next;});
  queue=op;await op;return row;
 }
 function list({branch,limit=100}={}){
  if(!loaded)throw Error('Not loaded');
  const count=Number.isInteger(limit)?Math.min(500,Math.max(1,limit)):100;
  return records.filter(v=>!branch||v.branch===branch).slice(-count).reverse();
 }
 return {load,record,list};
}
export function organizationReport({branches,legacy,days=30,generatedAt=new Date().toISOString()}){
 const metricKeys=['questionsAsked','verifiedCatalogAnswers','pharmacistReferrals','emergencyEscalations','voiceConnected','voiceFailed','staffRequests','staffRequestsSent'];
 const details=[{slug:'default',name:legacy.name,subscription:{status:'legacy',active:true},analytics:legacy.analytics,devices:legacy.devices},
  ...branches.map(row=>({slug:row.slug,name:row.name,subscription:row.subscription,analytics:row.analytics,devices:row.devices}))];
 const totals=Object.fromEntries(metricKeys.map(k=>[k,0]));
 const rows=details.map(row=>{
  const data=row.analytics.report(days);
  const metrics=Object.fromEntries(metricKeys.map(k=>[k,data.totals[k]||0]));
  for(const k of metricKeys)totals[k]+=metrics[k];
  const devices=row.devices.list();
  return {slug:row.slug,name:row.name,subscription:row.subscription,metrics,
   devices:{total:devices.length,online:devices.filter(d=>d.state==='online').length,offline:devices.filter(d=>d.state==='offline').length}};
 });
 return {kind:'aggregated-operational-counts',generatedAt,days,rows,totals,disclaimer:'Not unique visitors, measured savings, sales, or contractual uptime'};
}
export function slaSnapshot({devices,now=new Date()}){
 const items=devices.flatMap(({slug,store})=>store.list().map(item=>({branch:slug,id:item.id,state:item.state,lastSeenAt:item.lastSeenAt})));
 return {measuredAt:now.toISOString(),deviceCount:items.length,online:items.filter(x=>x.state==='online').length,
 offline:items.filter(x=>x.state==='offline').length,
 slaUptimePercent:null,reason:'No continuous independent historical probe exists; point-in-time heartbeat cannot establish SLA uptime',
 items};
}
