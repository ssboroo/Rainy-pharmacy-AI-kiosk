import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCatalogVoiceContext} from '../server/voice-catalog.mjs';

test('voice guide is restricted to published tenant names and aliases, never demo items',()=>{
 const items=[
  {id:'a',name:'Парацетамол 500 мг',aliases:['парацетомол','paracetamol'],verified:true,description:'Эмийн сан баталгаажуулсан тайлбар',priceMnt:3600,stock:4},
  {id:'b',name:'Демо эм',aliases:['secret-demo'],verified:false,description:'худал мэдээлэл'}];
 const p=buildCatalogVoiceContext(items,'Кенко эмийн сан');
 assert.match(p.prompt,/Кенко эмийн сан/);
 assert.match(p.prompt,/Парацетамол 500 мг/);
 assert.match(p.prompt,/Монгол хэлээр/);
 assert.match(p.prompt,/эмтэй холбоогүй/i);
 assert.deepEqual(p.keywords,['Парацетамол 500 мг','парацетомол','paracetamol']);
 assert.doesNotMatch(p.prompt,/Демо эм|secret-demo|худал мэдээлэл/);
});
test('voice keywords are capped at provider ASR limit and missing catalog does not invent facts',()=>{
 const lots=Array.from({length:100},(_,i)=>({name:'Эм '+i,verified:true,aliases:['med'+i]}));
 const p=buildCatalogVoiceContext(lots);
 assert.equal(p.keywords.length,50);
 assert.equal(p.catalogTruncated,true);
 const empty=buildCatalogVoiceContext(lots.map(x=>({...x,verified:false})));
 assert.equal(empty.catalogCount,0);
 assert.deepEqual(empty.keywords,[]);
 assert.match(empty.prompt,/баталгаажсан эм алга/);
});
