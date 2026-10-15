import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createBranchRegistry,validateBranchSlug} from '../server/branches.mjs';
import {validateSettings} from '../server/core.mjs';
import {findMedicineMention} from '../src/medicine-panel.js';

test('tenant slugs cannot traverse directories or use dangerous identifiers',()=>{
  assert.equal(validateBranchSlug('ub-central'),'ub-central');
  for(const invalid of ['../admin','../','..','/test','Test','', 'a--b','a_b','admin','.','default','source%2f'])assert.throws(()=>validateBranchSlug(invalid));
});
test('branch-specific data and analytics survive restart without leaking between branches',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'rainy-tenants-'));
  try{
    const app=createBranchRegistry({dataDir:dir,defaultSettings:{pharmacyName:'Original',agentId:'agent_main'},defaultCatalog:[]});
    await app.load();
    const one=await app.create({slug:'branch-one',name:'Салбар нэг'});
    const two=await app.create({slug:'branch-two',name:'Салбар хоёр'});
    assert.match(one.adminToken,/^[A-Za-z0-9_-]{35,}$/);
    assert.notEqual(one.adminToken,two.adminToken);
    assert.equal(app.authorize('branch-one',one.adminToken),true);
    assert.equal(app.authorize('branch-two',one.adminToken),false);
    assert.equal(app.authorize('branch-one',''),false);
    assert.equal(app.get('branch-two').settings.agentId,'');
    await app.get('branch-one').updateSettings({pharmacyName:'Эмийн сан A',agentId:'agent_a'});
    await app.get('branch-one').updateCatalog([{id:'custom-a',name:'Тусгай A',verified:false}]);
    await app.get('branch-one').analytics.recordInternal(['questionsAsked']);
    assert.equal(app.get('branch-two').settings.pharmacyName,'Салбар хоёр');
    assert.equal(app.get('branch-two').catalog.some(x=>x.id==='custom-a'),false);
    assert.equal(app.get('branch-two').analytics.report(7).totals.questionsAsked,0);
    const fresh=createBranchRegistry({dataDir:dir,defaultSettings:{pharmacyName:'Original'},defaultCatalog:[]});
    await fresh.load();
    assert.equal(fresh.get('branch-one').settings.pharmacyName,'Эмийн сан A');
    assert.equal(fresh.get('branch-one').catalog[0].id,'custom-a');
    assert.equal(fresh.get('branch-two').settings.pharmacyName,'Салбар хоёр');
    assert.equal(fresh.authorize('branch-one',one.adminToken),true);
    assert.equal(fresh.get('branch-one').analytics.report(7).totals.questionsAsked,1);
    assert.equal(JSON.stringify(fresh.list()).includes(one.adminToken),false);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('logo upload only accepts genuine bounded PNG/JPEG/WebP data, not SVG or scripts',()=>{
  const png='data:image/png;base64,'+Buffer.from('89504e470d0a1a0a0000000049454e44ae426082','hex').toString('base64');
  assert.equal(validateSettings({logoData:png}).logoData,png);
  assert.equal(validateSettings({logoData:''}).logoData,'');
  assert.throws(()=>validateSettings({logoData:'data:image/svg+xml;base64,PHN2Zz4='}));
  assert.throws(()=>validateSettings({logoData:'data:image/png;base64,'+Buffer.from('<script>hello</script>').toString('base64')}));
});
test('medicine matcher favors complete, longest medicine name; never invents metadata',()=>{
  const catalog=[{id:'a',name:'Аспирин',aliases:['aspirin'],description:'General description',warnings:'See pharmacist'},
                 {id:'b',name:'Парацетамол',aliases:['paracetamol'],description:'Another description'}];
  assert.equal(findMedicineMention('Надад парацетамолын талаар хэлж өгнө үү',catalog)?.id,'b');
  assert.equal(findMedicineMention('Please tell me about aspirin',catalog)?.id,'a');
  assert.equal(findMedicineMention('ханиадны эм',catalog),null);
  assert.equal(findMedicineMention('аспиран',catalog),null);
});
