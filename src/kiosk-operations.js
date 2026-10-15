// Ulaanbaatar pharmacy opening hours, default 08:00–22:00 daily.
// Clock is evaluated on the server for costly AI endpoints; clients also display it.
export function isWithinOperatingHours(at=new Date(),{startHour=8,endHour=22,timeZone='Asia/Ulaanbaatar'}={}){
 if(!Number.isInteger(startHour)||!Number.isInteger(endHour)||startHour<0||endHour>24||startHour>=endHour)return false;
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at);
 const hour=Number(parts.find(x=>x.type==='hour')?.value);
 const minute=Number(parts.find(x=>x.type==='minute')?.value);
 return hour*60+minute>=startHour*60&&hour*60+minute<endHour*60;
}
export function isUsefulMongolianSpeech(text,{minLength=3,maxLength=350}={}){
 const phrase=String(text||'').normalize('NFKC').trim().replace(/\s+/g,' ');
 if(phrase.length<minLength||phrase.length>maxLength)return false;
 if(!/[А-Яа-яЁёӨөҮү]/u.test(phrase))return false;
 // Ignore common TV/background noise filler and wake greetings that are not a request.
 if(/^(за|аа|өө|мм|тийм|үгүй|сайн байна уу|байна уу)[.!? ]*$/iu.test(phrase))return false;
 return true;
}
