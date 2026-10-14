export const AVATAR_STYLES=Object.freeze({
  nomi:{identity:'pearl-mint-robot',name:'Номи',kind:'robot',tint:'#73dbc3',light:'#f4fffa',body:'#55bfae',deep:'#1e5e6c',eye:'#40ebdb',hair:'#397677'},
  mira:{identity:'human-sakura-guide',name:'Мира',kind:'human',tint:'#b9a2f3',light:'#ffedf5',body:'#9589d9',deep:'#604c76',eye:'#8463a1',hair:'#5b435f'},
  kiki:{identity:'apricot-fox-robot',name:'Кики',kind:'fox',tint:'#ffc58b',light:'#fff5e5',body:'#eeb079',deep:'#a76c55',eye:'#ffb768',hair:'#a96f58'},
  aria:{identity:'aurora-blue-hologram',name:'Ариа',kind:'hologram',tint:'#86d9f4',light:'#eafaff',body:'#84b7eb',deep:'#416b91',eye:'#62d1fa',hair:'#3f739e'},
  bobo:{identity:'rose-bunny-robot',name:'Бобо',kind:'bunny',tint:'#f3a8d5',light:'#fff1fa',body:'#e7a3c8',deep:'#95628a',eye:'#f8afd5',hair:'#9b6b8d'}
});
export function normalizeVoiceEnergy(v){return typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;}
export function expressionFor(state){return ({speaking:'speaking',listening:'attentive',wake:'attentive',connecting:'thinking',emergency:'concerned'})[state]||'calm';}
function headAccessory(id,p){
  if(id==='nomi')return `<rect x="386" y="113" width="28" height="75" rx="14" fill="${p.deep}"/><circle cx="400" cy="113" r="26" fill="${p.deep}"/><circle cx="400" cy="109" r="19" fill="${p.tint}"/><circle cx="393" cy="103" r="6" fill="#fff" opacity=".8"/><rect x="193" y="312" width="59" height="91" rx="29" fill="${p.deep}"/><rect x="548" y="312" width="59" height="91" rx="29" fill="${p.deep}"/><rect x="199" y="330" width="45" height="58" rx="22" fill="${p.tint}"/><rect x="558" y="330" width="44" height="58" rx="22" fill="${p.tint}"/>`;
  if(id==='kiki')return `<path d="M245 251 L240 100 Q241 81 262 93 L351 168Z" fill="${p.deep}"/><path d="M255 220 L258 125 L327 184Z" fill="#ffe0c2"/><path d="M555 251 L560 100 Q559 81 538 93 L449 168Z" fill="${p.deep}"/><path d="M545 220 L542 125 L473 184Z" fill="#ffe0c2"/>`;
  if(id==='bobo')return `<g class="avatar25-ears"><rect x="286" y="70" width="84" height="195" rx="42" transform="rotate(-13 328 167)" fill="${p.deep}"/><rect x="302" y="83" width="49" height="167" rx="25" transform="rotate(-13 328 167)" fill="#ffe1ed"/><rect x="430" y="70" width="84" height="195" rx="42" transform="rotate(13 472 167)" fill="${p.deep}"/><rect x="449" y="83" width="49" height="167" rx="25" transform="rotate(13 472 167)" fill="#ffe1ed"/></g>`;
  if(id==='aria')return `<circle cx="400" cy="152" r="34" fill="none" stroke="#c8f7ff" stroke-width="7" opacity=".9"/><path d="M232 220 Q400 115 568 220" fill="none" stroke="${p.tint}" stroke-width="13" stroke-linecap="round"/><circle cx="400" cy="152" r="14" fill="#fff" opacity=".84"/>`;
  return `<path d="M230 390 Q192 189 289 137 Q381 81 487 142 Q600 199 571 417 L547 505 Q522 547 514 484 L525 308 Q514 234 450 204 Q352 186 296 248 L272 457 Q249 542 227 485Z" fill="${p.hair}"/><path d="M253 224 Q310 115 411 148" fill="none" stroke="#c3aac1" stroke-width="14" stroke-linecap="round" opacity=".57"/>`;
}
function headShape(id,p,prefix){
  if(id==='mira')return `<path d="M401 190 C316 185 263 260 263 356 Q261 484 342 527 Q401 560 467 527 Q540 486 537 356 C537 259 487 192 401 190Z" fill="url(#${prefix}-skin)" stroke="#e3b6af" stroke-width="5"/><path d="M258 287 Q282 170 400 175 Q488 172 536 272 Q521 225 474 218 Q426 261 333 251 Q296 253 258 287" fill="${p.hair}"/><path d="M316 301 Q341 291 363 307 M438 308 Q461 290 487 302" stroke="${p.hair}" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M396 380 Q384 405 405 410" stroke="#d49a9f" stroke-width="5" fill="none" stroke-linecap="round" opacity=".45"/>`;
  const radius=id==='aria'?112:143;
  return `<rect x="218" y="181" width="364" height="346" rx="${radius}" fill="${p.deep}" opacity=".45" filter="url(#${prefix}-blur)"/><rect x="219" y="177" width="362" height="343" rx="${radius}" fill="url(#${prefix}-shell)" stroke="#fff" stroke-width="8" stroke-opacity=".88"/><path d="M293 204 Q400 171 510 205" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round" opacity=".64"/><rect x="242" y="220" width="316" height="248" rx="98" fill="url(#${prefix}-${id==='aria'?'sky':'visor'})" stroke="#e9ffff" stroke-opacity=".6" stroke-width="5"/><path d="M281 255 Q391 214 486 242" fill="none" stroke="#fff" stroke-width="14" opacity=".16" stroke-linecap="round"/><rect x="258" y="236" width="284" height="209" rx="91" fill="url(#${prefix}-shine)" opacity=".22"/>`;
}
function eyeShape(id,p){
  if(id==='mira')return `<g class="avatar25-eyes 2d5-eyes"><path d="M302 347 Q337 310 369 347 Q339 365 302 347Z" fill="#fff" stroke="${p.hair}" stroke-width="6"/><path d="M431 347 Q464 310 499 347 Q461 365 431 347Z" fill="#fff" stroke="${p.hair}" stroke-width="6"/><ellipse cx="337" cy="345" rx="13" ry="17" fill="#745777"/><ellipse cx="463" cy="345" rx="13" ry="17" fill="#745777"/><circle cx="333" cy="338" r="6" fill="#fff"/><circle cx="459" cy="338" r="6" fill="#fff"/><ellipse class="avatar25-eyelid" cx="337" cy="345" rx="36" ry="2" fill="#f7d5c2"/><ellipse class="avatar25-eyelid" cx="463" cy="345" rx="36" ry="2" fill="#f7d5c2"/></g>`;
  return `<g class="avatar25-eyes 2d5-eyes"><g class="avatar25-eye"><ellipse cx="335" cy="345" rx="28" ry="43" fill="${p.eye}" opacity=".45" filter="url(#rainy25-eye-glow)"/><ellipse cx="335" cy="345" rx="24" ry="36" fill="${p.eye}"/><ellipse cx="328" cy="332" rx="9" ry="13" fill="#fff"/><circle cx="348" cy="364" r="5" fill="#fff" opacity=".66"/></g><g class="avatar25-eye"><ellipse cx="465" cy="345" rx="28" ry="43" fill="${p.eye}" opacity=".45" filter="url(#rainy25-eye-glow)"/><ellipse cx="465" cy="345" rx="24" ry="36" fill="${p.eye}"/><ellipse cx="458" cy="332" rx="9" ry="13" fill="#fff"/><circle cx="478" cy="364" r="5" fill="#fff" opacity=".66"/></g><ellipse class="avatar25-eyelid" cx="335" cy="345" rx="39" ry="2" fill="#dcfff7"/><ellipse class="avatar25-eyelid" cx="465" cy="345" rx="39" ry="2" fill="#dcfff7"/></g>`;
}
export function avatarMarkup(id,prefix='rainy25'){
  const valid=Object.hasOwn(AVATAR_STYLES,id)?id:'nomi';
  const p=AVATAR_STYLES[valid];
  const token=typeof prefix==='string'&&/^[a-zA-Z][a-zA-Z0-9_-]{0,40}$/.test(prefix)?prefix:'rainy25';
  const eyeMarkup=eyeShape(valid,p).replaceAll('rainy25-eye-glow',`${token}-eye-glow`);
  const cheek=valid==='mira'?'#f0a1aa':p.tint;
  return `<svg class="rainy-2d5-portrait 2d5-portrait" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" role="img" aria-label="${p.name} — AI туслах" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="${token}-halo"><stop stop-color="#fff" stop-opacity=".94"/><stop offset=".55" stop-color="${p.tint}" stop-opacity=".24"/><stop offset="1" stop-color="${p.tint}" stop-opacity="0"/></radialGradient>
    <linearGradient id="${token}-jacket" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#fff"/><stop offset=".31" stop-color="${p.light}"/><stop offset=".75" stop-color="${p.body}"/><stop offset="1" stop-color="${p.deep}"/></linearGradient>
    <linearGradient id="${token}-shell" x1="0" y1="0" x2=".9" y2="1"><stop stop-color="#fff"/><stop offset=".43" stop-color="${p.light}"/><stop offset=".81" stop-color="#d3ebe8"/><stop offset="1" stop-color="${p.tint}"/></linearGradient>
    <linearGradient id="${token}-visor" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#224957"/><stop offset=".51" stop-color="#102e40"/><stop offset="1" stop-color="#35646b"/></linearGradient>
    <linearGradient id="${token}-sky" x1="0" y1="0" x2=".9" y2="1"><stop stop-color="#d6fbff"/><stop offset=".56" stop-color="#a1d6f4"/><stop offset="1" stop-color="#668ec8"/></linearGradient>
    <linearGradient id="${token}-shine" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#fff" stop-opacity=".6"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="${token}-skin" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#ffeae0"/><stop offset=".6" stop-color="#f6cdbd"/><stop offset="1" stop-color="#d8a1a1"/></linearGradient>
    <filter id="${token}-blur" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="7"/></filter>
    <filter id="${token}-eye-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
    <clipPath id="${token}-mask"><rect x="0" y="0" width="800" height="800"/></clipPath>
  </defs>
  <g clip-path="url(#${token}-mask)">
    <ellipse cx="400" cy="379" rx="325" ry="338" fill="url(#${token}-halo)"/>
    <g class="avatar25-orbit" opacity=".73"><circle cx="400" cy="371" r="310" stroke="#fff" stroke-width="2.5" fill="none"/><circle cx="400" cy="371" r="280" stroke="${p.tint}" stroke-width="2" stroke-dasharray="5 21" fill="none"/><path d="M635 145 L645 169 L668 178 L644 187 L635 211 L626 187 L604 178 L627 169Z" fill="#fff"/><path d="M172 258 L180 274 L196 280 L179 286 L172 302 L166 286 L150 280 L166 274Z" fill="${p.tint}"/></g>
    <!-- 2.5D head only, no neck, shoulders or torso -->
    <ellipse cx="400" cy="671" rx="168" ry="17" fill="${p.deep}" opacity=".06" filter="url(#${token}-blur)"/>
    <g class="avatar25-float avatar25-head-only">
      <g transform="translate(400 390) scale(1.32) translate(-400 -350)">
      <g class="${({nomi:'avatar25-antenna',mira:'avatar25-human-hair',kiki:'avatar25-fox-ears',aria:'avatar25-hologram-halo',bobo:'avatar25-bunny-ears'})[valid]}">${headAccessory(valid,p)}</g>
      <g class="avatar25-head 2d5-head">
        ${headShape(valid,p,token)}
        <g class="avatar25-gaze">${eyeMarkup}</g>
        <ellipse cx="283" cy="413" rx="27" ry="14" fill="${cheek}" opacity=".33"/>
        <ellipse cx="517" cy="413" rx="27" ry="14" fill="${cheek}" opacity=".33"/>
        <g class="avatar25-mouth-group">
          <path class="avatar25-mouth-smile" d="M368 428 Q399 464 432 428" stroke="${valid==='mira'?'#b27681':p.eye}" stroke-width="9" fill="none" stroke-linecap="round"/>
          <ellipse class="avatar25-mouth-open 2d5-mouth-open" cx="400" cy="438" rx="18" ry="6" fill="${valid==='mira'?'#8c495e':'#173a43'}" stroke="${valid==='mira'?'#bd8190':p.tint}" stroke-width="3" opacity="0"/>
          <ellipse class="avatar25-mouth-tongue" cx="400" cy="448" rx="9" ry="4" fill="#f7a7be" opacity="0"/>
        </g>
        ${valid==='kiki'?'<path d="M270 393 L300 400 M270 416 L297 419 M531 393 L500 400 M531 416 L502 419" stroke="#ffdac1" stroke-width="5" stroke-linecap="round" opacity=".75"/>':''}
        ${valid==='aria'?'<path d="M271 263 Q400 229 528 262" stroke="#fff" stroke-width="8" opacity=".39" fill="none"/>':''}
      </g>
      </g>
    </g>
  </g></svg>`;
}
export class IllustratedAvatar25D{
  constructor(container){
    this.container=container;
    this.current='nomi';this.state='ready';this.level=0;
    this.move=e=>this.onPointer(e);
    this.leave=()=>{container.style.removeProperty('--look-x');container.style.removeProperty('--look-y');container.style.removeProperty('--head-turn');};
    container.addEventListener('pointermove',this.move,{passive:true});
    container.addEventListener('pointerleave',this.leave);
    this.setAvatar('nomi');
  }
  setAvatar(id){
    this.current=Object.hasOwn(AVATAR_STYLES,id)?id:'nomi';
    this.container.innerHTML=avatarMarkup(this.current,'rainy25-live');
    this.mouth=this.container.querySelector('.avatar25-mouth-open');
    this.tongue=this.container.querySelector('.avatar25-mouth-tongue');
    this.setState(this.state);return true;
  }
  setState(state){this.state=state;this.container.dataset.expression=expressionFor(state);this.setLevel(this.level);}
  setLevel(input){
    this.level=normalizeVoiceEnergy(input);
    const active=this.state==='speaking';
    const magnitude=active?Math.max(.10,this.level):0;
    this.container.style.setProperty('--sound-level',String(magnitude));
    if(this.mouth){
      this.mouth.setAttribute('ry',String(6+Math.round(magnitude*28)));
      this.mouth.setAttribute('rx',String(18+Math.round(magnitude*4)));
      this.mouth.setAttribute('opacity',active?'.98':'0');
    }
    if(this.tongue)this.tongue.setAttribute('opacity',active&&magnitude>.36?'.9':'0');
  }
  onPointer(e){
    if(!e.isPrimary||window.matchMedia?.('(prefers-reduced-motion:reduce)').matches)return;
    const rect=this.container.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const x=Math.max(-1,Math.min(1,2*(e.clientX-rect.left)/rect.width-1));
    const y=Math.max(-1,Math.min(1,2*(e.clientY-rect.top)/rect.height-1));
    this.container.style.setProperty('--look-x',(x*10).toFixed(1)+'px');
    this.container.style.setProperty('--look-y',(y*6).toFixed(1)+'px');
    this.container.style.setProperty('--head-turn',(x*2).toFixed(1)+'deg');
  }
  resize(){}
  dispose(){this.container.removeEventListener('pointermove',this.move);this.container.removeEventListener('pointerleave',this.leave);this.container.replaceChildren();}
}
