import test from 'node:test';
import assert from 'node:assert/strict';
import {createVoiceAttempt,voiceFailureMessage} from '../src/voice-session.js';
test('disconnect before SDK promise settles cannot be adopted as an active session',()=>{
 const a=createVoiceAttempt();assert.equal(a.closed,false);
 const message=a.disconnect({reason:'error',closeCode:1008,closeReason:'ASR override is not allowed'});
 assert.equal(a.closed,true);assert.match(message,/override/);assert.match(message,/1008/);
 assert.equal(a.failure,message);
});
test('intentional stop does not create an error, and invalidates late callbacks',()=>{
 const a=createVoiceAttempt();a.cancel();assert.equal(a.closed,true);assert.equal(a.failure,null);
 assert.equal(a.disconnect({reason:'user'}),null);
});
test('provider credit, configuration and microphone errors have actionable safe messages',()=>{
 assert.match(voiceFailureMessage({message:'quota exceeded'}),/PAYG/);
 assert.match(voiceFailureMessage({message:'prompt override not enabled'}),/override/);
 assert.match(voiceFailureMessage({message:'microphone denied'}),/Микрофон/);
 const a=createVoiceAttempt();assert.ok(a.disconnect({reason:'agent'}));assert.equal(a.closed,true);
 assert.doesNotMatch(voiceFailureMessage({message:'unknown sk_secret payload'}),/sk_secret/);
});
