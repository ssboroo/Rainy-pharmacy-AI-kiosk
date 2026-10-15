import test from 'node:test';
import assert from 'node:assert/strict';
import {isKioskOpen,createVoiceIssueBudget} from '../server/kiosk-guard.mjs';
const at=(h,m)=>new Date(Date.UTC(2026,9,15,h-8,m));
test('kiosk stays open throughout the UB day',async()=>{const {isBusinessHour}=await import('../src/kiosk-policy.js');for(let h=0;h<24;h++)for(const m of [0,59]){assert.equal(isKioskOpen(at(h,m)),true);assert.equal(isBusinessHour(at(h,m)),true);}});
test('signed URL quota per branch',()=>{let n=0;const b=createVoiceIssueBudget({limit:2,windowMs:60000,now:()=>n});assert.equal(b.take('A'),true);assert.equal(b.take('A'),true);assert.equal(b.take('A'),false);assert.equal(b.take('B'),true);n=60001;assert.equal(b.take('A'),true);});
