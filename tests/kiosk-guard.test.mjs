import test from 'node:test';
import assert from 'node:assert/strict';
import {isKioskOpen,createVoiceIssueBudget} from '../server/kiosk-guard.mjs';
const at=(h,m)=>new Date(Date.UTC(2026,9,15,h-8,m));
test('UB business hours 08-22',()=>{assert.equal(isKioskOpen(at(7,59)),false);assert.equal(isKioskOpen(at(8,0)),true);assert.equal(isKioskOpen(at(21,59)),true);assert.equal(isKioskOpen(at(22,0)),false);});
test('signed URL quota per branch',()=>{let n=0;const b=createVoiceIssueBudget({limit:2,windowMs:60000,now:()=>n});assert.equal(b.take('A'),true);assert.equal(b.take('A'),true);assert.equal(b.take('A'),false);assert.equal(b.take('B'),true);n=60001;assert.equal(b.take('A'),true);});
