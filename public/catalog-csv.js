/** Safe small CSV import, no automatic verification of medical claims. */
function csvRows(text){
  if(typeof text!=='string'||text.length>1000000)throw Error('CSV файл 1MB-аас бага байх шаардлагатай.');
  const rows=[];let row=[],field='',quote=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quote){
      if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}
      else if(ch==='"')quote=false;
      else field+=ch;
    }else if(ch==='"'){if(field)throw Error('CSV формат буруу.');quote=true;}
    else if(ch===','){row.push(field);field='';}
    else if(ch==='\r'||ch==='\n'){
      if(ch==='\r'&&text[i+1]==='\n')i++;
      row.push(field);if(row.some(x=>x.trim()))rows.push(row);
      row=[];field='';
    }else field+=ch;
  }
  if(quote)throw Error('CSV хашилт дутуу.');
  row.push(field);if(row.some(x=>x.trim()))rows.push(row);
  return rows;
}
export function parseCatalogCSV(text){
  const rows=csvRows(text);
  if(rows.length<2||rows.length>2001)throw Error('CSV мөр хоосон эсвэл 2000-аас хэтэрсэн.');
  const keys=rows.shift().map(x=>x.trim());
  if(!keys.includes('name'))throw Error('CSV файлд name багана шаардлагатай.');
  if(new Set(keys).size!==keys.length)throw Error('CSV багана давхардсан.');
  const supported=new Set(['id','name','aliases','category','form','description','warnings','storage','notes','shelf','priceMnt','stock','verified']);
  if(keys.some(x=>!supported.has(x)))throw Error('CSV дэмжигдэхгүй баганатай байна.');
  const medicines=rows.map((row,index)=>{
    if(row.length!==keys.length)throw Error('CSV мөрийн баганын тоо буруу: '+(index+2));
    const v=Object.fromEntries(keys.map((key,i)=>[key,row[i].trim()]));
    if(!v.name)throw Error('CSV мөрөнд эмийн нэр дутуу: '+(index+2));
    if('verified' in v&&v.verified!==''&&v.verified!=='false')throw Error('CSV импортын мэдээллийг автоматаар баталгаажуулж болохгүй.');
    const out={...v,id:v.id||'import-'+String(index+1).padStart(4,'0'),verified:false,
      aliases:v.aliases?v.aliases.split(';').map(a=>a.trim()).filter(Boolean):[],
      priceMnt:null,stock:null,sourceUrl:'',verifiedAt:''};
    for(const key of ['priceMnt','stock']){
      if(v[key]){
        const number=Number(v[key]);
        if(!Number.isSafeInteger(number)||number<0)throw Error(key==='priceMnt'?'Үнэ буруу.':'Үлдэгдэл буруу.');
        out[key]=number;
      }
    }
    return out;
  });
  return medicines;
}
