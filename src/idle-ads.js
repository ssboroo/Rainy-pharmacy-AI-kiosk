export function shouldShowAds({config,idleMs,busy,hidden}){
 return !!(config?.enabled&&config.items?.length&&!busy&&!hidden&&idleMs>=config.idleSec*1000);
}
export function createIdleAds({host,getAvatar,canShow,load,onResize=()=>{},now=()=>Date.now()}){
 let config={enabled:false,items:[]},last=now(),visible=false,index=0,nextAt=0,failed=0,avatar=null,home=null;
 const panel=document.createElement('section');panel.className='idle-ad-panel';panel.hidden=true;panel.setAttribute('aria-label','Хүлээлгийн зар');
 const badge=document.createElement('div');badge.className='idle-ad-badge';badge.textContent='МЭДЭЭЛЭЛ · СУРТАЛЧИЛГАА';
 const media=document.createElement('div');media.className='idle-ad-media';
 const footer=document.createElement('div');footer.className='idle-ad-footer';
 const mini=document.createElement('div');mini.className='idle-ad-avatar';
 const copy=document.createElement('div'),title=document.createElement('strong'),hint=document.createElement('span');
 title.textContent='Танд туслахад бэлэн';hint.textContent='AI-тай ярилцахын тулд дэлгэцэд хүрнэ үү';copy.append(title,hint);
 const button=document.createElement('button');button.type='button';button.textContent='Ярилцах ↗';button.className='idle-ad-start';
 footer.append(mini,copy,button);panel.append(badge,media,footer);host.append(panel);
 function clearMedia(){for(const v of media.querySelectorAll('video')){v.pause();v.removeAttribute('src');v.load();}media.replaceChildren();}
 function hide(){if(!visible)return;visible=false;panel.hidden=true;host.classList.remove('idle-ad-host');document.body.classList.remove('idle-ad-fullscreen');clearMedia();if(avatar&&home){home.parent.insertBefore(avatar,home.next?.parentNode===home.parent?home.next:null);avatar=null;home=null;onResize();}}
 function activity(){last=now();failed=0;hide();}
 function showItem(){
  clearMedia();if(!visible||!config.items.length)return;
  const item=config.items[index%config.items.length];index=(index+1)%config.items.length;
  const el=document.createElement(item.type==='video'?'video':'img');el.className='idle-ad-content';el.setAttribute('aria-label',item.title||'Зар');
  if(item.type==='video'){el.muted=true;el.defaultMuted=true;el.autoplay=true;el.playsInline=true;el.preload='metadata';el.onended=()=>{if(visible)showItem();};}
  else el.alt=item.title||'Зар';
  el.onerror=()=>{if(!visible||!media.contains(el))return;failed++;if(failed>=config.items.length){activity();return;}nextAt=now();};
  el.src=item.url;media.append(el);nextAt=now()+item.durationSec*1000;
  if(item.type==='video')el.play().catch(()=>{if(visible)nextAt=Math.min(nextAt,now()+5000);});
 }
 function show(){visible=true;failed=0;panel.hidden=false;host.classList.add('idle-ad-host');document.body.classList.toggle('idle-ad-fullscreen',config.placement==='fullscreen');avatar=getAvatar();if(avatar){home={parent:avatar.parentNode,next:avatar.nextSibling};mini.append(avatar);onResize();}showItem();}
 async function refresh(){try{const result=await load();const next=result.idleAds;if(JSON.stringify(next)!==JSON.stringify(config)){hide();config=next;index=0;last=now();}}catch{/* Keep the last loaded playlist when offline. */}}
 const tick=setInterval(()=>{if(!shouldShowAds({config,idleMs:now()-last,busy:!canShow(),hidden:document.hidden})){hide();return;}if(!visible)show();else if(now()>=nextAt)showItem();},500);
 const poll=setInterval(refresh,60000);
 const pointer=()=>activity(),key=()=>activity(),visibility=()=>{if(document.hidden)hide();else activity();};
 document.addEventListener('pointerdown',pointer,true);document.addEventListener('keydown',key,true);document.addEventListener('visibilitychange',visibility);
 // A single tap only dismisses ads; the visitor chooses whether to open the microphone.
 button.onclick=()=>{activity();document.getElementById('micBtn')?.focus();};
 void refresh();
 return {activity,refresh,dispose(){clearInterval(tick);clearInterval(poll);hide();document.removeEventListener('pointerdown',pointer,true);document.removeEventListener('keydown',key,true);document.removeEventListener('visibilitychange',visibility);panel.remove();}};
}
