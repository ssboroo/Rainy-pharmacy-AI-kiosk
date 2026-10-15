import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseIdleGesture,createAvatarIdleDirector,createAvatarAmbientDirector} from '../src/avatar-idle.js';

function fakeClock(){
 let now=0,serial=0;
 const tasks=new Map();
 const set=(fn,delay)=>{const id=++serial;tasks.set(id,{at:now+delay,fn});return id;};
 const clear=id=>tasks.delete(id);
 const advance=ms=>{
  const end=now+ms;let n=0;
  while(true){
   let pending=null,id=null;
   for(const [key,item] of tasks)if(item.at<=end&&(!pending||item.at<pending.at)){pending=item;id=key;}
   if(!pending)break;
   if(++n>200)throw Error('timer loop');
   tasks.delete(id);now=pending.at;pending.fn();
  }
  now=end;
 };
 return {now:()=>now,set,clear,advance,pending:()=>tasks.size};
}
test('idle gestures stay gentle, more varied after a long wait, no immediate repeat',()=>{
 const early=Array.from({length:20},(_,i)=>chooseIdleGesture({quietMs:11000,previous:'',random:()=>i/20}).name);
 assert.ok(early.every(x=>!['yawn','drowsy','stretch'].includes(x)));
 const late=Array.from({length:30},(_,i)=>chooseIdleGesture({quietMs:65000,previous:'',random:()=>i/30}).name);
 assert.ok(late.includes('yawn'));
 assert.ok(late.includes('stretch'));
 assert.ok(late.includes('drowsy'));
 const one=chooseIdleGesture({quietMs:60000,previous:'glance',random:()=>0});
 assert.notEqual(one.name,'glance');
});
test('idle director plays only when awaiting visitor; speaking, interaction and hidden page stop it',()=>{
 const clock=fakeClock(), events=[];
 const director=createAvatarIdleDirector({
  now:clock.now,schedule:clock.set,cancel:clock.clear,random:()=>.12,
  onGesture:name=>events.push('start:'+name),onRest:()=>events.push('rest')
 });
 director.setState('ready');
 clock.advance(12000);
 assert.ok(events.some(x=>x.startsWith('start:')));
 director.setState('speaking');
 assert.equal(events.at(-1),'rest');
 const before=events.filter(x=>x.startsWith('start:')).length;
 clock.advance(95000);
 assert.equal(events.filter(x=>x.startsWith('start:')).length,before);
 director.setState('wake');
 clock.advance(15000);
 assert.ok(events.filter(x=>x.startsWith('start:')).length>before);
 director.touch();
 assert.equal(events.at(-1),'rest');
 director.setVisible(false);
 const paused=events.length;
 clock.advance(60000);
 assert.equal(events.length,paused);
 director.setVisible(true);
 clock.advance(12000);
 assert.ok(events.length>paused);
 director.dispose();
 assert.equal(clock.pending(),0);
});
test('reduced-motion disables timed gestures and re-enabling permits them',()=>{
 const clock=fakeClock(),events=[];
 const director=createAvatarIdleDirector({now:clock.now,schedule:clock.set,cancel:clock.clear,
  random:()=>.5,onGesture:name=>events.push(name),onRest:()=>{}});
 director.setReducedMotion(true);director.setState('ready');clock.advance(70000);
 assert.deepEqual(events,[]);
 director.setReducedMotion(false);clock.advance(15000);
 assert.ok(events.length>0);
 director.dispose();clock.advance(50000);
 assert.equal(clock.pending(),0);
});

test('blink and eyes run independently while ready, listening and speaking, pause when hidden',()=>{
 const clock=fakeClock(),events=[];
 const director=createAvatarAmbientDirector({
  now:clock.now,schedule:clock.set,cancel:clock.clear,random:()=>.5,
  onBlink:on=>events.push({type:'blink',on,time:clock.now()}),
  onGaze:direction=>events.push({type:'gaze',direction,time:clock.now()})
 });
 director.setState('ready');
 clock.advance(9200);
 assert.ok(events.filter(x=>x.type==='blink'&&x.on).length>=2);
 assert.ok(events.filter(x=>x.type==='gaze').length>=3);
 const ready=events.length;
 director.setState('listening');
 clock.advance(6200);
 director.setState('speaking');
 clock.advance(6200);
 assert.ok(events.length>ready+4,'speaking and listening keep subtle eye life');
 director.setVisible(false);
 const hidden=events.length;
 clock.advance(30000);
 assert.equal(events.length,hidden,'hidden tab must stop all timers');
 director.setVisible(true);
 clock.advance(6500);
 assert.ok(events.length>hidden);
 director.setReducedMotion(true);
 const paused=events.length;
 clock.advance(30000);
 assert.equal(events.length,paused);
 director.setReducedMotion(false);
 clock.advance(6500);
 assert.ok(events.length>paused);
 director.dispose();
 assert.equal(clock.pending(),0);
});
test('idle gestures happen at natural 10-20 second intervals and stop during speech',()=>{
 const clock=fakeClock(),gestures=[];
 const director=createAvatarIdleDirector({now:clock.now,schedule:clock.set,cancel:clock.clear,
  random:()=>.9,onGesture:name=>gestures.push({name,time:clock.now()}),onRest:()=>{}});
 director.setState('ready');
 clock.advance(9000);
 assert.equal(gestures.length,0);
 clock.advance(5000);
 assert.equal(gestures.length,1,'first large gesture within 10–14 seconds');
 clock.advance(26000);
 assert.ok(gestures.length>=2,'subsequent gesture within 10–20 seconds');
 director.setState('speaking');
 const count=gestures.length;
 clock.advance(50000);
 assert.equal(gestures.length,count);
 director.dispose();
 assert.equal(clock.pending(),0);
});
test('five avatar SVG variants contain accessible animation targets and CSS selector contract',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {AVATAR_STYLES,avatarMarkup}=await import('../src/avatar-25d.js');
 const css=await readFile(new URL('../src/avatar-25d.css',import.meta.url),'utf8');
 for(const id of Object.keys(AVATAR_STYLES)){
  const svg=avatarMarkup(id,'test-'+id);
  for(const cls of ['avatar25-eyelid','avatar25-gaze','avatar25-float','avatar25-idle-yawn-mouth','avatar25-idle-arm-left','avatar25-idle-arm-right'])assert.ok(svg.includes(cls),id+' missing '+cls);
 }
 for(const key of ['data-ambient-blink','data-ambient-eye','data-idle-gesture="yawn"','data-idle-gesture="stretch"'])assert.ok(css.includes(key), 'missing CSS binding '+key);
});
