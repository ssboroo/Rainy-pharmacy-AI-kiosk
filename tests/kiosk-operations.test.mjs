import test from 'node:test';import assert from 'node:assert/strict';
import {isWithinOperatingHours,isUsefulMongolianSpeech} from '../src/kiosk-operations.js';
for(const [time,open] of [['2026-10-14T23:59:00Z',false],['2026-10-15T00:00:00Z',true],['2026-10-15T13:59:59Z',true],['2026-10-15T14:00:00Z',false],['2026-10-14T23:59:59Z',false]]){
 test('Mongolian business hours '+time,()=>assert.equal(isWithinOperatingHours(new Date(time)),open));
}
test('filter background/filler transcripts and retain useful Mongolian speech',()=>{
 for(const x of ['','аа','мм','за','сайн байна уу','hello 123', 'a'.repeat(400)])assert.equal(isUsefulMongolianSpeech(x),false,x);
 for(const x of ['Парацетамол хэд вэ?', 'Эмийн сан хэдэн цаг хүртэл ажилладаг вэ?','Парацетамол байгаа юу'])assert.equal(isUsefulMongolianSpeech(x),true,x);
});
