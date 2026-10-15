import {evaluateQuestion} from './core.mjs';
export function parseInventorySnapshot(input){
 if(!input||!Array.isArray(input.items)||input.items.length>2000)throw Object.assign(Error('Inventory items required (max 2000)'),{code:400});
 const ids=new Set();
 return input.items.map(row=>{
  if(!row||typeof row.id!=='string'||!(/^[a-zA-Z0-9_-]{1,80}$/).test(row.id)||ids.has(row.id)||
     !Number.isSafeInteger(row.priceMnt)||row.priceMnt<0||!Number.isSafeInteger(row.stock)||row.stock<0)
   throw Object.assign(Error('POS inventory id/price/stock invalid'),{code:400});
  ids.add(row.id);return {id:row.id,priceMnt:row.priceMnt,stock:row.stock};
 });
}
export function applyInventorySnapshot(catalog,rows){
 const data=new Map(rows.map(x=>[x.id,x]));
 return catalog.map(item=>{
  const row=data.get(item.id);
  // Demo/unverified catalog entries must never become sale-ready solely via POS upload.
  if(!row||item.verified!==true)return {...item};
  return {...item,priceMnt:row.priceMnt,stock:row.stock};
 });
}
export function shouldEscalateVoiceText(text){
 if(typeof text!=='string'||text.length>2000)return true;
 return ['emergency','pharmacist'].includes(evaluateQuestion(text,[]).kind);
}
export function buildProviderStatus(env,agentId,clinicalApproved){
 const key=Boolean(env.ELEVENLABS_API_KEY),id=Boolean(agentId);
 return {
  voice:{configured:key&&id,clinicalApproved:clinicalApproved===true,liveVerified:false,
   checkedByProvider:false,message:key&&id?'API key ба Agent ID бүртгэлтэй. Provider холболтыг тусад нь шалгана.':'ElevenLabs тохиргоо дутуу.'},
  vision:{configured:Boolean(env.OPENAI_API_KEY),liveVerified:false},
  pharmacist:{configured:Boolean(env.PHARMACIST_WEBHOOK_URL),liveVerified:false},
  inventory:{mode:'manual-snapshot',livePOSConnected:false}
 };
}
