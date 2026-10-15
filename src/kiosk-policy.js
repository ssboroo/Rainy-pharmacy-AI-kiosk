// Browser-safe, deterministic UI policy. Does not make medical decisions.
export function isWakeGreeting(value) {
  if (typeof value !== 'string') return false;
  const text=value.normalize('NFKC').toLocaleLowerCase('mn').trim().replace(/[.!?…。，！？]+$/gu,'').trim();
  if(text.length>32)return false;
  return ['сайн байна уу','сайн уу','байна уу','hello','hi'].includes(text);
}
export function getWakeRetryDelay(error,attempt=1) {
  if(['not-allowed','service-not-allowed','audio-capture','aborted'].includes(error))return null;
  if(error==='no-speech'||!error)return 800;
  return Math.min(15000,2000*Math.max(1,attempt));
}
export function toneForState(state) {
  return ({listening:'attentive',speaking:'warm',connecting:'thinking',emergency:'concerned'})[state]||'calm';
}

export function isBusinessHour(date=new Date()){return Number(new Intl.DateTimeFormat('en-GB',{hour:'2-digit',hourCycle:'h23',timeZone:'Asia/Ulaanbaatar'}).format(date))>=8&&Number(new Intl.DateTimeFormat('en-GB',{hour:'2-digit',hourCycle:'h23',timeZone:'Asia/Ulaanbaatar'}).format(date))<22;}
