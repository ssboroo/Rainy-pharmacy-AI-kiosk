import {Conversation} from '@elevenlabs/client';
import './style.css';
const $=id=>document.getElementById(id);
let config=null,selected='nomi',conversation=null,cameraStream=null,recognition=null,resetTimer=null;
const byId={nomi:'Таны найрсаг робот туслах',mira:'Таны ухаалаг AI зөвлөх',kiki:'Таны өхөөрдөм AI анд',aria:'Таны дижитал туслах',bobo:'Таны хөөрхөн AI найз'};
async function api(path,opts={}){
  const response=await fetch('/api'+path,{...opts,headers:{'Content-Type':'application/json',...(opts.headers||{})}});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Сервертэй холбогдож чадсангүй.');
  return data;
}
function toast(message){
  const el=$('toast');el.textContent=message;el.hidden=false;
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,5200);
}
function activity(){
  clearTimeout(resetTimer);
  resetTimer=setTimeout(async()=>{
    await stopVoice();
    $('conversation').replaceChildren();
    addMessage('assistant',config?.greeting||'Сайн байна уу!');
    $('questionInput').value='';
    closeModal();
  },120000);
}
function addMessage(role,text){
  const item=document.createElement('div');item.className='message '+role;
  const mark=document.createElement('span');mark.className='message-mark';mark.textContent=role==='assistant'?'✦':'●';
  const bubble=document.createElement('div');bubble.className='bubble';bubble.textContent=text;
  item.append(mark,bubble);$('conversation').append(item);
  $('conversation').scrollTop=$('conversation').scrollHeight;
  activity();
}
function setStatus(state){
  $('avatarMount').classList.toggle('speaking',state==='speaking');
  $('waveform').classList.toggle('active',state==='speaking'||state==='listening');
  $('statusLabel').textContent=state==='speaking'?'AI туслах ярьж байна':state==='listening'?'Таныг сонсож байна':state==='connecting'?'Холбогдож байна':'Танд туслахад бэлэн';
}
function selectAvatar(id){
  const data=config.avatars.find(a=>a.id===id);if(!data)return;
  selected=id;
  $('avatarMount').className='portrait '+id;
  $('assistantTitle').textContent=data.name;
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
    visual.innerHTML='<i class="thumb-ears"></i><i class="thumb-head"><b class="thumb-eye eye-one"></b><b class="thumb-eye eye-two"></b><b class="thumb-mouth"></b></i><i class="thumb-body"></i>';
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
  $('questionInput').value='';addMessage('user',q);
  try{
    const answer=await api('/ask',{method:'POST',body:JSON.stringify({question:q})});
    addMessage('assistant',answer.reply);
    if(answer.kind==='emergency')toast('ЯАРАЛТАЙ: Эм зүйчийг дуудаж, шаардлагатай бол 103 руу залгаарай.');
  }catch(e){toast(e.message);}
}
async function stopVoice(){
  if(recognition){try{recognition.stop();}catch{}recognition=null;}
  if(conversation){const old=conversation;conversation=null;try{await old.endSession();}catch{}}
  $('micBtnText').textContent='Ярилцлага эхлүүлэх';setStatus('ready');
}
async function startVoice(){
  activity();
  if(conversation||recognition){await stopVoice();return;}
  $('micBtnText').textContent='Яриаг зогсоох';
  if(config.voiceReady){
    try{
      setStatus('connecting');
      const {signedUrl}=await api('/agent/signed-url');
      conversation=await Conversation.startSession({
        signedUrl,
        onConnect:()=>setStatus('listening'),
        onDisconnect:()=>{conversation=null;$('micBtnText').textContent='Ярилцлага эхлүүлэх';setStatus('ready');},
        onError:(error)=>{console.error('Voice session error',error);toast('Дуут AI холболт тасарлаа. Бичгээр асууж болно.');},
        onModeChange:(mode)=>setStatus(mode.mode==='speaking'?'speaking':'listening'),
        onMessage:(message)=>{
          const text=message.message;
          if(text&&typeof text==='string'&&(message.source==='ai'||message.source==='user'))addMessage(message.source==='ai'?'assistant':'user',text);
        }
      });
      return;
    }catch(e){toast('ElevenLabs: '+e.message);await stopVoice();return;}
  }
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SpeechRecognition){await stopVoice();toast('Энэ төхөөрөмжийн browser-д дуут танилт байхгүй. ElevenLabs Agent холбох эсвэл бичгээр асууна уу.');return;}
  recognition=new SpeechRecognition();recognition.lang='mn-MN';recognition.interimResults=false;recognition.continuous=false;
  recognition.onresult=async e=>{const text=e.results[0][0].transcript;recognition=null;await stopVoice();await ask(text);};
  recognition.onerror=()=>{recognition=null;stopVoice();toast('Микрофоны зөвшөөрөл болон Монгол хэлний танилтыг шалгана уу.');};
  recognition.onend=()=>{if(recognition){recognition=null;stopVoice();}};
  try{recognition.start();setStatus('listening');toast('Browser-ийн Монгол хэлний танилт төхөөрөмжөөс хамаарна.');}catch(e){recognition=null;await stopVoice();toast(e.message);}
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
async function catalogModal(){
  const body=modal('Эмийн мэдээлэл хайх');
  const prompt=element('p','modal-copy','Бүтээгдэхүүний нэрээр хайна уу. Баталгаагүй demo бүртгэл нь бодит үнэ, үлдэгдлийг харуулахгүй.');
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
        const description=element('small',null,item.verified?('Баталгаажуулсан бүртгэл · '+(item.shelf||'Тавиур тодорхойгүй')):'Жишээ бүртгэл · Бодит мэдээлэл биш');
        info.append(title,description);card.append(element('span','result-icon','✚'),info,element('span','', '↗'));
        card.onclick=()=>{closeModal();ask(item.name+' үнэ');};list.append(card);
      }
    }catch(e){toast(e.message);}
  };
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
  activity();
  try{const answer=await api('/handoff',{method:'POST',body:'{}'});addMessage('assistant',answer.message);toast(answer.message);}
  catch(e){addMessage('assistant','Ажилтан дуудах систем ажиллахгүй байна. Эмийн сангийн ажилтанд биечлэн хандана уу.');toast(e.message);}
}
function wire(){
  $('homeNav').onclick=()=>{closeModal();window.scrollTo({top:0,behavior:'smooth'});};
  $('catalogNav').onclick=catalogModal;$('medicineAction').onclick=catalogModal;
  $('cameraNav').onclick=cameraModal;$('cameraAction').onclick=cameraModal;
  $('voiceNav').onclick=startVoice;$('voiceAction').onclick=startVoice;$('micBtn').onclick=startVoice;
  $('staffAction').onclick=handoff;$('handoffSide').onclick=handoff;
  $('askForm').onsubmit=e=>{e.preventDefault();ask($('questionInput').value);};
  $('modalClose').onclick=closeModal;$('overlay').onclick=e=>{if(e.target===$('overlay'))closeModal();};
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
  $('fullscreenBtn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(e){toast(e.message);}};
  for(const event of ['pointerdown','keydown'])document.addEventListener(event,activity,{passive:true});
  const tick=()=>{$('clock').textContent=new Intl.DateTimeFormat('mn-MN',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Ulaanbaatar'}).format(new Date());};
  tick();setInterval(tick,30000);
}
async function init(){
  wire();
  try{
    config=await api('/bootstrap');
    document.documentElement.style.setProperty('--accent',config.accent);
    $('locationLabel').textContent=config.locationName;
    $('heroDescription').textContent='Эмийн мэдээлэл, үнэ, байршлын талаар асуугаарай.';
    $('greetingBubble').textContent=config.greeting;
    $('demoBanner').hidden=!config.demoMode;
    $('voiceHint').textContent=config.voiceReady?'ElevenLabs AI Agent холбогдсон · Микрофоноо асаана уу':'Browser дуут танилт / бичгээр асуулт · Agent хараахан холбогдоогүй';
    renderAvatars();
    activity();
  }catch(e){
    $('greetingBubble').textContent='Сервертэй холбогдож чадсангүй. Байгууллагын ажилтнаас тусламж авна уу.';
    toast(e.message);
  }
}
init();
window.addEventListener('beforeunload',()=>{cameraStream?.getTracks().forEach(t=>t.stop());conversation?.endSession();});

if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
