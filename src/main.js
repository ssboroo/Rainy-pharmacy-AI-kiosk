import {Conversation} from '@elevenlabs/client';
import {ELEVENLABS_WORKLET_PATHS} from './voice-worklets.js';
import {findMedicineMention} from './medicine-panel.js';
import './style.css';
import './kiosk.css';
import './avatar-25d.css';
import './kiosk-finish.css';
import {IllustratedAvatar25D} from './avatar-25d.js';
import {WakeGreetingListener} from './kiosk-voice.js';
import {toneForState,acceptVoiceTranscript} from './kiosk-policy.js';
const $=id=>document.getElementById(id);
const branchSlug=new URLSearchParams(window.location.search).get('branch')||'';
const scopedPath=route=>route+(branchSlug?(route.includes('?')?'&':'?')+'branch='+encodeURIComponent(branchSlug):'');
let medicineNameIndex=[],medicineLastId='',medicineRequestSerial=0;
let config=null,selected='nomi',conversation=null,cameraStream=null,recognition=null,resetTimer=null;
let wakeListener=null,voiceStarting=false,currentVoiceState='ready',visualFrame=0,lastVisualLevel=0;
let lastWakeAt=0;
let avatar25=null,localSessionWanted=false;
let analyticsSessionRecorded=false;
let resettingVisitor=false,visitorEpoch=0;
let voiceCapTimer=null;
const WAKE_STORAGE_KEY='rainy-kiosk-microphone-enabled-v1';
const KIOSK_STORAGE_KEY='rainy-kiosk-immersive-v1';
const byId={nomi:'Таны найрсаг робот туслах',mira:'Таны ухаалаг AI зөвлөх',kiki:'Таны өхөөрдөм AI анд',aria:'Таны дижитал туслах',bobo:'Таны хөөрхөн AI найз'};
async function api(path,opts={}){
  const response=await fetch(scopedPath('/api'+path),{...opts,headers:{'Content-Type':'application/json',...(opts.headers||{})}});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Сервертэй холбогдож чадсангүй.');
  return data;
}
function toast(message){
  const el=$('toast');el.textContent=message;el.hidden=false;
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,5200);
}
// Privacy by design: only a known event enum travels to the analytics endpoint.
// No question text, medicine names, browser identifiers, audio, user info or IP metadata.
function trackAnalytics(event){
  fetch(scopedPath('/api/analytics/event'),{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({event}),cache:'no-store',keepalive:true
  }).catch(()=>{}); // usage statistics must never interrupt pharmacy assistance
}
function markKioskInteraction(){
  if(!analyticsSessionRecorded){
    analyticsSessionRecorded=true;
    trackAnalytics('sessionStarted');
  }
}
async function resetVisitorSession(){
  if(resettingVisitor)return;
  resettingVisitor=true;
  visitorEpoch++;
  clearTimeout(resetTimer);resetTimer=null;
  analyticsSessionRecorded=false;
  try{
    await stopVoice();
    clearMedicineCard();
    closeModal();
    $('conversation').replaceChildren();
    $('questionInput').value='';
    addMessage('assistant',config?.greeting||'Сайн байна уу!');
  }finally{resettingVisitor=false;}
}
function activity(){
  if(resettingVisitor)return;
  avatar25?.notifyActivity();
  clearTimeout(resetTimer);
  const seconds=Number.isInteger(config?.idleTimeoutSec)?config.idleTimeoutSec:120;
  resetTimer=setTimeout(()=>{void resetVisitorSession();},Math.max(30,Math.min(900,seconds))*1000);
}
async function loadMedicineIndex(){
  try{
    const result=await api('/catalog/names');
    medicineNameIndex=Array.isArray(result.items)?result.items:[];
  }catch{medicineNameIndex=[];}
}
function clearMedicineCard(){
  medicineRequestSerial++;
  medicineLastId='';
  $('medicineLiveCard').hidden=true;
}
async function showMedicineForSpeech(line){
  if(typeof line!=='string'||!medicineNameIndex.length)return;
  const mention=findMedicineMention(line,medicineNameIndex);
  if(!mention)return;
  if(mention.id===medicineLastId&&!$('medicineLiveCard').hidden)return;
  medicineLastId=mention.id;
  const serial=++medicineRequestSerial;
  try{
    const {item}=await api('/catalog/medicine?id='+encodeURIComponent(mention.id));
    if(serial!==medicineRequestSerial)return;
    $('medicineLiveName').textContent=item.name;
    $('medicineLiveSource').textContent=item.verified?'Каталогийн баталгаажсан бүртгэл':'Туршилтын / баталгаажаагүй бүртгэл';
    $('medicineLiveForm').textContent=[item.category,item.form].filter(Boolean).join(' · ');
    $('medicineLiveDescription').textContent=item.description||'Ерөнхий тайлбар байхгүй. Эм зүйчээс лавлана уу.';
    $('medicineLiveWarning').textContent=item.warnings?'⚠ '+item.warnings:'⚠ Хэрэглэх заавар, тунг эм зүйчээс лавлана уу.';
    $('medicineLiveCard').hidden=false;
    $('medicineLiveCard').classList.toggle('is-unverified',!item.verified);
  }catch{if(serial===medicineRequestSerial)clearMedicineCard();}
}
function addMessage(role,text){
  if(role==='user'||role==='assistant')void showMedicineForSpeech(text);
  const item=document.createElement('div');item.className='message '+role;
  const mark=document.createElement('span');mark.className='message-mark';mark.textContent=role==='assistant'?'✦':'●';
  const bubble=document.createElement('div');bubble.className='bubble';bubble.textContent=text;
  item.append(mark,bubble);$('conversation').append(item);
  $('conversation').scrollTop=$('conversation').scrollHeight;
  activity();
}
function setStatus(state){
  currentVoiceState=state;
  avatar25?.setState(state);
  const mount=$('avatarMount');
  mount.classList.toggle('speaking',state==='speaking');
  mount.classList.toggle('listening',state==='listening'||state==='wake');
  mount.classList.toggle('thinking',state==='connecting');
  mount.dataset.expression=toneForState(state);
  $('waveform').classList.toggle('active',state==='speaking'||state==='listening'||state==='wake');
  $('statusLabel').textContent=state==='speaking'?'AI туслах ярьж байна':state==='listening'?'Таныг сонсож байна':state==='wake'?'«Сайн байна уу» гэж хэлээрэй':state==='connecting'?'Холбогдож байна':'Танд туслахад бэлэн';
  $('meterLabel').textContent=state==='speaking'?'AI ярьж байна':state==='listening'?'Сонсож байна':state==='wake'?'Мэндчилгээ хүлээж байна':'Танд туслахад бэлэн';
}
function selectAvatar(id){
  const data=config.avatars.find(a=>a.id===id);if(!data)return;
  selected=id;
  avatar25?.setAvatar(id);
  $('avatarMount').className='portrait '+id;
  setStatus(currentVoiceState);
  $('assistantTitle').textContent=id===config.defaultAvatar&&config.assistantName?config.assistantName:data.name;
  $('personaSubtitle').textContent=byId[id];
  document.documentElement.style.setProperty('--avatar-accent',data.color);
  for(const button of $('avatarList').querySelectorAll('button'))button.classList.toggle('selected',button.dataset.avatar===id);
  activity();
}
function renderAvatars(){
  $('avatarList').replaceChildren();
  for(const a of config.avatars){
    const button=document.createElement('button');
    button.className='avatar-option';
    button.dataset.avatar=a.id;
    const visual=document.createElement('span');visual.className='avatar-thumbnail '+a.id;
    visual.innerHTML='<i class="thumb-ears"></i><i class="thumb-head"><b class="thumb-eye eye-one"></b><b class="thumb-eye eye-two"></b><b class="thumb-mouth"></b></i>';
    const text=document.createElement('span');text.className='avatar-text';
    const name=document.createElement('strong');name.textContent=a.name;
    const style=document.createElement('small');style.textContent=a.style;
    text.append(name,style);button.append(visual,text);
    button.onclick=()=>selectAvatar(a.id);
    $('avatarList').append(button);
  }
  selectAvatar(config.defaultAvatar);
}
async function ask(question){
  const q=question.trim();if(q.length<2)return;
  const requestEpoch=visitorEpoch;
  markKioskInteraction();
  $('questionInput').value='';addMessage('user',q);
  try{
    const answer=await api('/ask',{method:'POST',body:JSON.stringify({question:q})});
    if(requestEpoch!==visitorEpoch)return;
    addMessage('assistant',answer.reply);
    if(recognition){const active=recognition;recognition=null;active.onend=null;active.onerror=null;try{active.abort();}catch{};const audible=await speakBrowser(answer.reply);if(!audible)toast('Энэ төхөөрөмжийн Монгол хэлний TTS дэмжлэг хязгаарлагдмал. ElevenLabs Voice Agent-г админ дээр шалгана уу.');if(localSessionWanted&&!conversation)await startLocalVoiceSession(false);}
    if(answer.kind==='emergency')toast('ЯАРАЛТАЙ: Эм зүйчийг дуудаж, шаардлагатай бол 103 руу залгаарай.');
  }catch(e){if(requestEpoch===visitorEpoch)toast(e.message);}
}
function setWave(level) {
  const next=Math.max(0,Math.min(1,Number(level)||0));
  lastVisualLevel=lastVisualLevel*.55+next*.45;
  avatar25?.setLevel(lastVisualLevel);
  const strength=lastVisualLevel;
  $('avatarMount').style.setProperty('--mouth-level',strength.toFixed(3));
  $('avatarMount').style.setProperty('--face-lift',(strength*4).toFixed(2)+'px');
  const bars=$('waveform').querySelectorAll('i');
  bars.forEach((bar,index)=>{
    const phase=Math.abs(Math.sin(index*1.21+performance.now()*.003));
    bar.style.height=(5+Math.round((strength*48+2)*(.22+phase*.78)))+'px';
    bar.style.opacity=(.45+strength*.55).toFixed(2);
  });
  $('voiceHalo').style.opacity=String(.38+strength*.59);
  $('voiceHalo').style.transform='translate(-50%,-50%) scale('+(1+strength*.27).toFixed(3)+')';
}
function startVoiceVisuals(){
  if(visualFrame)return;
  const render=async()=>{
    visualFrame=requestAnimationFrame(render);
    if(!conversation||typeof conversation.getOutputVolume!=='function'){
      setWave(currentVoiceState==='wake'?.06:0);
      return;
    }
    try{
      const output=await Promise.resolve(conversation.getOutputVolume());
      const input=await Promise.resolve(conversation.getInputVolume());
      if(conversation)setWave(currentVoiceState==='speaking'?output:input*.5);
    }catch{setWave(0);}
  };
  visualFrame=requestAnimationFrame(render);
}
function updateMicrophoneUI(){
  const enabled=!!wakeListener?.enabled;
  $('setupMicrophoneBtn').textContent=enabled?'● Микрофон идэвхтэй':'🎙 Микрофон зөвшөөрөх';
  $('setupMicrophoneBtn').classList.toggle('enabled',enabled);
  $('micPrivacy').textContent=enabled?'Мэндчилгээ сонсож байна · Дуу таних үйлчилгээ интернэт ашиглаж болно':'Яриа эхлүүлэхдээ микрофоны зөвшөөрөл олгоно уу';
}
function onWakeState(state){
  if(state==='listening'||state==='retrying'){if(!conversation&&!recognition&&!voiceStarting)setStatus('wake');}
  updateMicrophoneUI();
}
async function speakBrowser(text){
  if(!('speechSynthesis' in window))return;
  const voices=speechSynthesis.getVoices?.()||[];
  const voice=voices.find(v=>v.lang?.toLowerCase().startsWith('mn'));
  if(!voice)console.info('Mongolian browser voice is not installed; default synthesized voice may pronounce Mongolian poorly.');
  return await new Promise(resolve=>{
    const utterance=new SpeechSynthesisUtterance(text);
    if(voice)utterance.voice=voice;
    utterance.lang='mn-MN';utterance.rate=.93;utterance.volume=1;
    let finished=false;
    const finish=ok=>{if(finished)return;finished=true;clearTimeout(limit);resolve(ok);};
    utterance.onstart=()=>{setStatus('speaking');startVoiceVisuals();};
    utterance.onend=()=>finish(true);
    utterance.onerror=()=>finish(false);
    const limit=setTimeout(()=>{try{speechSynthesis.cancel();}catch{}finish(false);},15000);
    try{speechSynthesis.cancel();speechSynthesis.speak(utterance);}catch{finish(false);}
  });
}
function makeWakeListener(){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  wakeListener=new WakeGreetingListener({
    SpeechRecognition,
    onWake:async()=>{
      if(voiceStarting||conversation||recognition)return;
      const now=Date.now();
      if(now-lastWakeAt<3500){wakeListener.resume(2500);return;}
      lastWakeAt=now;
      await startVoice(true);
    },
    onState:onWakeState,
    onFailure:error=>{
      localStorage.removeItem(WAKE_STORAGE_KEY);
      updateMicrophoneUI();
      setStatus('ready');
      toast(error==='unsupported'?'Энэ browser Монгол хэлний дуу танилт дэмжихгүй. Chrome kiosk эсвэл тусгай wake engine шаардлагатай.':'Микрофоны байнгын сонсох горим тасарлаа. Ажилтан дахин зөвшөөрөл өгнө үү.');
    }
  });
  updateMicrophoneUI();
}
async function enableMicFromStaff(){
  if(wakeListener?.enabled){
    wakeListener.disable();localStorage.removeItem(WAKE_STORAGE_KEY);
    await stopVoice(false);updateMicrophoneUI();return;
  }
  if(!(window.SpeechRecognition||window.webkitSpeechRecognition)){
    toast('Автомат мэндчилгээ сонсохын тулд Web Speech Recognition дэмждэг Chrome / Edge шаардлагатай.');return;
  }
  if(!navigator.mediaDevices?.getUserMedia){
    toast('HTTPS эсвэл localhost дээр л микрофон зөвшөөрөх боломжтой.');return;
  }
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
    stream.getTracks().forEach(track=>track.stop());
    localStorage.setItem(WAKE_STORAGE_KEY,'1');
    wakeListener.enable();
    startVoiceVisuals();
    updateMicrophoneUI();
    toast('Бэлэн! Одоо «Сайн байна уу?» гэж хэлээд туслахыг ажиллуулна.');
  }catch(error){toast('Микрофон зөвшөөрөл олгогдсонгүй: '+error.message);}
}
async function restoreMicIfGranted(){
  if(localStorage.getItem(WAKE_STORAGE_KEY)!=='1')return;
  try{
    if(!navigator.permissions?.query)return;
    const permission=await navigator.permissions.query({name:'microphone'});
    if(permission.state==='granted'){wakeListener.enable();startVoiceVisuals();}
    else localStorage.removeItem(WAKE_STORAGE_KEY);
  }catch{ /* No Permissions API support: staff must re-enable from UI. */ }
  updateMicrophoneUI();
}
async function stopVoice(resumeWake=true){
  clearTimeout(voiceCapTimer);voiceCapTimer=null;
  localSessionWanted=false;
  try{window.speechSynthesis?.cancel();}catch{}
  if(recognition){const old=recognition;recognition=null;old.onend=null;old.onerror=null;old.onresult=null;try{old.abort();}catch{}}
  if(conversation){const old=conversation;conversation=null;try{await old.endSession();}catch{}}
  voiceStarting=false;
  $('micBtnText').textContent='Ярилцлага эхлүүлэх';
  setStatus(wakeListener?.enabled&&resumeWake?'wake':'ready');
  if(resumeWake&&wakeListener?.enabled)wakeListener.resume(1400);
}
async function startLocalVoiceSession(fromWake){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SpeechRecognition){
    if(fromWake)addMessage('assistant','Сайн байна уу! Асуултаа дэлгэц дээр бичнэ үү.');
    toast('Дуут танилт дэмжигдээгүй. Асуултаа бичгээр илгээнэ үү.');
    await stopVoice();return;
  }
  if(fromWake){
    const greeting='Сайн байна уу! Би RAINY эмийн сангийн туслах. Та эмийн нэр, үнэ, байршлын талаар асуугаарай.';
    addMessage('assistant',greeting);
    await speakBrowser(greeting);
  }
  recognition=new SpeechRecognition();
  const session=recognition;
  session.lang='mn-MN';session.continuous=true;session.interimResults=false;
  session.onresult=async event=>{
    for(let i=event.resultIndex||0;i<event.results.length;i++){
      if(!event.results[i].isFinal)continue;
      const transcript=event.results[i][0]?.transcript||'';
      if(acceptVoiceTranscript(transcript,event.results[i][0]?.confidence))await ask(transcript);
    }
  };
  session.onerror=event=>{
    if(['not-allowed','service-not-allowed','audio-capture'].includes(event.error||'')){
      localSessionWanted=false;
      toast('Микрофоны алдаа: '+event.error);
    }
  };
  session.onend=()=>{
    if(recognition!==session)return;
    recognition=null;
    if(localSessionWanted&&!conversation){
      setTimeout(()=>{if(localSessionWanted&&!recognition&&!conversation&&!voiceStarting)startLocalVoiceSession(false);},900);
    }else stopVoice();
  };
  try{session.start();localSessionWanted=true;$('micBtnText').textContent='Яриаг зогсоох';setStatus('listening');}
  catch(e){recognition=null;toast(e.message);await stopVoice();}
}
async function startVoice(fromWake=false){
  activity();
  if(voiceStarting)return;
  if(conversation||recognition){if(!fromWake)await stopVoice();return;}
  wakeListener?.pause();
  markKioskInteraction();
  trackAnalytics('voiceStarted');
  voiceStarting=true;
  clearTimeout(voiceCapTimer);
  voiceCapTimer=setTimeout(()=>{void resetVisitorSession();},180000);
  startVoiceVisuals();
  $('micBtnText').textContent='Яриаг зогсоох';
  if(config?.voiceReady){
    try{
      setStatus('connecting');
      const startedAt=visitorEpoch;
      const {signedUrl}=await api('/agent/signed-url');
      if(startedAt!==visitorEpoch){voiceStarting=false;return;}
      // Audio travels only to a clinician-approved ElevenLabs Agent.
      const live=await Conversation.startSession({
        signedUrl,
        connectionType:'websocket',
        workletPaths:ELEVENLABS_WORKLET_PATHS,
        onConnect:()=>{setStatus('listening');trackAnalytics('voiceConnected');},
        onDisconnect:()=>{
          if(config?.resetOnDisconnect!==false&&!resettingVisitor){
            queueMicrotask(()=>{void resetVisitorSession();});
          }
          conversation=null;
          voiceStarting=false;
          $('micBtnText').textContent='Ярилцлага эхлүүлэх';
          setStatus(wakeListener?.enabled?'wake':'ready');
          wakeListener?.resume(1800);
        },
        onError:()=>{trackAnalytics('voiceFailed');toast('ElevenLabs холболт тасарлаа. Эм зүйчээс лавлах эсвэл бичгээр асууна уу.');},
        onModeChange:mode=>setStatus(mode.mode==='speaking'?'speaking':'listening'),
        onMessage:message=>{
          const text=message.message;
          // Defense-in-depth: an external ElevenLabs Agent must also have
          // pharmacist-reviewed prompts. This client cannot mute audio already
          // spoken by the provider, but immediately flags clinical requests.
          if(message.source==='user'&&typeof text==='string'){
            void api('/voice/triage',{method:'POST',body:JSON.stringify({text})}).then(result=>{
              if(result.requiresPharmacist){
                toast('Энэ асуултад эм зүйч хэрэгтэй. Доорх “Эм зүйч дуудах” товчийг ашиглана уу.');
                addMessage('assistant','⚠ Мэргэжлийн эм зүйчээс тусламж авна уу. AI эмийн тун, онош, эмчилгээг шийдэхгүй.');
              }
            }).catch(()=>{});
          }
          if(text&&typeof text==='string'&&(message.source==='ai'||message.source==='user')){
            if(message.source==='ai')trackAnalytics('voiceMessagesObserved');
            addMessage(message.source==='ai'?'assistant':'user',text);
          }
        }
      });
      if(startedAt!==visitorEpoch){await live.endSession();voiceStarting=false;return;}
      conversation=live;voiceStarting=false;startVoiceVisuals();
      return;
    }catch(e){
      voiceStarting=false;
      trackAnalytics('voiceFailed');
      toast('ElevenLabs холболт боломжгүй: '+e.message+'. Browser дуут танилт руу шилжиж байна.');
      await stopVoice(false);
      // Keep the same bounded duration even in local STT fallback.
      voiceCapTimer=setTimeout(()=>{void resetVisitorSession();},180000);
      await startLocalVoiceSession(fromWake);
      return;
    }
  }
  voiceStarting=false;
  toast(config?.voiceConfigured?'Agent ID ба API key байгаа ч эм зүйчийн баталгаажуулалт дутуу. Browser-ийн ярианы горим ажиллана.':'Voice Agent-ийн тохиргоо дутуу. Browser-ийн ярианы горимыг туршиж байна.');
  await startLocalVoiceSession(fromWake);
}
function closeModal(){
  if(cameraStream){cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;}
  $('overlay').hidden=true;$('modalBody').replaceChildren();
}
function modal(title){
  closeModal();$('modalTitle').textContent=title;$('overlay').hidden=false;activity();
  return $('modalBody');
}
function element(tag,cls,text){
  const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;
}
function showMedicineDetails(item,query=''){
  markKioskInteraction();
  trackAnalytics('medicineDetailsViewed');
  const body=modal(item.name);
  const note=element('p','modal-copy',item.verified?'Энэ бүтээгдэхүүний бүртгэлийг эмийн сан баталгаажуулсан.':'ЖИШЭЭ МЭДЭЭЛЭЛ · Эмийн сангийн бодит нөөц, үнэ, тун, хэрэглэх заавар биш.');
  note.classList.add('medicine-alert');
  body.append(note);
  for(const [label,value] of [['Ангилал',item.category],['Хэлбэр',item.form],['Ерөнхий мэдээлэл',item.description],['Анхаарах зүйлс',item.warnings],['Хадгалалт',item.storage]]){
    if(!value)continue;
    const block=element('section','medicine-detail');
    block.append(element('h3',null,label),element('p',null,value));
    body.append(block);
  }
  body.append(element('p','modal-copy','Энэ мэдээлэл нь онош, жор, хэрэглэх тунгийн зөвлөгөө биш. Эм зүйчээс баталгаажуулна уу.'));
  const row=element('div','medicine-detail-actions');
  const back=element('button','medicine-back','← Жагсаалт руу');
  back.onclick=()=>catalogModal(query,true);
  const staff=element('button','medicine-staff','Эм зүйч дуудах');
  staff.onclick=()=>{closeModal();handoff();};
  row.append(back,staff);body.append(row);
}
async function catalogModal(initialQuery='',fromBack=false){
  if(!fromBack){
    markKioskInteraction();
    trackAnalytics('catalogOpened');
  }
  const body=modal('Эмийн мэдээлэл хайх');
  const prompt=element('p','modal-copy','30 төрлийн жишээ эмийн мэдээлэл. Бодит үнэ, үлдэгдэл, заавар баталгаажаагүй. Эм зүйчээс лавлана уу.');
  const input=element('input','search-field');input.placeholder='Жишээ: Парацетамол';input.setAttribute('aria-label','Эмийн нэр хайх');
  const list=element('div','search-results');body.append(prompt,input,list);
  let serial=0;
  const render=async()=>{
    const current=++serial;
    try{
      const data=await api('/catalog?q='+encodeURIComponent(input.value));
      if(current!==serial)return;
      list.replaceChildren();
      if(!data.items.length)list.append(element('p','modal-copy','Илэрц олдсонгүй. Эм зүйчээс лавлана уу.'));
      for(const item of data.items){
        const card=element('button','result-card');
        const info=element('span','result-info');
        const title=element('strong',null,item.name);
        const description=element('small',null,item.verified?('Баталгаажуулсан бүртгэл · '+(item.shelf||'Тавиур тодорхойгүй')):(item.category||'Жишээ бүртгэл')+' · Бодит үнэ/нөөц биш');
        info.append(title,description);card.append(element('span','result-icon','✚'),info,element('span','', '↗'));
        card.onclick=()=>showMedicineDetails(item,input.value);list.append(card);
      }
    }catch(e){toast(e.message);}
  };
  input.value=typeof initialQuery==='string'?initialQuery:'';
  input.oninput=render;render();input.focus();
}
async function imageData(file){
  if(!file||!file.type.match(/^image\/(jpeg|png|webp)$/))throw Error('JPEG, PNG эсвэл WebP зураг сонгоно уу.');
  if(file.size>4000000)throw Error('4 MB-аас бага зураг сонгоно уу.');
  const img=await createImageBitmap(file);
  const max=1400,scale=Math.min(1,max/Math.max(img.width,img.height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);img.close();
  return canvas.toDataURL('image/jpeg',0.82);
}
async function visionLookup(image,body){
  const consent=body.querySelector('#visionConsent');
  if(!consent?.checked){toast('Зургийг AI үйлчилгээ рүү илгээх зөвшөөрлийг эхлээд тэмдэглэнэ үү.');return;}
  if(!config.visionReady){toast('Зураг уншихын тулд сервер дээр OPENAI_API_KEY тохируулна уу.');return;}
  const results=body.querySelector('.vision-results');results.replaceChildren(element('p','modal-copy','Зургийн бичвэрийг таньж байна...'));
  try{
    const data=await api('/vision',{method:'POST',body:JSON.stringify({image,consent:true})});
    results.replaceChildren();
    results.append(element('p','recognized','Танигдсан бичвэр: '+data.recognizedText));
    results.append(element('p','modal-copy','Камерын танилт алдаатай байж болно. Эмийн хайрцаг дээрх нэртэй тулгаж өөрөө баталгаажуулна уу.'));
    if(!data.matches.length)results.append(element('p','modal-copy','Каталогт тохирох бүртгэл олдсонгүй. Эм зүйчээс лавлана уу.'));
    for(const item of data.matches){
      const b=element('button','result-card','✓ '+item.name+' — энэ мөн');
      b.onclick=()=>{closeModal();ask(item.name+' үнэ');};results.append(b);
    }
  }catch(e){results.replaceChildren(element('p','modal-copy',e.message));}
}
async function cameraModal(){
  markKioskInteraction();
  const body=modal('Эмийн савлагаа уншуулах');
  body.append(element('p','modal-copy','Зураг зөвхөн таны идэвхтэй зөвшөөрлөөр шошго таних AI үйлчилгээ рүү дамжина. Хувийн мэдээлэл, жорын зураг бүү оруулаарай.'));
  const frame=element('div','camera-frame');const video=document.createElement('video');video.autoplay=true;video.muted=true;video.playsInline=true;
  frame.append(video,element('div','scanner-outline','ШОШГЫГ ХҮРЭЭНД БАЙРЛУУЛНА УУ'));body.append(frame);
  const row=element('div','modal-actions');const open=element('button','primary-modal','📷 Камер асаах');
  const snap=element('button','secondary-modal','▣ Зураг авах');snap.disabled=true;
  const upload=element('input');upload.type='file';upload.accept='image/jpeg,image/png,image/webp';upload.className='upload-input';
  row.append(open,snap,upload);body.append(row);
  const label=element('label','consent-label');const check=document.createElement('input');check.type='checkbox';check.id='visionConsent';label.append(check,document.createTextNode(' Зургийг зөвхөн нэр таних зорилгоор гаднын AI provider руу илгээхийг зөвшөөрч байна.'));body.append(label);
  const results=element('div','vision-results');body.append(results);
  open.onclick=async()=>{
    if(!navigator.mediaDevices?.getUserMedia){toast('Камер ашиглахад HTTPS болон browser permission шаардлагатай.');return;}
    try{cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});video.srcObject=cameraStream;await video.play();snap.disabled=false;open.textContent='Камер ажиллаж байна';open.disabled=true;}
    catch(e){toast('Камер нээж чадсангүй: '+e.message);}
  };
  snap.onclick=async()=>{
    if(!video.videoWidth)return;
    const canvas=document.createElement('canvas');const scale=Math.min(1,1400/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);
    canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
    await visionLookup(canvas.toDataURL('image/jpeg',0.8),body);
  };
  upload.onchange=async()=>{try{const image=await imageData(upload.files[0]);await visionLookup(image,body);}catch(e){toast(e.message);}};
}
async function handoff(){
  markKioskInteraction();
  activity();
  try{const answer=await api('/handoff',{method:'POST',body:'{}'});addMessage('assistant',answer.message);toast(answer.message);}
  catch(e){addMessage('assistant','Ажилтан дуудах систем ажиллахгүй байна. Эмийн сангийн ажилтанд биечлэн хандана уу.');toast(e.message);}
}
async function toggleKioskMode(){
  const next=!document.body.classList.contains('immersive-kiosk');
  document.body.classList.toggle('immersive-kiosk',next);
  requestAnimationFrame(()=>avatar25?.resize());
  if(next){
    localStorage.setItem(KIOSK_STORAGE_KEY,'1');
    try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();}
    catch{toast('Дэлгэц томорлоо. Browser fullscreen-д ажилтны зөвшөөрөл хэрэгтэй; Chrome --kiosk горим бүрэн дэлгэцээр тогтвортой ажиллана.');}
  }else{
    localStorage.removeItem(KIOSK_STORAGE_KEY);
    try{if(document.fullscreenElement)await document.exitFullscreen();}catch{}
  }
}

