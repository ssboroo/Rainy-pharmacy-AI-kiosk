import net from 'node:net';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=';
test('real HTTP ads upload is authenticated, persists playlist and serves media ranges',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ads-http-')),token='test-owner-ads-long-enough-token';
 const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const child=spawn(process.execPath,['server/index.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port),DATA_DIR:dir,ADMIN_TOKEN:token,DATABASE_URL:'',BACKUP_S3_ENDPOINT:''},stdio:['ignore','pipe','pipe']});
 let logs='';child.stderr.on('data',d=>{logs+=d;});
 try{
  const address=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Start timeout '+logs)),10000);
   child.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited '+logs));});
   child.stdout.on('data',d=>{logs+=d;const m=logs.match(/RAINY Pharmacy on port (\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});
  });
  const base='http://127.0.0.1:'+address;
  async function call(route,method='GET',body,authorized=true){return fetch(base+route,{method,headers:{'Content-Type':'application/json',...(authorized?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});}
  assert.equal((await call('/api/admin/idle-ads/upload','POST',{data:image},false)).status,401);
  const r=await call('/api/admin/idle-ads/upload','POST',{data:image});assert.equal(r.status,201);const item={...await r.json(),title:'Зар',durationSec:10};
  const cfg={enabled:true,idleSec:15,placement:'stage',items:[item]};
  assert.equal((await call('/api/admin/idle-ads','PUT',{idleAds:cfg})).status,200);
  assert.deepEqual((await (await call('/api/idle-ads')).json()).idleAds,cfg);
  const media=await fetch(base+item.url,{headers:{Range:'bytes=0-7'}});assert.equal(media.status,206);assert.equal((await media.arrayBuffer()).byteLength,8);
  assert.equal((await call('/api/admin/idle-ads/file','DELETE',{url:item.url})).status,409);
  const foreign={...item,url:item.url.replace('/default/','/other-branch/')};
  assert.equal((await call('/api/admin/idle-ads','PUT',{idleAds:{...cfg,items:[foreign]}})).status,400);
  assert.equal((await call('/api/admin/settings','PUT',{idleAds:{...cfg,items:[foreign]}})).status,400);
  assert.equal((await call('/api/admin/idle-ads','PUT',{idleAds:{...cfg,items:[]}})).status,200);
  assert.equal((await call('/api/admin/idle-ads/file','DELETE',{url:item.url})).status,200);
  assert.equal((await fetch(base+item.url)).status,404);
 }finally{child.kill('SIGTERM');await new Promise(resolve=>child.exitCode!==null?resolve():child.once('exit',resolve));await rm(dir,{recursive:true,force:true});}
});
