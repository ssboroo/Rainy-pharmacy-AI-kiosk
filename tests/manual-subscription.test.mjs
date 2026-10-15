import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createBranchRegistry,subscriptionState} from '../server/branches.mjs';

test('manual branch subscriptions expire by exact UTC date and never imply payment',()=>{
  const now=new Date('2026-10-15T09:00:00Z');
  assert.equal(subscriptionState({status:'active',expiresAt:'2026-10-16T00:00:00.000Z'},now).active,true);
  assert.equal(subscriptionState({status:'active',expiresAt:'2026-10-15T09:00:00.000Z'},now).active,false);
  assert.equal(subscriptionState({status:'paused',expiresAt:'2027-01-01T00:00:00.000Z'},now).active,false);
  assert.equal(subscriptionState(null,now).active,false);
});
test('platform admin grants, pauses, renews subscription with persistent audit history',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'rainy-sub-'));
  try{
    const reg=createBranchRegistry({dataDir:dir,defaultCatalog:[]});await reg.load();
    const entry=await reg.create({slug:'store-sub',name:'Салбар'});
    assert.equal(reg.subscription('store-sub').active,false);
    const grant=await reg.grantSubscription('store-sub',{expiresAt:'2026-11-15',plan:'pro',note:'manual contract'},'2026-10-15T00:00:00.000Z');
    assert.equal(grant.status,'active');
    assert.equal(grant.expiresAt,'2026-11-15T23:59:59.999Z');
    assert.equal(reg.subscription('store-sub',new Date('2026-10-16T00:00:00Z')).active,true);
    assert.equal(reg.list()[0].subscription.status,'active');
    await reg.grantSubscription('store-sub',{status:'paused',note:'contract hold'},'2026-10-16T00:00:00.000Z');
    assert.equal(reg.subscription('store-sub',new Date('2026-10-16T00:01:00Z')).active,false);
    assert.equal(reg.history('store-sub').length,2);
    assert.equal(JSON.stringify(reg.list()).includes(entry.adminToken),false);
    const again=createBranchRegistry({dataDir:dir,defaultCatalog:[]});await again.load();
    assert.equal(again.history('store-sub').length,2);
    assert.equal(again.subscription('store-sub').status,'paused');
    await assert.rejects(again.grantSubscription('store-sub',{expiresAt:'2026-02-30'}),/огноо/i);
    await assert.rejects(again.grantSubscription('store-sub',{status:'active',expiresAt:'invalid'}),/огноо/i);
  }finally{await rm(dir,{recursive:true,force:true});}
});
