import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createAuditStore,organizationReport,slaSnapshot} from '../server/operations.mjs';
test('audit only accepts enumerated metadata, persists a hash-linked chain without patient payload',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pharmacy-audit-'));
 try{
  const filePath=join(dir,'audit.json');const a=createAuditStore({filePath});await a.load();
  await a.record('subscription.updated','branch-one');
  await a.record('device.enrolled','branch-one');
  await assert.rejects(a.record('spoken.patient.name','branch-one'),/Invalid/);
  await assert.rejects(a.record('device.enrolled','../other'),/Invalid/);
  const data=JSON.parse(await readFile(filePath,'utf8'));
  assert.equal(data.events[1].prev,data.events[0].hash);
  assert.equal(a.list({branch:'branch-one'}).length,2);
  const b=createAuditStore({filePath});await b.load();
  assert.equal(b.list().length,2);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('owner dashboard totals only aggregated safe counters and device point-in-time status',()=>{
 const mk=(count)=>({report:()=>({totals:{questionsAsked:count,verifiedCatalogAnswers:count-1,pharmacistReferrals:0}})});
 const dv=(state)=>({list:()=>[{id:'device',state,lastSeenAt:null}]});
 const report=organizationReport({legacy:{name:'Default',analytics:mk(2),devices:dv('online')},branches:[{slug:'one',name:'One',subscription:{active:true},analytics:mk(5),devices:dv('offline')}]});
 assert.equal(report.totals.questionsAsked,7);
 assert.equal(report.rows[1].metrics.verifiedCatalogAnswers,4);
 assert.equal(report.rows[1].devices.offline,1);
 const status=slaSnapshot({devices:[{slug:'one',store:dv('online')}]});
 assert.equal(status.slaUptimePercent,null);
 assert.equal(status.online,1);
});
