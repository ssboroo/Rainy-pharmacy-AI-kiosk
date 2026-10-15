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
  const delay=quiet<9000?9000-quiet:5500+Math.floor(unit(random())*6500);
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
