import {isWakeGreeting,getWakeRetryDelay} from './kiosk-policy.js';

/**
 * On-device browser wake greeting adapter.
 * The browser's SpeechRecognition service may be network-backed.
 * No session is billed while waiting for a greeting.
 */
export class WakeGreetingListener {
  constructor({SpeechRecognition,onWake,onState=()=>{},onFailure=()=>{}}) {
    this.SpeechRecognition=SpeechRecognition;
    this.onWake=onWake;
    this.onState=onState;
    this.onFailure=onFailure;
    this.enabled=false;
    this.paused=true;
    this.recognition=null;
    this.retryTimer=null;
    this.attempt=0;
  }
  enable() {
    this.enabled=true;
    this.paused=false;
    this.start();
  }
  pause() {
    this.paused=true;
    if(this.retryTimer){clearTimeout(this.retryTimer);this.retryTimer=null;}
    const active=this.recognition;
    this.recognition=null;
    if(active){active.onend=null;active.onerror=null;active.onresult=null;try{active.abort();}catch{}}
  }
  resume(delay=0) {
    if(!this.enabled)return;
    this.pause();
    this.paused=false;
    this.retryTimer=setTimeout(()=>{this.retryTimer=null;this.start();},delay);
  }
  disable() {
    this.enabled=false;
    this.pause();
    this.onState('off');
  }
  start() {
    if(!this.enabled||this.paused||this.recognition)return;
    if(!this.SpeechRecognition){this.disable();this.onFailure('unsupported');return;}
    let listener;
    try{
      listener=new this.SpeechRecognition();
      listener.lang='mn-MN';
      listener.continuous=true;
      listener.interimResults=false;
      listener.maxAlternatives=1;
    }catch{
      this.disable();this.onFailure('unsupported');return;
    }
    this.recognition=listener;
    let lastError='';
    listener.onresult=(event)=>{
      for(let i=event.resultIndex||0;i<event.results.length;i++){
        const result=event.results[i];
        if(!result.isFinal)continue;
        const transcript=result[0]?.transcript||'';
        if(isWakeGreeting(transcript)){
          this.pause();
          this.onState('activated');
          Promise.resolve().then(()=>this.onWake(transcript)).catch(()=>this.onFailure('wake-error'));
          return;
        }
      }
    };
    listener.onerror=(event)=>{lastError=event.error||'network';};
    listener.onend=()=>{
      if(this.recognition!==listener)return;
      this.recognition=null;
      if(!this.enabled||this.paused)return;
      if(lastError){this.attempt++;const delay=getWakeRetryDelay(lastError,this.attempt);
        if(delay===null){this.disable();this.onFailure(lastError);return;}
        this.onState('retrying');this.resume(delay);return;
      }
      this.attempt=0;
      this.resume(800);
    };
    try{listener.start();this.onState('listening');}
    catch(err){
      this.recognition=null;
      this.attempt++;
      const delay=getWakeRetryDelay(err.name==='NotAllowedError'?'not-allowed':'network',this.attempt);
      if(delay===null){this.disable();this.onFailure('not-allowed');}
      else this.resume(delay);
    }
  }
}
