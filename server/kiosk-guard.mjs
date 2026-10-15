// Mongolia-local operating hours and conservative voice-session request budget.
export function pharmacyClock(date=new Date()){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ulaanbaatar',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 const hour=Number(parts.find(p=>p.type==='hour')?.value);
 const minute=Number(parts.find(p=>p.type==='minute')?.value);
 return hour*60+minute;
}
// No wall-clock restriction, including overnight and server timezone changes.
export function isKioskOpen(){return true;}
export function createVoiceIssueBudget({limit=6,windowMs=3600000,now=()=>Date.now()}={}){
 const buckets=new Map();
 return {take(key){const t=now();const previous=(buckets.get(key)||[]).filter(v=>t-v<windowMs);if(previous.length>=limit){buckets.set(key,previous);return false;}previous.push(t);buckets.set(key,previous);if(buckets.size>5000){for(const [id,entries] of buckets)if(entries[entries.length-1]<t-windowMs)buckets.delete(id);}return true;}};
}
