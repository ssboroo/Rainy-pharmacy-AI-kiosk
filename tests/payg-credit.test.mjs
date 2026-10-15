import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createBranchRegistry} from '../server/branches.mjs';

test('PAYG credit sessions use persistent atomic reservations, isolation, and refund on signing failure',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'rainy-payg-'));
 try{
  const registry=createBranchRegistry({dataDir:dir,defaultCatalog:[]});await registry.load();
  await registry.create({slug:'payg-one',name:'PAYG Нэг'});
  await registry.create({slug:'payg-two',name:'PAYG Хоёр'});
  const one=await registry.grantSubscription('payg-one',{plan:'payg',status:'active'});
  assert.equal(one.plan,'payg');
  assert.equal(one.active,false);
  assert.equal(one.status,'out-of-credits');
  assert.equal(one.credits,0);
  assert.equal((await registry.grantCredits('payg-one',{amount:3,note:'manual prepaid topup'})).balance,3);
  assert.equal(registry.subscription('payg-one').active,true);
  assert.equal(registry.subscription('payg-two').active,false);
  const issued=await Promise.allSettled(Array.from({length:5},()=>registry.consumeCredit('payg-one')));
  assert.equal(issued.filter(x=>x.status==='fulfilled').length,3);
  assert.equal(issued.filter(x=>x.status==='rejected').length,2);
  assert.equal(registry.subscription('payg-one').credits,0);
  const ticket=issued[0].value;
  const refund=await registry.refundCredit('payg-one',ticket.eventId);
  assert.equal(refund.balance,1);
  assert.equal((await registry.refundCredit('payg-one',ticket.eventId)).balance,1,'refund must be idempotent');
  const again=createBranchRegistry({dataDir:dir,defaultCatalog:[]});await again.load();
  assert.equal(again.subscription('payg-one').credits,1,'reboot retains credits');
  assert.equal(again.subscription('payg-two').credits,null);
  assert.equal(again.creditHistory('payg-one').some(x=>x.action==='refund'),true);
  assert.equal(JSON.stringify(again.list()).includes('manual prepaid topup'),false,'note not leaked in list');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('credit rules prevent negative balances, huge topups, and time-based expiry',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'rainy-payg-'));
 try{
  const r=createBranchRegistry({dataDir:dir,defaultCatalog:[]});await r.load();
  await r.create({slug:'payg-three',name:'PAYG Гурав'});
  await r.grantSubscription('payg-three',{status:'active',plan:'payg'});
  await assert.rejects(r.grantCredits('payg-three',{amount:0}));
  await assert.rejects(r.grantCredits('payg-three',{amount:100001}));
  await assert.rejects(r.consumeCredit('payg-three'));
  await r.grantCredits('payg-three',{amount:1});
  assert.equal(r.subscription('payg-three',new Date('2099-05-01')).active,true);
  assert.equal(r.subscription('payg-three',new Date('2099-05-01')).expiresAt,null);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('replayed manual topups cannot double-credit or reuse idempotency keys with different amounts',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'rainy-payg-idem-'));
 try{
  const r=createBranchRegistry({dataDir:dir,defaultCatalog:[]});await r.load();
  await r.create({slug:'idem-one',name:'PAYG бүртгэл'});
  const requestId='70a02d39-baba-4899-940d-9d323d1732a1';
  assert.equal((await r.grantCredits('idem-one',{amount:5,requestId})).balance,5);
  assert.equal((await r.grantCredits('idem-one',{amount:5,requestId})).balance,5);
  await assert.rejects(r.grantCredits('idem-one',{amount:8,requestId}));
  const restart=createBranchRegistry({dataDir:dir,defaultCatalog:[]});await restart.load();
  assert.equal((await restart.grantCredits('idem-one',{amount:5,requestId})).balance,5);
 }finally{await rm(dir,{recursive:true,force:true});}
});
