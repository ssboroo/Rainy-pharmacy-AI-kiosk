// Browser-safe, deterministic UI policy. Does not make medical decisions.
export function isWakeGreeting(value) {
  if (typeof value !== 'string') return false;
  const text=value.normalize('NFKC').toLocaleLowerCase('mn').trim().replace(/[.!?…。，！？]+$/gu,'').trim();
  if(text.length>32)return false;
  return ['сайн байна уу','сайн уу','сайн байна уу рэйнй','rainy сайн байна уу','рэйнй сайн байна уу'].includes(text);
}
export function getWakeRetryDelay(error,attempt=1) {
  if(['not-allowed','service-not-allowed','audio-capture','aborted'].includes(error))return null;
  if(error==='no-speech'||!error)return 800;
  return Math.min(15000,2000*Math.max(1,attempt));
}
export function toneForState(state) {
  return ({listening:'attentive',speaking:'warm',connecting:'thinking',emergency:'concerned'})[state]||'calm';
}

// Kiosk access is available 24/7; paid-session duration guards remain separate.
export function isBusinessHour(){return true;}

export function acceptVoiceTranscript(value,confidence){if(typeof value!=='string')return false;const text=value.trim();if(text.length<3||text.length>280)return false;if(['за','аан','ээ','мм','ok','hello','hi','сайн уу'].includes(text.toLowerCase()))return false;return !(typeof confidence==='number'&&confidence>0&&confidence<0.65);}
