let token='';
const $=id=>document.getElementById(id);
const show=message=>{$('status').textContent=message;};
async function api(route,method='GET',body){
  const response=await fetch('/api/admin/'+route,{method,headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Server error');return data;
}
$('login').onclick=async()=>{
  token=$('token').value.trim();
  try{
    const [s,c]=await Promise.all([api('settings'),api('catalog')]);
    const config=s.settings;
    for(const key of ['pharmacyName','assistantName','greeting','locationName','agentId','defaultAvatar','accent']) if($(key))$(key).value=config[key];
    $('catalog').value=JSON.stringify(c.items,null,2);
    $('editor').hidden=false;$('token').value='';show('Амжилттай нэвтэрлээ.');await refreshVoiceStatus();
  }catch(e){token='';show('Нэвтэрч чадсангүй: '+e.message);}
};
const avatars=[['nomi','Номи — робот'],['mira','Мира — AI хүн'],['kiki','Кики — робот'],['aria','Ариа — hologram'],['bobo','Бобо — робот']];
for(const [id,name] of avatars){const el=document.createElement('option');el.value=id;el.textContent=name;$('defaultAvatar').append(el);}
$('saveSettings').onclick=async()=>{
  const data={};for(const key of ['pharmacyName','assistantName','greeting','locationName','agentId','defaultAvatar','accent'])data[key]=$(key).value;
  try{await api('settings','PUT',data);show('Тохиргоо хадгалагдлаа. Киоск хуудсыг шинэчлэхэд хэрэгжинэ.');await refreshVoiceStatus();}catch(e){show('Хадгалж чадсангүй: '+e.message);}
};
$('saveCatalog').onclick=async()=>{
  try{const items=JSON.parse($('catalog').value);const data=await api('catalog','PUT',items);show(data.count+' бүтээгдэхүүний мэдээлэл хадгалагдлаа.');}catch(e){show('Каталогийн алдаа: '+e.message);}
};
async function refreshVoiceStatus(){
  try{
    const x=await api('voice-status');
    const lines=[
      [x.agentConfigured,'Agent ID'],
      [x.keyConfigured,'Railway ElevenLabs API key'],
      [x.clinicalApproved,'Эм зүйчийн клиник зөвшөөрөл']
    ];
    $('voiceDiagnostics').replaceChildren();
    for(const [ready,name] of lines){
      const row=document.createElement('div');row.className='diagnostic-item '+(ready?'is-ready':'is-missing');
      row.textContent=(ready?'✓ ':'○ ')+name+': '+(ready?'Бэлэн':'Дутуу');$('voiceDiagnostics').append(row);
    }
    const summary=document.createElement('p');summary.textContent=x.message;
    $('voiceDiagnostics').append(summary);
  }catch(e){$('voiceDiagnostics').textContent='Voice тохиргооны мэдээллийг шалгаж чадсангүй: '+e.message;}
}
$('testVoiceAgent').onclick=async()=>{
  $('testVoiceAgent').disabled=true;
  show('ElevenLabs холболтыг шалгаж байна...');
  try{
    const result=await api('voice-test','POST');
    show(result.connectionMessage);
    await refreshVoiceStatus();
  }catch(e){show('ElevenLabs шалгалтын алдаа: '+e.message);}
  finally{$('testVoiceAgent').disabled=false;}
};
