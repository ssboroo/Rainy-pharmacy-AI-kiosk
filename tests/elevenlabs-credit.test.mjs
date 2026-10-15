import test from 'node:test';
import assert from 'node:assert/strict';
import {createElevenLabsCreditMonitor,normalizeElevenLabsSubscription} from '../server/elevenlabs-credit.mjs';

test('normalizes workspace included quota without implying purchased PAYG top-ups',()=>{
 const view=normalizeElevenLabsSubscription({tier:'creator',status:'active',character_count:2400,character_limit:10000,
  next_character_count_reset_unix:1792704000,current_overage:{amount:'0',currency:'usd'}},'2026-10-15T15:00:00.000Z');
 assert.equal(view.included.used,2400);
 assert.equal(view.included.limit,10000);
 assert.equal(view.included.remaining,7600);
 assert.equal(view.scope,'shared-workspace');
 assert.equal(view.paygBalanceAvailable,false);
 assert.ok(view.paygNote.includes('PAYG'));
 assert.equal(JSON.stringify(view).includes('current_overage'),false);
});
test('rejects malformed provider numbers, never fabricates remaining credits',()=>{
 const a=normalizeElevenLabsSubscription({tier:'trial',character_count:-6,character_limit:'1000'},'2026-10-15T00:00:00Z');
 assert.equal(a.included,null);
 const b=normalizeElevenLabsSubscription({character_count:1200,character_limit:1000},'2026-10-15T00:00:00Z');
 assert.equal(b.included.remaining,0);
});
test('credit monitor caches and coalesces requests, and reads new credit after expiry',async()=>{
 let now=0,calls=0,limit=1000;
 const monitor=createElevenLabsCreditMonitor({
  key:()=> 'test-key',now:()=>now,ttlMs:30000,
  fetchImpl:async()=>{calls++;return {ok:true,json:async()=>({status:'active',tier:'starter',character_count:150,character_limit:limit})};}
 });
 const [a,b]=await Promise.all([monitor.get(),monitor.get()]);
 assert.equal(calls,1);
 assert.deepEqual(a,b);
 assert.equal(a.included.remaining,850);
 now=29000;
 assert.equal((await monitor.get()).included.remaining,850);
 assert.equal(calls,1);
 limit=5000;now=31000;
 assert.equal((await monitor.get()).included.remaining,4850);
 assert.equal(calls,2);
});
test('missing key and provider errors do not leak keys or masquerade as zero balance',async()=>{
 const unconfigured=createElevenLabsCreditMonitor({key:()=>''});
 const zero=await unconfigured.get();
 assert.equal(zero.ok,false);
 assert.equal(zero.included,null);
 assert.equal(zero.reason,'not-configured');
 let calls=0,now=0;
 const failed=createElevenLabsCreditMonitor({key:()=> 'very-secret',now:()=>now,
  fetchImpl:async()=>{calls++;return {ok:false,status:403,json:async()=>({detail:'very-secret'})};}
 });
 const one=await failed.get();
 assert.equal(one.ok,false);
 assert.equal(one.reason,'permission-denied');
 assert.equal(JSON.stringify(one).includes('very-secret'),false);
 now=2000;await failed.get();assert.equal(calls,1);
});

test('PAYG billing remains provider-managed when included credits run out',()=>{
 const view=normalizeElevenLabsSubscription({character_count:1000,character_limit:1000});
 assert.equal(view.included.remaining,0);
 assert.equal(view.localQuotaEnforced,false);
 assert.equal(view.apiUsageSupported,true);
 assert.equal(view.billingMode,'provider-managed');
 assert.equal(view.paygBalanceAvailable,false);
});
