// A provider may disconnect before startSession() resolves. Never adopt that session.
export function createVoiceAttempt(){
 let closed=false,lastFailure=null;
 return {
  get closed(){return closed;},
  get failure(){return lastFailure;},
  fail(details){lastFailure=voiceFailureMessage(details);return lastFailure;},
  disconnect(details={}){closed=true;return details.reason==='user'?null:this.fail(details);},
  cancel(){closed=true;}
 };
}
export function voiceFailureMessage(details={}){
 const text=String(details.message||details.closeReason||'').toLowerCase();
 const code=Number.isInteger(details.closeCode)?' (код '+details.closeCode+')':'';
 if(/credit|quota|balance|payment|billing|exceeded/.test(text))return 'ElevenLabs кредит эсвэл хэрэглээний лимит хүрсэн. Ижил workspace-ийн PAYG үлдэгдэл, API key-ийн лимитийг админ шалгана уу.'+code;
 if(/override|asr|keyword|prompt/.test(text))return 'ElevenLabs Agent-ийн System prompt / ASR keywords override тохиргоог зөвшөөрөөгүй. Админ → Agent тохиргоог шалгана уу.'+code;
 if(/permission|notallowed|denied|microphone|audio device/.test(text))return 'Микрофоны хандалт эсвэл аудио төхөөрөмжийг нээж чадсангүй. Browser-ийн микрофон зөвшөөрөл, сонгосон төхөөрөмжийг шалгана уу.'+code;
 return 'ElevenLabs дуут холболт тасарлаа'+code+'. Дахин эхлүүлэх эсвэл бичгээр асууна уу. Давтан тасарвал админ Agent холболт, кредит болон сүлжээг шалгана уу.';
}
