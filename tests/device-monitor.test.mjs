import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createDeviceStore} from '../server/devices.mjs';
test('device enrollment uses scoped random tokens and persistent status',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'devices-'));
 let moment=new Date('2026-10-15T06:00:00Z');
 try{
  const store=createDeviceStore({filePath:join(dir,'devices.json'),now:()=>moment});
  await store.load();
  const a=await store.enroll('Лангуу A');
  assert.ok(a.token.length>=32);
  assert.equal(JSON.stringify(store.list()).includes(a.token),false);
  assert.equal(store.authenticate(a.id,a.token),true);
  assert.equal(store.authenticate(a.id,'fake'),false);
  await store.heartbeat(a.id,a.token,{version:'1.0.0',voiceReady:true});
  assert.equal(store.list()[0].state,'online');
  moment=new Date('2026-10-15T06:05:01Z');
  assert.equal(store.list()[0].state,'offline');
  assert.equal(store.list()[0].voiceReady,true);
  const fresh=createDeviceStore({filePath:join(dir,'devices.json'),now:()=>moment});
  await fresh.load();
  assert.equal(fresh.authenticate(a.id,a.token),true);
  assert.equal(fresh.list()[0].state,'offline');
  await fresh.revoke(a.id);
  assert.equal(fresh.authenticate(a.id,a.token),false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('device heartbeat does not accept or persist personal conversation data',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'devices-'));
 try{
  const store=createDeviceStore({filePath:join(dir,'devices.json')});await store.load();
  const a=await store.enroll('Лангуу B');
  await assert.rejects(store.heartbeat(a.id,a.token,{transcript:'patient data'}),/payload/i);
  await store.heartbeat(a.id,a.token,{voiceReady:false,version:'1.2.3'});
  assert.doesNotMatch(JSON.stringify(store.list()),/token|transcript|patient data/i);
 }finally{await rm(dir,{recursive:true,force:true});}
});
