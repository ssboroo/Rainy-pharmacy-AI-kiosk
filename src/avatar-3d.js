import * as THREE from 'three';
import {AVATAR_3D_PROFILES,clampAudioLevel,resolveExpression} from './avatar-profiles.js';

const EASE=0.15;
const sphereGeometry=new THREE.SphereGeometry(1,40,28);
const matte=(color,roughness=.48,metalness=.05)=>new THREE.MeshPhysicalMaterial({color,roughness,metalness,clearcoat:.25,clearcoatRoughness:.22});
const glass=(color,transmission=0)=>new THREE.MeshPhysicalMaterial({color,roughness:.16,metalness:.12,clearcoat:1,clearcoatRoughness:.08,transmission});
const dark=()=>matte('#263e43',.38);
const eyeWhite=()=>glass('#f9fefd');
const highlight=()=>new THREE.MeshBasicMaterial({color:'#ffffff'});
const glow=(color)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity:.78,depthWrite:false});
function mesh(parent,geometry,material,x,y,z,sx=1,sy=1,sz=1){
  const obj=new THREE.Mesh(geometry,material);
  obj.position.set(x,y,z);obj.scale.set(sx,sy,sz);parent.add(obj);return obj;
}
function ellipsoid(parent,material,x,y,z,sx,sy,sz){
  return mesh(parent,sphereGeometry,material,x,y,z,sx,sy,sz);
}
function capsule(parent,material,x,y,z,sx,sy,sz){
  const obj=ellipsoid(parent,material,x,y,z,sx,sy,sz);return obj;
}
function makePersona(profile){
  const root=new THREE.Group();
  const torso=new THREE.Group();root.add(torso);
  const trim=matte(profile.trim,.35,.27);
  const shell=glass(profile.skin), suit=matte(profile.body,.34,.11);
  const accent=matte(profile.accent,.22,.19);
  const faceMat=profile.kind==='human'?matte(profile.skin,.7,0):shell;
  const irises=glass(profile.iris);
  const black=dark();
  const white=eyeWhite();
  const soft=glow(profile.accent);

  // Rounded silicone/porcelain finish, broad shoulders, collar and chest light.
  ellipsoid(torso,suit,0,-1.46,-.06,1.33,.96,.72);
  ellipsoid(torso,trim,0,-1.07,.2,.65,.23,.56);
  ellipsoid(torso,accent,0,-1.09,.65,.28,.075,.06);
  ellipsoid(torso,glass('#ffffff'),0,-1.47,.61,.21,.21,.14);
  const core=ellipsoid(torso,soft,0,-1.47,.738,.092,.092,.042);
  const lArm=ellipsoid(torso,suit,-1.05,-1.72,-.04,.45,.70,.54);
  const rArm=ellipsoid(torso,suit,1.05,-1.72,-.04,.45,.70,.54);
  lArm.rotation.z=-.38;rArm.rotation.z=.38;
  ellipsoid(torso,trim,0,-.92,-.03,.33,.42,.29);

  const head=new THREE.Group();head.position.y=.18;root.add(head);
  if(profile.kind==='robot'){
    ellipsoid(head,trim,0,0,-.07,1.04,1.12,.86);
    ellipsoid(head,faceMat,0,0,.05,.995,1.065,.86);
    ellipsoid(head,glass('#faffff'),0,-.035,.57,.85,.79,.39);
    // side connectors and luminous face-panel stripe
    ellipsoid(head,trim,-1.015,-.03,.03,.19,.27,.30);
    ellipsoid(head,trim,1.015,-.03,.03,.19,.27,.30);
    ellipsoid(head,accent,-1.15,-.035,.035,.095,.15,.18);
    ellipsoid(head,accent,1.15,-.035,.035,.095,.15,.18);
    ellipsoid(head,trim,0,1.10,-.08,.075,.30,.08);
    ellipsoid(head,glass(profile.accent),0,1.34,-.08,.16,.16,.16);
    if(profile.name==='Кики'){
      const a=ellipsoid(head,shell,-.64,1.08,-.14,.27,.45,.22);
      const b=ellipsoid(head,shell,.64,1.08,-.14,.27,.45,.22);
      a.rotation.z=.35;b.rotation.z=-.35;
    }
    if(profile.name==='Бобо'){
      const bow1=ellipsoid(head,accent,-.49,1.0,.52,.28,.18,.13);
      const bow2=ellipsoid(head,accent,-.08,1.04,.52,.28,.18,.13);
      bow1.rotation.z=-.42;bow2.rotation.z=.42;
    }
  }else if(profile.kind==='hologram'){
    ellipsoid(head,trim,0,.02,-.10,1.05,1.16,.91);
    ellipsoid(head,faceMat,0,0,.08,1.0,1.10,.84);
    ellipsoid(head,glass('#edffff'),0,-.02,.51,.89,.88,.43);
    const outline=new THREE.Mesh(new THREE.TorusGeometry(1.04,.023,12,85),soft);
    outline.position.set(0,-.03,.14);outline.scale.y=1.11;head.add(outline);
    ellipsoid(head,accent,0,1.22,0,.17,.17,.13);
  }else{
    // Soft face shape, hair volume, ears and subtle nose.
    ellipsoid(head,faceMat,0,-.03,.0,.91,1.12,.79);
    ellipsoid(head,faceMat,-.91,-.1,.05,.18,.28,.16);
    ellipsoid(head,faceMat,.91,-.1,.05,.18,.28,.16);
    const hair=matte(profile.trim,.86,0);
    ellipsoid(head,hair,0,.90,-.19,.98,.48,.82);
    for(let i=0;i<6;i++){
      const x=-.77+i*.31;
      const curl=ellipsoid(head,hair,x,.82-Math.abs(x)*.17,.48,.24,.36,.31);
      curl.rotation.z=(i-2.5)*-.13;
    }
    ellipsoid(head,matte('#dfa78b',.7,0),0,-.19,.77,.11,.22,.14);
    for(const x of [-.94,.94])ellipsoid(head,hair,x,.27,-.34,.19,.69,.31);
  }

  // Eyes pivot as a unit for expressive squint, focus and natural blinking.
  const eyeGroups=[],brows=[];
  for(const side of [-1,1]){
    const eye=new THREE.Group();
    eye.position.set(side*.4,.2,.76);head.add(eye);
    if(profile.kind==='human'){
      ellipsoid(eye,white,0,0,.025,.225,.18,.125);
      ellipsoid(eye,irises,side*.005,-.01,.145,.105,.116,.047);
      ellipsoid(eye,black,side*.005,-.01,.179,.051,.067,.02);
      ellipsoid(eye,highlight,-.038,.045,.198,.034,.040,.012);
    }else{
      ellipsoid(eye,irises,0,0,.12,.188,.245,.105);
      ellipsoid(eye,glow('#ffffff'),-.055,.075,.215,.05,.067,.025);
      if(profile.kind==='hologram')ellipsoid(eye,soft,0,0,.18,.21,.27,.022);
    }
    const brow=ellipsoid(head,profile.kind==='human'?matte(profile.trim):accent,side*.41,.54,.81,.25,.045,.048);
    brow.rotation.z=side*-.08;brows.push(brow);eyeGroups.push(eye);
    const cheek=ellipsoid(head,matte(profile.kind==='human'?'#e7a49b':profile.accent,.76),side*.68,-.22,.71,.24,.09,.07);
    cheek.material.transparent=true;cheek.material.opacity=.65;
  }

  const mouthGroup=new THREE.Group();mouthGroup.position.set(0,-.40,.83);head.add(mouthGroup);
  const lips=matte(profile.kind==='human'?'#a76378':'#406b72',.36);
  const cavity=ellipsoid(mouthGroup,dark(),0,0,.026,.22,.06,.06);
  const upper=ellipsoid(mouthGroup,lips,0,.072,.085,.23,.036,.03);
  const lower=ellipsoid(mouthGroup,lips,0,-.072,.08,.22,.035,.03);
  const smileLeft=ellipsoid(mouthGroup,lips,-.20,.03,.068,.043,.036,.03);
  const smileRight=ellipsoid(mouthGroup,lips,.20,.03,.068,.043,.036,.03);
  // Premium depth via soft rim and studio-lit reflective material.
  const jaw=ellipsoid(head,profile.kind==='human'?faceMat:faceMat,0,-.78,.24,.64,.26,.55);
  jaw.material=faceMat;
  const halo=new THREE.Mesh(new THREE.TorusGeometry(1.34,.027,12,100),glow(profile.accent));
  halo.position.set(0,.05,-.58);halo.scale.y=1.04;root.add(halo);

  return {root,head,torso,eyeGroups,brows,mouthGroup,cavity,upper,lower,jaw,halo,core};
}

