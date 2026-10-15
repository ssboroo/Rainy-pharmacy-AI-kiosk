// Owner-only read-only metering for the shared ElevenLabs workspace.
// Never return xi-api-key, provider raw JSON, purchased PAYG funds or estimated per-tenant credits.
const finiteNonnegative=v=>Number.isSafeInteger(v)&&v>=0?v:null;
export function normalizeElevenLabsSubscription(data,checkedAt=new Date().toISOString()){
 const used=finiteNonnegative(data?.character_count),limit=finiteNonnegative(data?.character_limit);
 const included=used===null||limit===null?null:{used,limit,remaining:Math.max(0,limit-used),unit:'included-credits'};
 return {
  ok:true,scope:'shared-workspace',source:'elevenlabs-user-subscription',checkedAt,stale:false,
  tier:typeof data?.tier==='string'?data.tier.slice(0,50):'unknown',
  status:typeof data?.status==='string'?data.status.slice(0,50):'unknown',
  included,
  nextResetUnix:finiteNonnegative(data?.next_character_count_reset_unix),
  paygBalanceAvailable:false,
  billingMode:'provider-managed',
  apiUsageSupported:true,
  localQuotaEnforced:false,
  paygNote:'API нь энэ түлхүүрийн ElevenLabs workspace-ийн багцын кредитийг эхэлж, дууссаны дараа PAYG Top Up үлдэгдлийг ашиглана. Багцын үлдэгдэл 0 болсон ч сайт API-г хориглохгүй. PAYG идэвхтэй эсэх, бодит үлдэгдлийг ElevenLabs Developers → Top Up хэсэгт шалгана.',
  sharedNote:'Энэ нь нэг ElevenLabs API key-ийн workspace-н нийт хэрэглээ; байгууллага бүрийн тусдаа credit биш.'
 };
}
export function createElevenLabsCreditMonitor({
 key=()=>process.env.ELEVENLABS_API_KEY||'',fetchImpl=fetch,now=()=>Date.now(),
 ttlMs=60000,errorTtlMs=30000,timeoutMs=7000
}={}){
 let cached=null,validUntil=0,pending=null,lastKey=null;
 async function get(){
  const activeKey=key();
  if(!activeKey)return {ok:false,reason:'not-configured',included:null,scope:'shared-workspace',checkedAt:null,message:'ElevenLabs API түлхүүр тохируулаагүй.'};
  // Never reuse another key's workspace balance after credential rotation.
  if(activeKey!==lastKey){lastKey=activeKey;cached=null;validUntil=0;}
  if(pending)return pending;
  if(cached&&now()<validUntil)return cached;
  pending=(async()=>{
   try{
    const response=await fetchImpl('https://api.elevenlabs.io/v1/user/subscription',{
      method:'GET',headers:{'xi-api-key':activeKey,'Accept':'application/json'},
      signal:AbortSignal.timeout(timeoutMs)
    });
    if(!response.ok){
      const reason=response.status===401?'invalid-key':response.status===403?'permission-denied':
        response.status===429?'rate-limited':'provider-unavailable';
      cached={ok:false,reason,scope:'shared-workspace',included:null,checkedAt:new Date(now()).toISOString(),
        message:reason==='permission-denied'?'ElevenLabs API key-д User/Subscription унших эрх дутуу.':
          reason==='invalid-key'?'ElevenLabs API key хүчингүй эсвэл өөр workspace-д хамаарна.':
          reason==='rate-limited'?'ElevenLabs API хүсэлтийн лимит хүрсэн.':'ElevenLabs хэрэглээний мэдээлэл одоогоор боломжгүй.'};
      validUntil=now()+errorTtlMs;
      return cached;
    }
    const raw=await response.json();
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid subscription response');
    cached=normalizeElevenLabsSubscription(raw,new Date(now()).toISOString());
    validUntil=now()+ttlMs;
    return cached;
   }catch{
    cached={ok:false,reason:'provider-unavailable',scope:'shared-workspace',included:null,
      checkedAt:new Date(now()).toISOString(),message:'ElevenLabs хэрэглээний мэдээллийг татаж чадсангүй.'};
    validUntil=now()+errorTtlMs;
    return cached;
   }finally{pending=null;}
  })();
  return pending;
 }
 return {get};
}
