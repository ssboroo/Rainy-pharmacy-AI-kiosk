import test from 'node:test';
import assert from 'node:assert/strict';
import { isWakeGreeting, getWakeRetryDelay, toneForState } from '../src/kiosk-policy.js';

test('recognizes Mongolian greetings on public kiosk',()=>{
  assert.equal(isWakeGreeting('Сайн байна уу?'),true);
  assert.equal(isWakeGreeting('САЙН УУ'),true);
  assert.equal(isWakeGreeting('Байна уу'),true);
  assert.equal(isWakeGreeting('Hello'),true);
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