async function loadPremium2D5(){
  const stage=document.querySelector('.stage-persona');
  const layer=document.createElement('div');
  layer.id='avatar25';
  stage.append(layer);
  try{
    avatar25=new IllustratedAvatar25D(layer);
    avatar25.setIdleEnabled(config?.avatarIdleEnabled!==false);
    avatar25.setAvatar(selected);
    avatar25.setState(currentVoiceState);
    stage.classList.add('avatar-25d-ready');
    document.body.dataset.avatarEngine='premium-25d';
  }catch(error){
    console.warn('2.5D fallback:',error);
    avatar25?.dispose();
    avatar25=null;
    stage.classList.remove('avatar-25d-ready');
    document.body.dataset.avatarEngine='css-fallback';
    layer.remove();
  }
}
function closeSidebarDrawer({restoreFocus=false}={}){
  const wasOpen=document.body.classList.contains('sidebar-open');
  document.body.classList.remove('sidebar-open');
  $('sidebarOverlay').hidden=true;
  $('sidebarToggle').setAttribute('aria-expanded','false');
  if(wasOpen&&restoreFocus)$('sidebarToggle').focus();
}
function bindSidebarDrawer(){
  const query=window.matchMedia('(orientation: portrait), (max-width: 850px)');
  $('sidebarToggle').onclick=()=>{
    if(!query.matches)return;
    const open=!document.body.classList.contains('sidebar-open');
    document.body.classList.toggle('sidebar-open',open);
    $('sidebarOverlay').hidden=!open;
    $('sidebarToggle').setAttribute('aria-expanded',String(open));
    if(open)$('sidebarClose').focus();
  };
  $('sidebarClose').onclick=()=>closeSidebarDrawer({restoreFocus:true});
  $('sidebarOverlay').onclick=()=>closeSidebarDrawer({restoreFocus:true});
  ['homeNav','catalogNav','cameraNav','voiceNav'].forEach(id=>{
    $(id).addEventListener('click',()=>closeSidebarDrawer());
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&document.body.classList.contains('sidebar-open')){
      event.preventDefault();closeSidebarDrawer({restoreFocus:true});
    }
  });
  window.addEventListener('resize',()=>{if(!query.matches)closeSidebarDrawer();});
}
function wire(){
  // Kiosk interaction counts only deliberate taps/keystrokes, not passive
  // pointer movement that can indefinitely suppress idle gestures.
  document.addEventListener('pointerdown',activity,{passive:true});
  document.addEventListener('keydown',activity);
  bindSidebarDrawer();
  $('medicineLiveClose').onclick=clearMedicineCard;
  $('homeNav').onclick=()=>{closeModal();window.scrollTo({top:0,behavior:'smooth'});};
  $('catalogNav').onclick=catalogModal;$('medicineAction').onclick=catalogModal;
  $('cameraNav').onclick=cameraModal;$('cameraAction').onclick=cameraModal;
  $('newVisitorBtn').onclick=()=>{void resetVisitorSession();};
  $('voiceNav').onclick=()=>startVoice();$('voiceAction').onclick=()=>startVoice();$('micBtn').onclick=()=>startVoice();
  $('setupMicrophoneBtn').onclick=enableMicFromStaff;
  $('kioskCatalogBtn').onclick=catalogModal;
  $('kioskCameraBtn').onclick=cameraModal;
  $('kioskStaffBtn').onclick=handoff;
  $('kioskBtn').onclick=toggleKioskMode;
  $('kioskExitBtn').onclick=toggleKioskMode;
  $('staffAction').onclick=handoff;$('handoffSide').onclick=handoff;
  $('askForm').onsubmit=e=>{e.preventDefault();ask($('questionInput').value);};
  $('modalClose').onclick=closeModal;$('overlay').onclick=e=>{if(e.target===$('overlay'))closeModal();};
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
  $('fullscreenBtn').onclick=toggleKioskMode;
  document.addEventListener('fullscreenchange',()=>{
    if(!document.fullscreenElement&&!localStorage.getItem(KIOSK_STORAGE_KEY))document.body.classList.remove('immersive-kiosk');
  });
  for(const event of ['pointerdown','keydown'])document.addEventListener(event,activity,{passive:true});
  const tick=()=>{$('clock').textContent=new Intl.DateTimeFormat('mn-MN',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Ulaanbaatar'}).format(new Date());};
  tick();setInterval(tick,30000);
}
function startDeviceHeartbeat(){
  const key='rainy-device-'+(branchSlug||'default');
  let credentials;
  try{credentials=JSON.parse(localStorage.getItem(key)||'null');}catch{return;}
  if(!credentials?.id||!credentials?.token)return;
  const send=async()=>{
    try{
      const response=await fetch(scopedPath('/api/device/heartbeat'),{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({id:credentials.id,token:credentials.token,status:{version:'0.1.0',voiceReady:!!config?.voiceReady}}),
        cache:'no-store'
      });
      if(response.status===401)localStorage.removeItem(key);
    }catch{}
  };
  void send();
  setInterval(()=>{if(document.visibilityState==='visible')void send();},60000);
}
async function init(){
  wire();
  try{
    config=await api('/bootstrap');
    if(config.subscription&&!config.subscription.active){
      const banner=$('demoBanner');
      banner.hidden=false;
      banner.textContent='⏳ Энэ салбарын үйлчилгээний эрх идэвхгүй эсвэл хугацаа дууссан. Эмийн сангийн админаас эрх сунгуулаарай.';
      $('micBtn').disabled=true;
      $('questionInput').disabled=true;
      document.querySelector('#askForm button').disabled=true;
      for(const id of ['medicineAction','cameraAction','voiceAction','kioskCatalogBtn','kioskCameraBtn'])if($(id))$(id).disabled=true;
    }
    document.documentElement.style.setProperty('--accent',config.accent);
    $('locationLabel').textContent=config.locationName;
    $('pharmacyNameLabel').textContent=config.pharmacyName;
    document.title=config.pharmacyName+' — AI Kiosk';
    $('heroDescription').textContent='Эмийн мэдээлэл, үнэ, байршлын талаар асуугаарай.';
    const logo=config.logoData||'';
    for(const id of ['sidebarBrandLogo','branchLogo']){
      const image=$(id);
      image.hidden=!logo;
      if(logo)image.src=logo;
      else image.removeAttribute('src');
    }
    document.querySelector('.brand-mark').href=branchSlug?'/?branch='+encodeURIComponent(branchSlug):'/';
    document.querySelector('.admin-link').href=branchSlug?'/admin.html?branch='+encodeURIComponent(branchSlug):'/admin.html';
    $('greetingBubble').textContent=config.greeting;
    if(!config.subscription||config.subscription.active)$('demoBanner').hidden=!config.demoMode;
    $('voiceHint').textContent=config.voiceReady?'ElevenLabs AI Agent идэвхтэй · Микрофоноо асаана уу':config.voiceConfigured?'Agent ID / API key тохируулсан. Эмнэлзүйн зөвшөөрөл дутуу — админаас шалгана уу.':'Browser дуут танилт / бичгээр асуулт · ElevenLabs Agent холболт дутуу';
    renderAvatars();
    await loadPremium2D5();
    await loadMedicineIndex();
    startDeviceHeartbeat();
    makeWakeListener();
    if(localStorage.getItem(KIOSK_STORAGE_KEY)==='1'){
      document.body.classList.add('immersive-kiosk');
      requestAnimationFrame(()=>avatar25?.resize());
    }
    await restoreMicIfGranted();
    activity();
  }catch(e){
    $('greetingBubble').textContent='Сервертэй холбогдож чадсангүй. Байгууллагын ажилтнаас тусламж авна уу.';
    toast(e.message);
  }
}
init();
window.addEventListener('beforeunload',()=>{avatar25?.dispose();wakeListener?.disable();cameraStream?.getTracks().forEach(t=>t.stop());conversation?.endSession();});

if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
