import path from 'node:path';
import {mkdir,readdir,stat,writeFile,readFile,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
export const EMPTY_ADS={enabled:false,idleSec:30,placement:'stage',items:[]};
export function validateIdleAds(v){
 if(!v||typeof v!=='object'||Array.isArray(v)||typeof v.enabled!=='boolean'||!Number.isInteger(v.idleSec)||v.idleSec<15||v.idleSec>900||!['stage','fullscreen'].includes(v.placement)||!Array.isArray(v.items)||v.items.length>12)throw Error('Зарын тохиргоо: 15–900 секунд, ихдээ 12 зар байна.');
 const ids=new Set();
 const items=v.items.map(x=>{
  if(!x||typeof x.title!=='string'||x.title.length>100||typeof x.url!=='string'||!/^\/media\/kiosk-ads\/[a-zA-Z0-9_-]+\/[a-f0-9-]{36}\.(png|jpg|webp|mp4|webm)$/.test(x.url)||!['image','video'].includes(x.type)||!Number.isInteger(x.durationSec)||x.durationSec<5||x.durationSec>120||ids.has(x.url))throw Error('Зарын файл, нэр эсвэл хугацаа буруу.');
  if((x.type==='video')!==/\.(mp4|webm)$/.test(x.url))throw Error('Зарын файлын төрөл зөрүүтэй.');
  ids.add(x.url);return {title:x.title.trim(),url:x.url,type:x.type,durationSec:x.durationSec};
 });return {enabled:v.enabled,idleSec:v.idleSec,placement:v.placement,items};
}
const types={png:'image/png',jpg:'image/jpeg',webp:'image/webp',mp4:'video/mp4',webm:'video/webm'};
export function detectAdType(b){
 if(b.length<12)throw Error('Файл хоосон эсвэл гэмтсэн.');
 const h=b.subarray(0,12).toString('hex');
 if(h.startsWith('89504e470d0a1a0a'))return 'png';
 if(h.startsWith('ffd8ff'))return 'jpg';
 if(b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP')return 'webp';
 if(b.subarray(4,8).toString()==='ftyp')return 'mp4';
 if(h.startsWith('1a45dfa3'))return 'webm';
 throw Error('PNG, JPG, WebP, MP4 эсвэл WebM файл оруулна уу.');
}
export function adScope(ctx,defaultBranch){return ctx===defaultBranch?'default':ctx.slug;}
export function ownsAd(url,scope){return typeof url==='string'&&url.startsWith('/media/kiosk-ads/'+scope+'/')&&/^\/media\/kiosk-ads\/[a-zA-Z0-9_-]+\/[a-f0-9-]{36}\.(png|jpg|webp|mp4|webm)$/.test(url);}
let uploads=Promise.resolve();
export function storeAd(dataDir,scope,encoded){
 const next=uploads.catch(()=>{}).then(()=>storeAdFile(dataDir,scope,encoded));
 uploads=next.catch(()=>{});return next;
}
async function storeAdFile(dataDir,scope,encoded){
 if(typeof encoded!=='string'||encoded.length>28000000||!/^data:[a-z0-9/+.-]+;base64,[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw Error('Зарын файл ихдээ 20 MB байна.');
 const bytes=Buffer.from(encoded.slice(encoded.indexOf(',')+1),'base64');
 if(bytes.length>20*1024*1024)throw Error('Зарын файл ихдээ 20 MB байна.');
 const ext=detectAdType(bytes),dir=path.join(dataDir,'kiosk-ads',scope);
 await mkdir(dir,{recursive:true});
 const files=await readdir(dir);let total=0;
 for(const f of files)total+=(await stat(path.join(dir,f))).size;
 if(files.length>=30||total+bytes.length>120*1024*1024)throw Error('Зарын сан дүүрсэн (120 MB). Хуучин зараа устгана уу.');
 const filename=randomUUID()+'.'+ext;await writeFile(path.join(dir,filename),bytes,{flag:'wx'});
 return {url:'/media/kiosk-ads/'+scope+'/'+filename,type:['mp4','webm'].includes(ext)?'video':'image'};
}
export async function deleteAd(dataDir,scope,url){
 if(!ownsAd(url,scope))throw Error('Энэ байгууллагын файл биш.');
 await unlink(path.join(dataDir,'kiosk-ads',scope,path.basename(url))).catch(e=>{if(e.code!=='ENOENT')throw e;});
}
export async function serveAd(req,res,dataDir,url){
 const m=/^\/media\/kiosk-ads\/([a-zA-Z0-9_-]+)\/([a-f0-9-]{36})\.(png|jpg|webp|mp4|webm)$/.exec(url);
 if(!m){res.writeHead(404);res.end();return;}
 let bytes;try{bytes=await readFile(path.join(dataDir,'kiosk-ads',m[1],m[2]+'.'+m[3]));}catch{res.writeHead(404);res.end();return;}
 const headers={'Content-Type':types[m[3]],'Cache-Control':'public, max-age=86400','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};
 let start=0,end=bytes.length-1,status=200;
 if(req.headers.range){
  const r=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
  if(!r||Number(r[1])>=bytes.length||(r[2]&&Number(r[2])<Number(r[1]))){res.writeHead(416,{'Content-Range':'bytes */'+bytes.length});res.end();return;}
  start=Number(r[1]);end=r[2]?Math.min(Number(r[2]),end):end;status=206;headers['Content-Range']=`bytes ${start}-${end}/${bytes.length}`;
 }
 headers['Content-Length']=end-start+1;res.writeHead(status,headers);res.end(req.method==='HEAD'?undefined:bytes.subarray(start,end+1));
}