/**
 * High-quality stylized PBR 3D (not a photorealistic scan). WebGL2 is
 * optional; the pre-existing CSS portrait remains as a fallback.
 */
export class PharmacyAvatar3D{
  constructor(container,onUnavailable=()=>{}){
    this.container=container;
    this.onUnavailable=onUnavailable;
    this.state='ready';
    this.level=0;
    this.target=0;
    this.model=null;
    this.elapsed=0;
    this.running=false;
    this.disposed=false;
    this.raf=null;
    this.reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
    this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(32,1,.1,40);
    this.camera.position.set(0,.13,6.75);
    this.camera.lookAt(0,-.12,0);
    this.scene.add(new THREE.HemisphereLight('#ffffff','#c5d4d0',2));
    const key=new THREE.DirectionalLight('#fffef7',3.7);
    key.position.set(-3,5,7);this.scene.add(key);
    const fill=new THREE.DirectionalLight('#d1ffff',2.1);
    fill.position.set(4,.5,3);this.scene.add(fill);
    const rim=new THREE.DirectionalLight('#a0ddf1',2.9);
    rim.position.set(0,3,-5);this.scene.add(rim);
    const canvas=document.createElement('canvas');
    canvas.className='pharmacy-3d-canvas';
    canvas.setAttribute('aria-hidden','true');
    this.canvas=canvas;
    this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.23;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));
    container.append(canvas);
    this.resizeObserver=new ResizeObserver(()=>this.resize());
    this.resizeObserver.observe(container);
    document.addEventListener('visibilitychange',this.visibility=()=>{
      if(document.hidden)this.pause();else if(!this.disposed)this.start();
    });
    canvas.addEventListener('webglcontextlost',this.contextLost=e=>{
      e.preventDefault();this.pause();this.onUnavailable('GPU context unavailable');
    });
    this.resize();
    this.setAvatar('nomi');
    this.start();
  }
  resize(){
    if(this.disposed)return;
    const w=Math.max(1,this.container.clientWidth),h=Math.max(1,this.container.clientHeight);
    this.camera.aspect=w/h;
    // Larger portrait head in kiosk mode; narrower field on tall displays.
    const immersive=document.body.classList.contains('immersive-kiosk');
    this.camera.position.z=immersive?5.7:6.9;
    this.camera.fov=(w/h<.9)?37:33;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w,h,false);
  }
  setAvatar(id){
    if(this.disposed)return false;
    const profile=AVATAR_3D_PROFILES[id];
    if(!profile)return false;
    if(this.model){
      this.scene.remove(this.model.root);
      // Geometry/material ownership is local except shared sphereGeometry.
      const materials=new Set();
      this.model.root.traverse(node=>{
        if(node.isMesh && node.material) (Array.isArray(node.material)?node.material:[node.material]).forEach(m=>materials.add(m));
        if(node.isMesh && node.geometry && node.geometry!==sphereGeometry)node.geometry.dispose();
      });
      materials.forEach(m=>m.dispose());
    }
    this.model=makePersona(profile);
    this.scene.add(this.model.root);
    this.container.dataset.avatar3d=id;
    return true;
  }
  setState(state){this.state=state;this.container.dataset.expression=resolveExpression(state);}
  setLevel(value){this.target=clampAudioLevel(value);}
  start(){
    if(this.running||this.disposed||document.hidden)return;
    this.running=true;
    this.frame(performance.now());
  }
  pause(){
    this.running=false;
    if(this.raf!==null)cancelAnimationFrame(this.raf);
    this.raf=null;
  }
  frame(now){
    if(!this.running||this.disposed)return;
    this.raf=requestAnimationFrame(t=>this.frame(t));
    const m=this.model;if(!m)return;
    const t=now*.001;
    this.level+=(this.target-this.level)*EASE;
    const speaking=this.state==='speaking';
    const express=resolveExpression(this.state);
    const blinkPhase=(t*1.1+Math.sin(t*.45)*.18)%4.8;
    const blink=(blinkPhase>.08&&blinkPhase<.22)?Math.max(.06,Math.abs(blinkPhase-.15)*13):1;
    const lip=speaking?Math.min(1,.05+this.level*1.14):.015;
    m.cavity.scale.y=Math.max(.07,lip*2.8);
    m.cavity.scale.x=.9+lip*.25;
    m.upper.position.y=.07+lip*.22;
    m.lower.position.y=-.07-lip*.20;
    m.mouthGroup.position.y=-.40-lip*.02;
    m.jaw.position.y=-.78-lip*.055;
    m.eyeGroups.forEach((e,i)=>{
      e.scale.y=this.reduced?1:Math.max(.07,blink)*(express==='thinking'?.86:1);
      e.position.x=(i===0?-.4:.4)+(express==='attentive'?.018*Math.sin(t):0);
    });
    m.brows.forEach((b,i)=>{
      b.position.y=.54+(express==='thinking'?((i===0)?-.045:.12):(express==='attentive'?.055:0));
      b.rotation.z=(i===0?-1:1)*(express==='concerned'?.22:-.08);
    });
    m.head.rotation.y=this.reduced?0:Math.sin(t*.53)*.065;
    m.head.rotation.x=this.reduced?0:Math.sin(t*.38)*.03+(express==='attentive'?.045:0);
    m.root.position.y=this.reduced?0:Math.sin(t*1.1)*.065;
    m.torso.scale.y=1+(this.reduced?0:Math.sin(t*1.9)*.009);
    m.halo.rotation.z=t*.045;
    m.halo.material.opacity=.4+(speaking?this.level*.48:.12);
    m.core.material.opacity=.44+(speaking?this.level*.5:.12);
    this.renderer.render(this.scene,this.camera);
  }
  dispose(){
    if(this.disposed)return;
    this.pause();
    this.disposed=true;
    this.resizeObserver?.disconnect();
    document.removeEventListener('visibilitychange',this.visibility);
    this.canvas.removeEventListener('webglcontextlost',this.contextLost);
    this.renderer.dispose();
    this.canvas.remove();
  }
}
