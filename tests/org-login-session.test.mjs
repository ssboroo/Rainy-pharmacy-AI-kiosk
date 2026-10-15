import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createBranchRegistry} from '../server/branches.mjs';
import {DEFAULT_SETTINGS,validateSettings} from '../server/core.mjs';
test('each organization has independent one-time login name and code',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'org-login-'));
 try{
  const a=createBranchRegistry({dataDir:dir,defaultCatalog:[]});await a.load();
  const created=await a.create({slug:'clinic-one',name:'Клиник нэг',loginName:'manager'});
  assert.equal(created.loginName,'manager');
  assert.ok(created.loginCode.length>=32);
  assert.equal(a.authorizeLogin('clinic-one','manager',created.loginCode),true);
  assert.equal(a.authorizeLogin('clinic-one','other',created.loginCode),false);
  assert.equal(a.authorizeLogin('clinic-one','manager','wrong'),false);
  const other=await a.create({slug:'clinic-two',name:'Клиник хоёр',loginName:'manager'});
  assert.equal(a.authorizeLogin('clinic-two','manager',created.loginCode),false);
  assert.equal(JSON.stringify(a.list()).includes(created.loginCode),false);
  const b=createBranchRegistry({dataDir:dir,defaultCatalog:[]});await b.load();
  assert.equal(b.authorizeLogin('clinic-one','manager',created.loginCode),true);
  assert.equal(b.authorizeLogin('clinic-one','manager',other.loginCode),false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('idle session policies are validated and inherited per branch',()=>{
 assert.equal(DEFAULT_SETTINGS.idleTimeoutSec,120);
 assert.equal(DEFAULT_SETTINGS.avatarIdleEnabled,true);
 assert.equal(validateSettings({avatarIdleEnabled:false}).avatarIdleEnabled,false);
 assert.throws(()=>validateSettings({avatarIdleEnabled:'yes'}));
 assert.equal(validateSettings({idleTimeoutSec:45,resetOnDisconnect:false}).idleTimeoutSec,45);
 assert.throws(()=>validateSettings({idleTimeoutSec:0}));
 assert.throws(()=>validateSettings({idleTimeoutSec:1000}));
 assert.throws(()=>validateSettings({resetOnDisconnect:'yes'}));
});
