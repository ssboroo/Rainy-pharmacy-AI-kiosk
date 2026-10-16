import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {validateIdleAds,storeAd,deleteAd,ownsAd,serveAd} from '../server/idle-ads.mjs';
import {validateSettings} from '../server/core.mjs';
import {shouldShowAds} from '../src/idle-ads.js';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=';
test('idle playback excludes active voice, hidden tabs, empty and disabled playlists',()=>{
 const config={enabled:true,idleSec:30,items:[{}]};
 assert.equal(shouldShowAds({config,idleMs:29999,busy:false,hidden:false}),false);
 assert.equal(shouldShowAds({config,idleMs:30000,busy:false,hidden:false}),true);
 assert.equal(shouldShowAds({config,idleMs:60000,busy:true,hidden:false}),false);
 assert.equal(shouldShowAds({config,idleMs:60000,busy:false,hidden:true}),false);
 assert.equal(shouldShowAds({config:{...config,items:[]},idleMs:60000}),false);
});
test('uploaded ads persist, support video byte ranges and cannot escape branch storage',async()=>{
 const folder=await mkdtemp(path.join(tmpdir(),'ads-'));
 try{
  const a=await storeAd(folder,'branch-a',png);assert.equal(a.type,'image');assert.equal(ownsAd(a.url,'branch-a'),true);assert.equal(ownsAd(a.url,'branch-b'),false);
  assert.equal(ownsAd('/media/kiosk-ads/branch-a/../../settings.json','branch-a'),false);
  const cfg={enabled:true,idleSec:30,placement:'stage',items:[{...a,title:'Зар',durationSec:10}]};
  assert.deepEqual(validateSettings({idleAds:cfg}).idleAds,validateIdleAds(cfg));
  assert.throws(()=>validateIdleAds({...cfg,idleSec:0}));
  assert.throws(()=>validateIdleAds({...cfg,items:[{...cfg.items[0],url:'https://evil.test/x.svg'}]}));
  assert.throws(()=>validateIdleAds({...cfg,items:[...cfg.items,...cfg.items]}));
  await assert.rejects(storeAd(folder,'branch-a','data:image/png;base64,PHNjcmlwdD5hPC9zY3JpcHQ+'));
  let status,headers,body;
  const res={writeHead(s,h){status=s;headers=h;},end(b){body=b;}};
  await serveAd({headers:{range:'bytes=0-7'},method:'GET'},res,folder,a.url);
  assert.equal(status,206);assert.equal(body.length,8);assert.equal(headers['Content-Type'],'image/png');
  await serveAd({headers:{range:'bytes=99999-'},method:'GET'},res,folder,a.url);assert.equal(status,416);
  await assert.rejects(deleteAd(folder,'branch-b',a.url));await deleteAd(folder,'branch-a',a.url);
  await serveAd({headers:{},method:'GET'},res,folder,a.url);assert.equal(status,404);
 }finally{await rm(folder,{recursive:true,force:true});}
});
