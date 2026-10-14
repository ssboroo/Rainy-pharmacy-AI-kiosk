import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_CATALOG,voiceConnectionStatus,validateCatalog,mergeLegacyDemoCatalog,evaluateQuestion} from '../server/core.mjs';

test('demo contains 30 unique, detailed, explicitly unverified medicine examples',()=>{
  assert.equal(DEMO_CATALOG.length,30);
  const ids=new Set();
  for(const item of DEMO_CATALOG){
    assert.ok(!ids.has(item.id));ids.add(item.id);
    assert.equal(item.verified,false);
    assert.equal(item.priceMnt,null);
    assert.equal(item.stock,null);
    for(const key of ['name','form','category','description','warnings','storage']){
      assert.ok(item[key]?.length>=(key==='name'?4:8),item.id+' missing '+key);
    }
    assert.ok(!/\b\d+\s*(?:mg|мг|мл|ширхэг)\s*(?:уух|өдөрт)/i.test(item.notes+' '+item.description));
  }
  assert.equal(validateCatalog(DEMO_CATALOG).length,30);
});
test('legacy three demo entries upgrade to 30 without rewriting verified pharmacies',()=>{
  const legacy=DEMO_CATALOG.slice(0,3);
  assert.equal(mergeLegacyDemoCatalog(legacy).length,30);
  const commercial=validateCatalog([{id:'own-drug',name:'Own item',verified:true,sourceUrl:'https://example.org/own',verifiedAt:'2026-10-14',stock:7}]);
  assert.deepEqual(mergeLegacyDemoCatalog(commercial),commercial);
});
test('unknown/unapproved voice flag clearly reports each missing requirement',()=>{
  assert.deepEqual(voiceConnectionStatus({},''),{agentConfigured:false,keyConfigured:false,clinicalApproved:false,voiceReady:false});
  assert.deepEqual(voiceConnectionStatus({ELEVENLABS_API_KEY:'private',VOICE_AGENT_CLINICAL_APPROVED:'false'},'agent_valid'),{agentConfigured:true,keyConfigured:true,clinicalApproved:false,voiceReady:false});
  assert.deepEqual(voiceConnectionStatus({ELEVENLABS_API_KEY:'private',VOICE_AGENT_CLINICAL_APPROVED:'true'},'agent_valid'),{agentConfigured:true,keyConfigured:true,clinicalApproved:true,voiceReady:true});
});
test('demo medicine has useful general information but never fabricated medical doses or prices',()=>{
  const item=DEMO_CATALOG[0];
  const question=evaluateQuestion(item.name+' мэдээлэл',DEMO_CATALOG);
  assert.equal(question.kind,'demo');
  assert.match(question.reply,/туршилтын|баталгаажаагүй/);
  assert.ok(question.reply.includes(item.description.slice(0,40)));
  assert.equal(evaluateQuestion(item.name+' хэдэн ширхэг уух вэ',DEMO_CATALOG).kind,'pharmacist');
});