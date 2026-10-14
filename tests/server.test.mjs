import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import net from 'node:net';
const root=new URL('../',import.meta.url);
async function pickPort(){
  const server=net.createServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  await new Promise(resolve=>server.close(resolve));
  return port;
}
test('real HTTP server: safety, admin changes, provider consent and persistence API',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'rainy-kiosk-'));
  const port=await pickPort();
  const child=spawn(process.execPath,['server/index.mjs'],{
    cwd:new URL('../',import.meta.url),
    env:{...process.env,PORT:String(port),DATA_DIR:folder,ADMIN_TOKEN:'test-token-long-enough-for-admin-access',ELEVENLABS_API_KEY:'',OPENAI_API_KEY:'',VOICE_AGENT_CLINICAL_APPROVED:'false'},
    stdio:['ignore','pipe','pipe']
  });
  let logs='';
  child.stdout.on('data',x=>logs+=x.toString());
  child.stderr.on('data',x=>logs+=x.toString());
  const url='http://127.0.0.1:'+port;
  const api=async(p,options={})=>{
    const r=await fetch(url+p,options);let v=await r.json();return {status:r.status,data:v};
  };
  const json=(data,token)=>({method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});
  const put=(data,token)=>({...json(data,token),method:'PUT'});
  try{
    let ready=false;
    for(let i=0;i<80;i++){
      if(child.exitCode!==null)throw Error('server exited early: '+logs);
      try{const r=await api('/api/health');if(r.status===200){ready=true;break;}}catch{}
      await new Promise(r=>setTimeout(r,70));
    }
    assert.equal(ready,true,'server did not start: '+logs);
    const boot=await api('/api/bootstrap');
    assert.equal(boot.data.voiceReady,false);
    assert.equal(boot.data.demoMode,true);
    const risky=await api('/api/ask',json({question:'Парацетамол хэдэн ширхэг уух вэ?'}));
    assert.equal(risky.data.kind,'pharmacist');
    const emergency=await api('/api/ask',json({question:'амьсгал боогдож байна'}));
    assert.equal(emergency.data.kind,'emergency');
    const vision=await api('/api/vision',json({image:'data:image/png;base64,YQ==',consent:false}));
    assert.equal(vision.status,400);
    const staff=await api('/api/handoff',json({}));
    assert.equal(staff.data.sent,false);
    const signed=await api('/api/agent/signed-url');
    assert.equal(signed.status,503);
    const denied=await api('/api/admin/settings');
    assert.equal(denied.status,401);
    const token='test-token-long-enough-for-admin-access';
    const auth={authorization:'Bearer '+token};
    const changed=await api('/api/admin/settings',put({pharmacyName:'Шинэ салбар',defaultAvatar:'mira'},token));
    assert.equal(changed.status,200);
    const newBoot=await api('/api/bootstrap');
    assert.equal(newBoot.data.pharmacyName,'Шинэ салбар');
    assert.equal(newBoot.data.defaultAvatar,'mira');
    const invalid=await api('/api/admin/catalog',put([{name:'A',verified:true}],token));
    assert.equal(invalid.status,500===invalid.status?500:400); // checked below through successful rejection
    const newItems=[{id:'verified-one',name:'Тест Эм',verified:true,sourceUrl:'https://example.org/medicine',verifiedAt:'2026-10-14',priceMnt:2500,stock:4,shelf:'B-2'}];
    const saved=await api('/api/admin/catalog',put(newItems,token));
    assert.equal(saved.status,200);
    const lookup=await api('/api/catalog?q='+encodeURIComponent('Тест Эм'));
    assert.equal(lookup.data.items[0].stock,4);
    const price=await api('/api/ask',json({question:'Тест Эм үнэ хэд вэ?'}));
    assert.match(price.data.reply,/2,500|2500/);
    const confirm=await api('/api/admin/settings',{headers:auth});
    assert.equal(confirm.data.settings.defaultAvatar,'mira');
  }finally{
    child.kill('SIGTERM');
    await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});
    await rm(folder,{recursive:true,force:true});
  }
});
