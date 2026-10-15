import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProviderStatus,parseInventorySnapshot,applyInventorySnapshot,shouldEscalateVoiceText} from '../server/phase2.mjs';
test('POS CSV inventory cannot invent verified medicines or negative prices',()=>{
 const source=[{id:'med1',name:'Тест эм',verified:true,priceMnt:1000,stock:2,sourceUrl:'https://example.com',verifiedAt:'2026-10-01'},{id:'demo1',name:'Жишээ',verified:false,priceMnt:null,stock:null}];
 const batch=parseInventorySnapshot({items:[{id:'med1',priceMnt:3400,stock:5},{id:'demo1',priceMnt:1200,stock:50}]});
 const result=applyInventorySnapshot(source,batch);
 assert.equal(result[0].priceMnt,3400);
 assert.equal(result[0].stock,5);
 assert.equal(result[1].priceMnt,null);
 assert.equal(result[1].stock,null);
 assert.equal(result[1].verified,false);
 assert.throws(()=>parseInventorySnapshot({items:[{id:'med1',priceMnt:-1,stock:2}]}));
 assert.throws(()=>parseInventorySnapshot({items:[{id:'med1',priceMnt:1,stock:-1}]}));
});
test('voice safety classifier escalates clinical, unknown and emergency content',()=>{
 assert.equal(shouldEscalateVoiceText('Парацетамол хэдэн ширхэг уух вэ?'),true);
 assert.equal(shouldEscalateVoiceText('Амьсгал боогдож байна'),true);
 assert.equal(shouldEscalateVoiceText('Эмийн үнэ хэд вэ?'),false);
});
test('provider readiness reports configured, never pretends live API validated',()=>{
 const status=buildProviderStatus({ELEVENLABS_API_KEY:'secret',OPENAI_API_KEY:'',PHARMACIST_WEBHOOK_URL:''},'agent_01',true);
 assert.equal(status.voice.configured,true);
 assert.equal(status.voice.liveVerified,false);
 assert.equal(status.vision.configured,false);
 assert.equal(status.pharmacist.configured,false);
});
