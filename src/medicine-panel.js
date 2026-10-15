/*
 * Client/server-safe catalog name matcher.
 * Only approved canonical names and pharmacist-entered phonetic aliases.
 * No diagnosis, online search or guessing unseen medicines.
 */
const lower=v=>String(v||'').normalize('NFKC').toLocaleLowerCase('mn-MN').replace(/ё/g,'е').replace(/\s+/g,' ').trim();
const words=s=>(lower(s).match(/[\p{L}\p{N}]+/gu)||[]);
const endings=['аас','ээс','оос','өөс','ийн','гийн','ны','ний','тай','тэй','той','ыг','ийг','д','ын','аар','ээр','оор','өөр'];
function editDistance(a,b){
 if(Math.abs(a.length-b.length)>2)return 3;
 const prev=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  let last=prev[0];prev[0]=i;
  for(let j=1;j<=b.length;j++){
   const old=prev[j];prev[j]=Math.min(prev[j]+1,prev[j-1]+1,last+(a[i-1]===b[j-1]?0:1));last=old;
  }
 }
 return prev[b.length];
}
function tokenScore(query,alias){
 const qt=words(query),at=words(alias);
 if(!qt.length||!at.length||at.some(v=>v.length<2))return 0;
 if(at.length>qt.length)return 0;
 let best=0;
 for(let offset=0;offset<=qt.length-at.length;offset++){
  let score=1;
  for(let i=0;i<at.length;i++){
   const token=qt[offset+i],name=at[i];
   if(token===name)continue;
   if(i===at.length-1&&endings.some(end=>token===name+end)){score=Math.min(score,.97);continue;}
   if(name.length>=7&&token.length>=7&&
    // Avoid transliteration guesses and unsafe short near-matches.
    /^[\p{Script=Cyrillic}]+$/u.test(name)&&/^[\p{Script=Cyrillic}]+$/u.test(token)){
    const distance=editDistance(token,name);
    if(distance===1){score=Math.min(score,.88);continue;}
   }
   score=0;break;
  }
  best=Math.max(best,score);
 }
 return best;
}
export function matchMedicineSpoken(text,items){
 if(typeof text!=='string'||!Array.isArray(items)||text.length>2000)return {item:null,ambiguous:false,confidence:0};
 let best=null,confidence=0,second=0;
 for(const item of items){
  if(!item||typeof item.name!=='string')continue;
  const variants=[item.name,...(Array.isArray(item.aliases)?item.aliases:[])];
  const score=Math.max(...variants.map(x=>tokenScore(text,x)));
  if(score>confidence){second=confidence;confidence=score;best=item;}
  else if(score>second){second=score;}
 }
 if(confidence<.85||second>=confidence-.04)return {item:null,ambiguous:second>=.85,confidence};
 return {item:best,ambiguous:false,confidence};
}
export function findMedicineMention(text,items){return matchMedicineSpoken(text,items).item;}
export function sanitizedMedicineCard(item){
 if(!item)return null;
 return {id:item.id,name:item.name,category:item.category||'',form:item.form||'',
  description:item.description||'',warnings:item.warnings||'',priceMnt:item.priceMnt??null,
  stock:item.stock??null,shelf:item.shelf||'',imageUrl:item.imageUrl||'',verified:item.verified===true};
}
