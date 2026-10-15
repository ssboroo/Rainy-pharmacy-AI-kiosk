import test from 'node:test';
import assert from 'node:assert/strict';
import { isWakeGreeting, getWakeRetryDelay, toneForState } from '../src/kiosk-policy.js';

test('recognizes Mongolian greetings on public kiosk',()=>{
  assert.equal(isWakeGreeting('Сайн байна уу?'),true);
  assert.equal(isWakeGreeting('САЙН УУ'),true);
  assert.equal(isWakeGreeting('Байна уу'),false);
  assert.equal(isWakeGreeting('Hello'),false);
});
test('does not activate for unrelated conversation',()=>{
  assert.equal(isWakeGreeting('Парацетамол'),false);
  assert.equal(isWakeGreeting('Энэ эмийн тун хэд вэ'),false);
  assert.equal(isWakeGreeting(''),false);
});
test('does not react to embedded or fake wake words',()=>{
  assert.equal(isWakeGreeting('сайн байна уу сайн байна уу'.repeat(50)),false);
  assert.equal(isWakeGreeting('Сайн байна уу гэдэг бичгийг зааж байна'),false);
});
test('microphone permission rejection requires staff action rather than infinite retry',()=>{
  assert.equal(getWakeRetryDelay('not-allowed',1),null);
  assert.equal(getWakeRetryDelay('service-not-allowed',1),null);
  assert.equal(getWakeRetryDelay('no-speech',1),800);
  assert.equal(getWakeRetryDelay('network',2),4000);
  assert.equal(getWakeRetryDelay('network',20),15000);
});
test('visualization and face states stay bounded',()=>{
  for(const [state,result] of [['listening','attentive'],['speaking','warm'],['connecting','thinking'],['ready','calm'],['emergency','concerned']]){
    assert.equal(toneForState(state),result);
  }
  assert.equal(toneForState('untrusted'),'calm');
});
test('STT rejects low confidence',async()=>{const mod=await import('../src/kiosk-policy.js');assert.equal(mod.acceptVoiceTranscript('Энэ эм ямар үнэтэй вэ',0.8),true);assert.equal(mod.acceptVoiceTranscript('за',0.9),false);assert.equal(mod.acceptVoiceTranscript('Энэ эм ямар үнэтэй вэ',0.2),false);});

test('24/7 access including UTC day crossover and former closing boundary',async()=>{
 const {isBusinessHour}=await import('../src/kiosk-policy.js');
 for(const [iso,expected] of [
 ['2026-10-14T23:59:59Z',true],['2026-10-15T00:00:00Z',true],
 ['2026-10-15T13:59:59Z',true],['2026-10-15T14:00:00Z',true],
 ['2026-10-15T19:00:00Z',true]
 ])assert.equal(isBusinessHour(new Date(iso)),expected,iso);
});

test('generic background sounds never trigger a paid AI conversation',()=>{for(const s of ['hi','hello','байна уу','за','эмийн үнэ','сайн байна уу? гэж хэлсэн','сайн байна уу та юу хайж байна'])assert.equal(isWakeGreeting(s),false,s);});
