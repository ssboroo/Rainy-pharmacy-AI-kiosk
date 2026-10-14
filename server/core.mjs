import {EXAMPLE_MEDICINES} from './demo-catalog.mjs';
export const AVATARS = [
  {id:'nomi',name:'Номи',style:'Робот',color:'#6bd7bc'},
  {id:'mira',name:'Мира',style:'AI хүн',color:'#a7adf7'},
  {id:'kiki',name:'Кики',style:'Хөөрхөн робот',color:'#ffc599'},
  {id:'aria',name:'Ариа',style:'Hologram',color:'#8bc7f6'},
  {id:'bobo',name:'Бобо',style:'Туслах робот',color:'#fbb7d9'}
];
export function voiceAllowed(env, agentId) { return voiceConnectionStatus(env,agentId).voiceReady; }
export const DEFAULT_SETTINGS = {
  pharmacyName:'RAINY Pharmacy',assistantName:'Номи',
  greeting:'Сайн байна уу! Би таны эмийн сангийн AI туслах. Надаас асуугаарай.',
  defaultAvatar:'nomi',accent:'#35bea3',locationName:'Эмийн сангийн мэдээллийн цэг',agentId:''
};
export const DEMO_CATALOG = EXAMPLE_MEDICINES;
export function voiceConnectionStatus(env,agentId){
  const agentConfigured=typeof agentId==='string'&&agentId.trim().length>0;
  const keyConfigured=typeof env?.ELEVENLABS_API_KEY==='string'&&env.ELEVENLABS_API_KEY.length>0;
  const clinicalApproved=env?.VOICE_AGENT_CLINICAL_APPROVED==='true';
  return {agentConfigured,keyConfigured,clinicalApproved,voiceReady:agentConfigured&&keyConfigured&&clinicalApproved};
}
export function mergeLegacyDemoCatalog(items){
  if(!Array.isArray(items))return items;
  const ids=['demo-paracetamol','demo-ibuprofen','demo-loratadine'];
  const legacy=items.length===3&&items.every((v,i)=>v&&v.id===ids[i]&&v.verified!==true);
  return legacy?DEMO_CATALOG.map(v=>({...v})):items;
}
export function normalizeText(s) { return String(s||'').normalize('NFKC').toLocaleLowerCase('mn').replace(/\s+/g,' ').trim(); }
export function searchCatalog(q,items) {
  const text=normalizeText(q); if(!text) return items.slice(0,60);
  return items.filter(v=>[v.name,...(v.aliases||[])].some(n=>normalizeText(n).includes(text))) .slice(0,60);
}
const emergency=['амьсгал давч','амьсгал боог','ухаан ал','зүрх зогс','таталт','хордлого','хордсон','харшлын шок','цус их ал','амиа хор','анафилак'];
const clinical=['тун','хэдэн ширхэг','хэдийг уух','яаж уух','ууж болох','уулгах','жирэмсэн','хөхүүл','нярай','хүүхэд','хүүхдэд','гаж нөлөө','харшил','давхар уух','хамт уух','зэрэг уух','онош','эмчилгээ','өвдөж','өвдөөд','юу уух','жоргүй өг','солих уу','эм орлуулах'];
export function evaluateQuestion(question,items=DEMO_CATALOG) {
  const q=normalizeText(question).slice(0,500);
  if(q.length<2) return {kind:'invalid',reply:'Асуултаа арай дэлгэрэнгүй бичнэ үү.',requiresPharmacist:false};
  if(emergency.some(w=>q.includes(w))) return {kind:'emergency',reply:'Яаралтай тусламж шаардсан байж болзошгүй. Ажилтныг даруй дуудаж, Монголд байгаа бол 103 дугаарт залгана уу. AI-аас хариу хүлээн цаг алдаж болохгүй.',requiresPharmacist:true};
  if(clinical.some(w=>q.includes(w))) return {kind:'pharmacist',reply:'Энэ асуултад эм зүйч таны нөхцөл байдлыг шалгаж зөвлөгөө өгөх ёстой. Доорх Эм зүйч дуудах товчийг ашиглана уу.',requiresPharmacist:true};
  const item=items.find(v=>[v.name,...(v.aliases||[])].some(w=>q.includes(normalizeText(w))));
  if(!item) return {kind:'unknown',reply:'Одоогийн каталогоос баталгаатай хариу олдсонгүй. Эмийн шошгыг уншуулах эсвэл эм зүйчээс лавлана уу.',requiresPharmacist:true};
  if(!item.verified) return {kind:'demo',medicine:item,reply:item.name+' — туршилтын бүртгэл, эмийн сангийн бодит үнэ, үлдэгдэл, заавар баталгаажаагүй. '+(item.description||'')+' '+(item.warnings?'Анхааруулга: '+item.warnings+' ':'')+'Эм зүйчээс нягтална уу.',requiresPharmacist:true};
  if(q.includes('үнэ')||q.includes('хэд вэ')) return {kind:'catalog',medicine:item,reply:item.name+': '+(item.priceMnt==null?'үнэ бүртгээгүй.':item.priceMnt.toLocaleString('mn-MN')+' ₮.')+' Шинэчилсэн: '+item.verifiedAt+'.',requiresPharmacist:false};
  if(q.includes('байгаа')||q.includes('үлдэгдэл')||q.includes('хаана')) return {kind:'catalog',medicine:item,reply:item.name+': '+(item.stock==null?'үлдэгдэл бүртгээгүй.':'үлдэгдэл '+item.stock+' ширхэг.')+(item.shelf?' Байршил: '+item.shelf+'.':'')+' Ажилтнаас нягтална уу.',requiresPharmacist:false};
  return {kind:'catalog',medicine:item,reply:item.name+' нэртэй бүтээгдэхүүний баталгаажсан каталогийн бүртгэл байна. Эх сурвалж: '+item.sourceUrl+'. Эмчилгээний мэдээллийг эм зүйчээс лавлана уу.',requiresPharmacist:false};
}
const txt=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
export function validateSettings(input,prev=DEFAULT_SETTINGS) {
  if(!input||typeof input!=='object'||Array.isArray(input)) throw Error('Тохиргооны формат буруу.');
  const next={...prev};
  for(const key of ['pharmacyName','assistantName','greeting','locationName']) if(key in input){
    if(typeof input[key]!=='string'||!input[key].trim()) throw Error(key+' хоосон байж болохгүй.');
    next[key]=txt(input[key],key==='greeting'?300:80);
  }
  if('defaultAvatar' in input){if(!AVATARS.some(a=>a.id===input.defaultAvatar))throw Error('AI дүр танигдсангүй.');next.defaultAvatar=input.defaultAvatar;}
  if('accent' in input){if(!/^#[a-fA-F0-9]{6}$/.test(input.accent))throw Error('Өнгө #RRGGBB форматаар байна.');next.accent=input.accent;}
  if('agentId' in input){if(typeof input.agentId!=='string'||!/^[a-zA-Z0-9_-]{0,120}$/.test(input.agentId))throw Error('Agent ID формат буруу.');next.agentId=input.agentId;}
  return next;
}
export function validateCatalog(input){
  if(!Array.isArray(input)||input.length>2000)throw Error('Каталог массив, ихдээ 2000 бүтээгдэхүүн байна.');
  const ids=new Set();
  return input.map((v,i)=>{
    if(!v||typeof v!=='object'||typeof v.name!=='string'||!v.name.trim())throw Error('Эмийн нэр дутуу: мөр '+(i+1));
    const id=txt(v.id||'medicine-'+i,80);
    if(!/^[a-zA-Z0-9_-]+$/.test(id)||ids.has(id))throw Error('ID давхардсан/буруу.');
    ids.add(id);
    const verified=v.verified===true,sourceUrl=txt(v.sourceUrl,300),verifiedAt=txt(v.verifiedAt,30);
    if(verified&&(!/^https:\/\//.test(sourceUrl)||!/^\d{4}-\d\d-\d\d/.test(verifiedAt)))throw Error(v.name+': баталгаажуулах эх сурвалж, огноо шаардлагатай.');
    if(v.priceMnt!=null&&(!Number.isInteger(v.priceMnt)||v.priceMnt<0))throw Error('Үнэ буруу.');
    if(v.stock!=null&&(!Number.isInteger(v.stock)||v.stock<0))throw Error('Үлдэгдэл буруу.');
    return {id,name:txt(v.name,120),aliases:Array.isArray(v.aliases)?v.aliases.filter(x=>typeof x==='string').slice(0,8).map(x=>txt(x,80)):[],category:txt(v.category,80),form:txt(v.form,120),priceMnt:v.priceMnt??null,stock:v.stock??null,shelf:txt(v.shelf,80),notes:txt(v.notes,350),description:txt(v.description,550),warnings:txt(v.warnings,550),storage:txt(v.storage,380),verified,sourceUrl,verifiedAt};
  });
}
