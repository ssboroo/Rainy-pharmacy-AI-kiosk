/**
 * Detects only recognizable catalog product names. No medical analysis,
 * patient context, AI-generated dosing, or inferred products.
 */
const lower=v=>String(v||'').normalize('NFKC').toLocaleLowerCase('mn-MN').trim();
const escape=v=>v.replace(/[.*+?^$()|[\]{}\\]/g,'\\$&');
export function findMedicineMention(text,items){
  if(typeof text!=='string'||!Array.isArray(items)||text.length>5000)return null;
  const line=lower(text);
  let best=null,bestLength=0;
  for(const item of items){
    for(const word of [item?.name,...(item?.aliases||[])]){
      const value=lower(word);
      if(value.length<4||value.length<bestLength)continue;
      // Permit common Mongolian grammatical suffixes but not unrelated words.
      const pattern=new RegExp('(^|[^\\p{L}\\p{N}])'+escape(value)+'(?=$|[^\\p{L}\\p{N}]|(?:ын|ийн|ны|ний|ыг|ийг|аас|ээс|тай|тэй)(?=$|[^\\p{L}\\p{N}]))','iu');
      if(pattern.test(line)&&value.length>bestLength){best=item;bestLength=value.length;}
    }
  }
  return best;
}
export function sanitizedMedicineCard(item){
  if(!item)return null;
  return {
    id:item.id,name:item.name,category:item.category||'',form:item.form||'',
    description:item.description||'',
    warnings:item.warnings||'',
    verified:item.verified===true
  };
}
