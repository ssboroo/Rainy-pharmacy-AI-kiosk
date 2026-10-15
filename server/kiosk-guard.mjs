// Mongolia-local operating hours and conservative voice-session request budget.
export function pharmacyClock(date=new Date()){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ulaanbaatar',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const hour=Number(parts.find(p=>p.type==='hour')?.value);
 const minute=Number(parts.find(p=>p.type==='minute')?.value);
 return hour*60+minute;
}
export function isKioskOpen(date=new Date(),start='08:00',end='22:00'){
 const parse=value=>{if(!/^(?:[01]\\d|2[0-3]):[0-5]\\d$/.test(value))throw Error('Invalid opening hours');const [h,m]=value.split(':').map(Number);return h*60+m;};
 const now=pharmacyClock(date),a=parse(start),b=parse(end);
 return a===b?false:a<b?(now>=a&&now<b):(now>=a||now<b);
}
export function createVoiceIssueBudget({limit=6,windowMs=3600000,now=()=>Date.now()}={}){
 const buckets=new Map();
 return {take(key){const t=now();const previous=(buckets.get(key)||[]).filter(v=>t-v<windowMs);if(previous.length>=limit){buckets.set(key,previous);return false;}previous.push(t);buckets.set(key,previous);if(buckets.size>5000){for(const [id,entries] of buckets)if(entries[entries.length-1]<t-windowMs)buckets.delete(id);}return true;}};
}
