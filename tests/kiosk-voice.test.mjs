import test from 'node:test';
import assert from 'node:assert/strict';
import {WakeGreetingListener} from '../src/kiosk-voice.js';
test('wake listener activates on greeting and ignores unrelated speech',async()=>{
  const events=[];
  const instances=[];
  class FakeSpeech{
    start(){this.started=true;}
    abort(){this.stopped=true;}
    constructor(){instances.push(this);}
  }
  const wake=new WakeGreetingListener({SpeechRecognition:FakeSpeech,onWake:s=>events.push(s)});
  wake.enable();
  assert.equal(instances.length,1);
  instances[0].onresult({resultIndex:0,results:[{isFinal:true,0:{transcript:'Ибупрофен'}}]});
  assert.deepEqual(events,[]);
  instances[0].onresult({resultIndex:0,results:[{isFinal:true,0:{transcript:'Сайн байна уу?'}}]});
  await Promise.resolve();await Promise.resolve();
  assert.deepEqual(events,['Сайн байна уу?']);
  assert.equal(instances[0].stopped,true);
  wake.disable();
});
test('stop is idempotent and disables background listening',()=>{
  const fake=[];
  class FakeSpeech{
    constructor(){fake.push(this);}
    start(){}
    abort(){this.aborted=true;}
  }
  const wake=new WakeGreetingListener({SpeechRecognition:FakeSpeech,onWake:()=>{}});
  wake.enable();wake.disable();wake.disable();
  assert.equal(fake.length,1);assert.equal(fake[0].aborted,true);
});
