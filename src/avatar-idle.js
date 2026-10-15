// Lightweight, deterministic policy for decorative waiting gestures.
// No camera analysis, patient transcript, audio recording, or network request.
const ACTIONS=Object.freeze({
 glance:{name:'glance',durationMs:1900,minimumQuietMs:9000},
 curious:{name:'curious',durationMs:2300,minimumQuietMs:10000},
 sway:{name:'sway',durationMs:2100,minimumQuietMs:11000},
 stretch:{name:'stretch',durationMs:3100,minimumQuietMs:28000},
 drowsy:{name:'drowsy',durationMs:2600,minimumQuietMs:35000},
 yawn:{name:'yawn',durationMs:3200,minimumQuietMs:45000}
});
function unit(value){return Number.isFinite(value)?Math.min(.999999,Math.max(0,value)):0;}
export function chooseIdleGesture({quietMs=0,previous='',random=Math.random}={}){
 const candidates=Object.values(ACTIONS).filter(x=>quietMs>=x.minimumQuietMs&&x.name!==previous);
 const pool=candidates.length?candidates:Object.values(ACTIONS).filter(x=>quietMs>=x.minimumQuietMs);
 return pool[Math.floor(unit(random())*pool.length)]||ACTIONS.glance;
}
export function createAvatarIdleDirector({now=()=>Date.now(),schedule=setTimeout,cancel=clearTimeout,
 random=Math.random,onGesture=()=>{},onRest=()=>{}}={}){
 let state='loading',visible=true,reducedMotion=false,disposed=false;
 let timer=null,gesture=null,previous='',lastInteraction=now();
 const allowed=()=>!disposed&&visible&&!reducedMotion&&(state==='ready'||state==='wake');
 const stopTimer=()=>{if(timer!==null){cancel(timer);timer=null;}};
 const rest=()=>{if(gesture!==null){gesture=null;onRest();}};
 function plan(){
  stopTimer();
  if(!allowed())return;
  const quiet=Math.max(0,now()-lastInteraction);
  const delay=quiet<10000?10000-quiet+Math.floor(unit(random())*4000):10000+Math.floor(unit(random())*10000);
  timer=schedule(()=>{
    timer=null;
    if(!allowed())return;
    const action=chooseIdleGesture({quietMs:Math.max(0,now()-lastInteraction),previous,random});
    previous=action.name;gesture=action.name;
    onGesture(action.name);
    timer=schedule(()=>{timer=null;rest();plan();},action.durationMs);
  },Math.max(1,delay));
 }
 function touch(){
  if(disposed)return;
  lastInteraction=now();
  stopTimer();rest();plan();
 }
 function setState(next){
  if(disposed||next===state)return;
  state=next;
  stopTimer();rest();
  if(allowed()){lastInteraction=now();plan();}
 }
 function setVisible(next){
  if(disposed||visible===Boolean(next))return;
  visible=Boolean(next);
  stopTimer();rest();
  if(allowed()){lastInteraction=now();plan();}
 }
 function setReducedMotion(next){
  if(disposed||reducedMotion===Boolean(next))return;
  reducedMotion=Boolean(next);
  stopTimer();rest();
  if(allowed()){lastInteraction=now();plan();}
 }
 function dispose(){if(disposed)return;disposed=true;stopTimer();rest();}
 // Arm only when the owning avatar becomes visible and rendered.
 return {touch,setState,setVisible,setReducedMotion,dispose};
}


// Separate ambient animation director. Unlike large waiting gestures, blinking and
// occasional eye motion continue while speaking/listening (but never while hidden
// or with reduced-motion preference). Scheduling is cancellation-safe.
export function createAvatarAmbientDirector({
 now=()=>Date.now(),schedule=setTimeout,cancel=clearTimeout,random=Math.random,
 onBlink=()=>{},onGaze=()=>{}
}={}){
 let state='loading',visible=true,reducedMotion=false,disposed=false;
 let blinkTimer=null,closeTimer=null,gazeTimer=null,lastGaze='center';
 const active=()=>!disposed&&visible&&!reducedMotion&&state!=='loading'&&state!=='emergency';
 const clear=()=>{
  for(const key of ['blinkTimer','closeTimer','gazeTimer']){
   const id={blinkTimer,closeTimer,gazeTimer}[key];
   if(id!==null)cancel(id);
  }
  blinkTimer=null;closeTimer=null;gazeTimer=null;
 };
 function pause(){
  clear();
  // Clear visuals once, not on every hidden tick.
  onBlink(false);onGaze('center');lastGaze='center';
 }
 function scheduleBlink(){
  if(!active())return;
  blinkTimer=schedule(()=>{
   blinkTimer=null;if(!active())return;
   onBlink(true);
   closeTimer=schedule(()=>{
    closeTimer=null;
    if(!active())return;
    onBlink(false);
    scheduleBlink();
   },170);
  },2800+Math.floor(unit(random())*2700));
 }
 function scheduleGaze(){
  if(!active())return;
  gazeTimer=schedule(()=>{
   gazeTimer=null;if(!active())return;
   const choices=['left','right','up','down','center'].filter(x=>x!==lastGaze);
   lastGaze=choices[Math.floor(unit(random())*choices.length)];
   onGaze(lastGaze);
   scheduleGaze();
  },1200+Math.floor(unit(random())*1800));
 }
 function restart(){
  clear();
  if(!active()){pause();return;}
  scheduleBlink();scheduleGaze();
 }
 function setState(next){if(disposed||state===next)return;state=next;restart();}
 function setVisible(next){if(disposed||visible===Boolean(next))return;visible=Boolean(next);restart();}
 function setReducedMotion(next){if(disposed||reducedMotion===Boolean(next))return;reducedMotion=Boolean(next);restart();}
 function dispose(){if(disposed)return;disposed=true;pause();}
 return {setState,setVisible,setReducedMotion,dispose};
}
