import {parseCatalogCSV} from './catalog-csv.js';
let token='',basicAuth='';
const $=id=>document.getElementById(id);
const branchSlug=new URLSearchParams(window.location.search).get('branch')||'';
const scopeUrl=path=>path+(branchSlug?(path.includes('?')?'&':'?')+'branch='+encodeURIComponent(branchSlug):'');
let logoData='';
const show=message=>{$('status').textContent=message;};
async function api(route,method='GET',body){
  const response=await fetch(scopeUrl('/api/admin/'+route),{method,headers:{'Authorization':basicAuth||('Bearer '+token),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Server error');return data;
}
$('orgLoginFields').hidden=!branchSlug;
$('organizationLoginHint').textContent=branchSlug?'Энэ байгууллагын нэвтрэх нэр, нууц кодоо оруулна. Хуучин токен мөн хүчинтэй.':'Төв админ токеноор нэвтэрч байгууллагуудыг удирдана.';
$('login').onclick=async()=>{
  token=$('token').value.trim();
  basicAuth='';
  if(branchSlug&&$('orgLoginName').value.trim()&&$('orgLoginCode').value){
    basicAuth='Basic '+btoa($('orgLoginName').value.trim()+':'+$('orgLoginCode').value);
  }
  try{
    const [s,c]=await Promise.all([api('settings'),api('catalog')]);
    const config=s.settings;
    for(const key of ['pharmacyName','assistantName','greeting','locationName','agentId','defaultAvatar','accent']) if($(key))$(key).value=config[key];
    $('idleTimeoutSec').value=config.idleTimeoutSec??120;
    $('resetOnDisconnect').checked=config.resetOnDisconnect!==false;
    $('avatarIdleEnabled').checked=config.avatarIdleEnabled!==false;
    $('integrationAgentId').value=config.agentId||'';
    logoData=config.logoData||'';
    updateLogoPreview();
    $('catalog').value=JSON.stringify(c.items,null,2);
    $('currentBranchBanner').textContent=branchSlug?'🔐 Салбарын тусгаарлагдсан админ: '+branchSlug:'✦ Үндсэн / төв эмийн сангийн админ';
    if(!branchSlug){$('branchManager').hidden=false;$('organizationOperations').hidden=false;await loadBranches();await refreshOrganization();}
    else $('branchManager').hidden=true;
    $('editor').hidden=false;initAdminNavigation();$('token').value='';$('orgLoginCode').value='';show('Амжилттай нэвтэрлээ.');
    await Promise.all([refreshVoiceStatus(),refreshAnalytics(),refreshDevices(),refreshIntegrations()]);
    if(!branchSlug)startElevenLabsCreditsPolling();
  }catch(e){token='';show('Нэвтэрч чадсангүй: '+e.message);}
};
const avatars=[['nomi','Номи — робот'],['mira','Мира — AI хүн'],['kiki','Кики — робот'],['aria','Ариа — hologram'],['bobo','Бобо — робот']];
for(const [id,name] of avatars){const el=document.createElement('option');el.value=id;el.textContent=name;$('defaultAvatar').append(el);}
$('saveSettings').onclick=async()=>{
  const data={};for(const key of ['pharmacyName','assistantName','greeting','locationName','agentId','defaultAvatar','accent'])data[key]=$(key).value;
  data.idleTimeoutSec=Number($('idleTimeoutSec').value);
  data.resetOnDisconnect=$('resetOnDisconnect').checked;
  data.avatarIdleEnabled=$('avatarIdleEnabled').checked;
  data.logoData=logoData;
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


/* Aggregated insights, with explicit evidence labels and no sensitive logs */
let recentAnalytics=null;
const int=n=>new Intl.NumberFormat('mn-MN',{maximumFractionDigits:0}).format(Number(n)||0);
const METRIC_CARDS=[
  {key:'sessionStarted',name:'Эхэлсэн харилцаа',hint:'Төхөөрөмжөөс тоолсон үйлдэл',icon:'◉'},
  {key:'questionsAsked',name:'Бичгээр асуусан',hint:'Сервер бүртгэсэн асуултын тоо',icon:'⌘'},
  {key:'verifiedCatalogAnswers',name:'Баталгаатай AI хариулт',hint:'Зөвхөн баталгаажсан каталог',icon:'✓'},
  {key:'demoInformationShown',name:'Жишээ тайлбар',hint:'Бодит шийдвэрлэлт биш',icon:'◇'},
  {key:'pharmacistReferrals',name:'Эм зүйчид шилжүүлсэн',hint:'Зөвлөсөн шилжүүлэлт',icon:'↗'},
  {key:'medicineDetailsViewed',name:'Бүтээгдэхүүн үзсэн',hint:'Төхөөрөмжөөс тоолсон үзэлт',icon:'▤'},
  {key:'voiceConnected',name:'Дуут Agent холбогдсон',hint:'Төхөөрөмжөөс тоолсон холболт',icon:'♫'},
  {key:'voiceMessagesObserved',name:'Дуут AI хариулсан',hint:'Төхөөрөмж мэдээлсэн AI мессеж',icon:'♬'},
  {key:'unresolvedQuestions',name:'Хариулаагүй асуулт',hint:'Каталогоос олдоогүй',icon:'?'},
  {key:'staffRequests',name:'Эм зүйч дуудсан',hint:'Серверт ирсэн хүсэлт',icon:'♡'},
  {key:'emergencyEscalations',name:'Яаралтай чиглүүлэлт',hint:'Эмийн аюулгүй байдлын дохио',icon:'!'},
];
function renderAnalytics(){
  const report=recentAnalytics;
  if(!report)return;
  const cards=$('analyticsCards');
  cards.replaceChildren();
  for(const card of METRIC_CARDS){
    const el=document.createElement('article');el.className='metric-card';
    const line=document.createElement('div');line.className='metric-topline';
    const symbol=document.createElement('span');symbol.className='metric-icon';symbol.textContent=card.icon;
    const hint=document.createElement('span');hint.className='metric-hint';hint.textContent=card.hint;
    line.append(symbol,hint);
    const value=document.createElement('strong');value.className='metric-value';value.textContent=int(report.totals[card.key]);
    const label=document.createElement('span');label.className='metric-label';label.textContent=card.name;
    el.append(line,value,label);
    if(card.key==='verifiedCatalogAnswers')el.classList.add('metric-primary');
    cards.append(el);
  }
  const chart=$('analyticsChart');chart.replaceChildren();
  const top=Math.max(1,...report.days.map(d=>d.questionsAsked));
  for(const row of report.days){
    const column=document.createElement('div');column.className='insights-day';
    column.title=row.date+': '+int(row.questionsAsked)+' асуулт, '+int(row.verifiedCatalogAnswers)+' баталгаатай хариулт';
    const bar=document.createElement('div');bar.className='insights-day-bar';
    bar.style.height=(Math.max(row.questionsAsked?4:1,row.questionsAsked/top*100))+'%';
    const caption=document.createElement('span');caption.textContent=row.date.slice(5);
    column.append(bar,caption);
    chart.append(column);
  }
  const last=new Date(report.generatedAt);
  $('analyticsFreshness').textContent=report.from+' — '+report.to+' · '+report.reportingTimezone+' · '+last.toLocaleString('mn-MN')+' шинэчилсэн';
  $('analyticsChartLegend').textContent='Серверт ирсэн асуулт / өдөр';
  renderAnalyticsEstimate();
}
function renderAnalyticsEstimate(){
  if(!recentAnalytics)return;
  const minutes=Number($('analyticsMinutes').value)||2;
  const count=recentAnalytics.totals.verifiedCatalogAnswers;
  const est=count*minutes;
  $('analyticsEstimate').textContent=int(est)+' минут ≈ '+(est/60).toLocaleString('mn-MN',{maximumFractionDigits:1})+' цаг';
  $('analyticsOutcomeNote').textContent=int(count)+' баталгаатай хариулт × '+minutes+' минут (жишиг таамаглал). Энэ нь хэмжсэн хөдөлмөрийн бүтээмж биш.';
}
async function refreshAnalytics(){
  $('analyticsFreshness').textContent='Мэдээллийг нэгтгэж байна…';
  try{
    recentAnalytics=await api('analytics?days='+encodeURIComponent($('analyticsRange').value));
    renderAnalytics();
  }catch(e){$('analyticsFreshness').textContent='Аналитик авахад алдаа гарлаа: '+e.message;}
}
$('analyticsRange').onchange=refreshAnalytics;
$('analyticsRefresh').onclick=refreshAnalytics;
$('analyticsMinutes').onchange=renderAnalyticsEstimate;
$('analyticsExport').onclick=async()=>{
  const button=$('analyticsExport');button.disabled=true;
  try{
    const response=await fetch(scopeUrl('/api/admin/analytics.csv?days='+encodeURIComponent($('analyticsRange').value)),{
      headers:{Authorization:'Bearer '+token},cache:'no-store'
    });
    if(!response.ok)throw Error('CSV тайлан авах эрх байхгүй эсвэл серверийн алдаа.');
    const blob=await response.blob();
    const objectURL=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=objectURL;
    a.download='RAINY-Pharmacy-'+$('analyticsRange').value+'-day-report.csv';
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(objectURL),30000);
  }catch(error){show(error.message);}
  finally{button.disabled=false;}
};


// Isolated branch administration (platform token can create; tenant tokens cannot list).
async function loadBranches(){
  if(branchSlug)return;
  try{
    const data=await api('branches');
    const target=$('branchList');target.replaceChildren();
    const heading=document.createElement('h3');heading.textContent='Бүртгэлтэй салбарууд';target.append(heading);
    if(!data.branches.length){
      const p=document.createElement('p');p.textContent='Одоогоор нэмэлт салбар байхгүй.';target.append(p);
    }
    const ownerSelect=$('ownerConfigSlug');
    const selectedOwner=ownerSelect.value;
    ownerSelect.replaceChildren(new Option('Салбар сонгох',''));
    for(const row of data.branches)ownerSelect.add(new Option(row.name+' · '+row.slug,row.slug));
    const credentialSelect=$('ownerCredentialSlug');
    const previousCredential=credentialSelect.value;
    credentialSelect.replaceChildren(new Option('Байгууллага сонгох',''));
    for(const row of data.branches)credentialSelect.add(new Option(row.name+' · '+row.slug,row.slug));
    if(data.branches.some(row=>row.slug===previousCredential))credentialSelect.value=previousCredential;

    const catalogSelect=$('ownerCatalogSlug');
    const oldCatalog=catalogSelect.value;
    catalogSelect.replaceChildren(new Option('Байгууллага сонгох',''));
    for(const row of data.branches)catalogSelect.add(new Option(row.name+' · '+row.slug,row.slug));
    if(data.branches.some(row=>row.slug===oldCatalog))catalogSelect.value=oldCatalog;

    if(data.branches.some(row=>row.slug===selectedOwner))ownerSelect.value=selectedOwner;
    for(const item of data.branches){
      const row=document.createElement('div');row.className='branch-list-item';
      const text=document.createElement('div');
      const strong=document.createElement('strong');strong.textContent=item.name;
      const small=document.createElement('small');small.textContent=item.slug;
      text.append(strong,small);
      const subscription=document.createElement('small');
      subscription.textContent=item.subscription.active?'● Идэвхтэй · '+item.subscription.expiresAt.slice(0,10):'○ '+({pending:'Эрх нээгээгүй',expired:'Хугацаа дууссан',paused:'Түр зогсоосон'}[item.subscription.status]||'Идэвхгүй');
      text.append(subscription);
      const kiosk=document.createElement('a');kiosk.href='/?branch='+encodeURIComponent(item.slug);kiosk.textContent='Киоск ↗';kiosk.target='_blank';kiosk.rel='noopener';
      const admin=document.createElement('a');admin.href='/admin.html?branch='+encodeURIComponent(item.slug);admin.textContent='Админ ↗';admin.target='_blank';admin.rel='noopener';
      const manage=document.createElement('button');
      manage.type='button';manage.className='insights-outline';manage.textContent='Эрх удирдах';
      manage.onclick=()=>{ $('subscriptionSlug').value=item.slug;$('subscriptionDate').value=item.subscription.expiresAt?.slice(0,10)||'';$('subscriptionPlan').value=item.subscription.plan||'starter';$('subscriptionStatus').value=item.subscription.status==='paused'?'paused':'active';$('subscriptionForm').scrollIntoView({behavior:'smooth',block:'center'}); };
      row.append(text,kiosk,admin,manage);target.append(row);
    }
  }catch(error){show('Салбаруудыг уншиж чадсангүй: '+error.message);}
}
$('createBranchForm').onsubmit=async(event)=>{
  event.preventDefault();
  const button=$('createBranchBtn');button.disabled=true;
  $('newBranchCredentials').hidden=true;
  try{
    const slug=$('newBranchSlug').value.trim();
    const name=$('newBranchName').value.trim();
    const loginName=$('newBranchLoginName').value.trim();
    const {branch}=await api('branches','POST',{slug,name,loginName});
    $('newBranchToken').textContent=branch.adminToken;
    $('newBranchLoginNameDisplay').textContent=branch.loginName;
    $('newBranchLoginCode').textContent=branch.loginCode;
    const links=$('newBranchLinks');links.replaceChildren();
    const kiosk=document.createElement('a');kiosk.href='/?branch='+encodeURIComponent(slug);kiosk.textContent='Киоск нээх ↗';kiosk.target='_blank';kiosk.rel='noopener';
    const admin=document.createElement('a');admin.href='/admin.html?branch='+encodeURIComponent(slug);admin.textContent='Салбарын админ нээх ↗';admin.target='_blank';admin.rel='noopener';
    links.append(kiosk,admin);
    $('newBranchCredentials').hidden=false;
    $('createBranchForm').reset();
    $('newBranchLoginName').value='manager';
    await loadBranches();
    show('Байгууллага үүслээ. Нэвтрэх нэр, код, токеныг одоо аюулгүй хадгална уу.');
  }catch(error){show('Салбар үүсгэхэд алдаа гарлаа: '+error.message);}
  finally{button.disabled=false;}
};
$('copyBranchToken').onclick=async()=>{
  if(!navigator.clipboard?.writeText){show('Токеныг гараар хуулна уу.');return;}
  try{await navigator.clipboard.writeText($('newBranchToken').textContent);show('Салбарын токеныг хууллаа.');}
  catch{show('Хуулах зөвшөөрөл олгогдоогүй.');}
};

// Logo stays in this branch's settings only and is never sent to outside hosts.
function updateLogoPreview(){
  const img=$('logoPreview');
  img.hidden=!logoData;
  if(logoData)img.src=logoData;else img.removeAttribute('src');
}
$('logoFile').onchange=async()=>{
  const file=$('logoFile').files?.[0];
  if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)){
    show('Лого зөвхөн PNG, JPEG эсвэл WebP зураг байна.');return;
  }
  if(file.size>5000000){show('Зургийн эх файл 5MB-аас бага байна.');return;}
  try{
    const bitmap=await createImageBitmap(file);
    const scale=Math.min(1,400/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));
    canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    bitmap.close();
    let value=canvas.toDataURL('image/webp',.82);
    if(value.length>290000)value=canvas.toDataURL('image/jpeg',.65);
    if(value.length>290000)throw Error('Лого 210KB-аас бага байх шаардлагатай.');
    logoData=value;
    updateLogoPreview();
    show('Лого бэлэн. "Тохиргоо хадгалах" товчийг дараарай.');
  }catch(error){show('Лого боловсруулахад алдаа: '+error.message);}
};
$('logoRemove').onclick=()=>{
  logoData='';$('logoFile').value='';updateLogoPreview();
  show('Лого арилсан. "Тохиргоо хадгалах" товчийг дараарай.');
};

$('subscriptionForm').onsubmit=async e=>{
  e.preventDefault();$('subscriptionSave').disabled=true;
  try{
    const data={slug:$('subscriptionSlug').value,expiresAt:$('subscriptionDate').value||undefined,
      plan:$('subscriptionPlan').value,status:$('subscriptionStatus').value,note:$('subscriptionNote').value};
    const answer=await api('branches/subscription','PUT',data);
    show('Салбарын эрх шинэчлэгдлээ: '+answer.subscription.status);
    await loadBranches();
  }catch(error){show('Эрхийн алдаа: '+error.message);}
  finally{$('subscriptionSave').disabled=false;}
};

$('catalogCsvImport').onclick=async()=>{
  const file=$('catalogCsvFile').files?.[0];
  if(!file){show('CSV файлаа сонгоно уу.');return;}
  if(file.size>1000000){show('CSV файл 1MB-аас бага байх ёстой.');return;}
  try{
    const parsed=parseCatalogCSV(await file.text());
    const current=JSON.parse($('catalog').value||'[]');
    if(!Array.isArray(current))throw Error('Одоогийн каталог буруу.');
    // Preview only; require operator explicitly save to replace catalog.
    $('catalog').value=JSON.stringify(parsed,null,2);
    show(parsed.length+' эмийг CSV-ээс уншлаа. Бодит каталогоо солихоос өмнө мэдээллээ шалгаад "Каталог хадгалах" дарна уу.');
  }catch(error){show('CSV импортын алдаа: '+error.message);}
};

async function refreshDevices(){
 try{
  const data=await api('devices');
  const root=$('devicesList');root.replaceChildren();
  if(!data.devices.length){const p=document.createElement('p');p.textContent='Бүртгэлтэй төхөөрөмж алга.';root.append(p);}
  for(const item of data.devices){
   const div=document.createElement('div');div.className='device-row';
   const text=document.createElement('span');text.textContent=(item.state==='online'?'🟢 ':item.state==='revoked'?'⛔ ':'⚪ ')+item.name+' — '+item.state+' · '+(item.lastSeenAt?new Date(item.lastSeenAt).toLocaleString('mn-MN'):'Холбогдоогүй');
   const revoke=document.createElement('button');revoke.type='button';revoke.textContent='Эрх цуцлах';revoke.disabled=item.state==='revoked';
   revoke.onclick=async()=>{if(!confirm('Энэ төхөөрөмжийн холболтыг цуцлах уу?'))return;await api('devices/revoke','POST',{id:item.id});await refreshDevices();};
   div.append(text,revoke);root.append(div);
  }
 }catch(error){show('Төхөөрөмжийн мэдээлэл: '+error.message);}
}
$('devicesRefresh').onclick=refreshDevices;
$('deviceForm').onsubmit=async e=>{
 e.preventDefault();
 try{
  const x=await api('devices','POST',{name:$('deviceName').value.trim()});
  $('deviceId').textContent=x.device.id;$('deviceToken').textContent=x.device.token;
  $('deviceCredentials').hidden=false;await refreshDevices();
  show('Төхөөрөмж бүртгэгдлээ. Түлхүүрийг аюулгүй хадгалаарай.');
 }catch(error){show('Төхөөрөмж бүртгэх алдаа: '+error.message);}
};
$('deviceConnect').onclick=()=>{
 const id=$('deviceId').textContent,secret=$('deviceToken').textContent;
 const key='rainy-device-'+(branchSlug||'default');
 localStorage.setItem(key,JSON.stringify({id,token:secret}));
 show('Энэ browser-д төхөөрөмж холбогдлоо. Киоскын нүүр хуудсыг нээхэд heartbeat эхэлнэ.');
};
$('backupExport').onclick=async()=>{
 try{
  const x=await api('backup');
  const blob=new Blob([JSON.stringify(x.backup,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='rainy-'+(branchSlug||'default')+'-backup-'+new Date().toISOString().slice(0,10)+'.json';
  a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(error){show('Backup татаж чадсангүй: '+error.message);}
};

async function refreshIntegrations(){
 try{
  const x=await api('integrations/status');
  const lines=[
    ['ElevenLabs Agent',x.services.voice.configured,x.services.voice.clinicalApproved],
    ['OpenAI зураг танилт',x.services.vision.configured,false],
    ['Эм зүйчийн webhook',x.services.pharmacist.configured,false],
    ['POS real-time API',x.services.inventory.livePOSConnected,false]
  ];
  $('integrationStatus').textContent=lines.map(([label,configured,approved])=>label+': '+(configured?'Тохируулсан':'Холбогдоогүй')+(label==='ElevenLabs Agent'?' · Клиник зөвшөөрөл: '+(approved?'Тийм':'Үгүй'):'')).join('\n')+'\nLive production шалгалт: үйлчилгээ тус бүрээр баталгаажаагүй';
 }catch(error){$('integrationStatus').textContent='Оношилгооны алдаа: '+error.message;}
}
$('integrationRefresh').onclick=refreshIntegrations;
$('inventoryImport').onclick=async()=>{
 try{
  const data=JSON.parse($('inventorySnapshot').value);
  if(!Array.isArray(data?.items))throw Error('items массив шаардлагатай.');
  if(!confirm('Баталгаажсан эмийн үнэ, үлдэгдлийг энэ snapshot-аар шинэчлэх үү?'))return;
  const response=await api('inventory/snapshot','PUT',data);
  show(response.updated+' баталгаажсан бүртгэл шинэчлэгдлээ. '+response.ignoredUnverified+' баталгаажаагүй бүртгэлийг алгассан. POS real-time биш.');
  const c=await api('catalog');$('catalog').value=JSON.stringify(c.items,null,2);
 }catch(error){show('POS snapshot алдаа: '+error.message);}
};

const numOps=value=>new Intl.NumberFormat('mn-MN').format(value||0);
async function refreshOrganization(){
 if(branchSlug)return;
 try{
  const days=encodeURIComponent($('orgWindow').value);
  const [report,sla,audit,backup]=await Promise.all([api('organization/report?days='+days),api('organization/sla'),api('audit'),api('organization/backups')]);
  const counts=$('orgMetrics');counts.replaceChildren();
  for(const [label,value] of [
   ['Нийт салбар',report.rows.length],['Нийт асуулт',report.totals.questionsAsked],
   ['Баталгаажсан хариулт',report.totals.verifiedCatalogAnswers],['Эм зүйчид шилжүүлсэн',report.totals.pharmacistReferrals]
  ]){
   const box=document.createElement('div');box.className='ops-stat';
   const big=document.createElement('strong');big.textContent=numOps(value);
   const small=document.createElement('span');small.textContent=label;
   box.append(big,small);counts.append(box);
  }
  const table=$('orgRows');table.replaceChildren();
  for(const item of report.rows){
   const tr=document.createElement('tr');
   for(const value of [item.name,item.subscription.status,item.metrics.questionsAsked,item.metrics.verifiedCatalogAnswers,item.metrics.pharmacistReferrals,item.devices.online+'/'+item.devices.total,item.metrics.voiceConnected||0,'Нийлүүлэгчийн тайлан шаардлагатай']){
    const td=document.createElement('td');td.textContent=String(value);tr.append(td);
   }
   table.append(tr);
  }
  $('slaStatus').textContent='Төхөөрөмж: '+sla.deviceCount+' · Онлайн: '+sla.online+' · Офлайн: '+sla.offline+' · Гэрээний uptime: хэмжигдээгүй';
  $('backupStatus').textContent='Хадгалсан local хуулбар: '+backup.files.length+' · Сүүлийн: '+(backup.files[0]||'Байхгүй')+' · Off-site шалгасан: '+(backup.offsiteVerified?'Тийм':'Үгүй');
  const storage=await api('organization/storage');
  $('storageStatus').textContent='PostgreSQL: '+(storage.postgresMirrorConnected?'Холбогдсон (давхар хадгалалт)':'Баталгаажаагүй')+
    '\nOff-site S3: '+(storage.offsiteLastVerifiedAt?'Шифрлэсэн backup сэргээн унших тест: '+storage.offsiteLastVerifiedAt:'Тест баталгаажаагүй')+
    '\nАнхдагч өгөгдлийн эх үүсвэр: одоогийн persistent volume';
  $('backupModeExplanation').textContent='Шинэ backup нь Railway-ээс тусдаа bucket-д AES-256-GCM шифрлэн хадгалагдаж, татан тайлж шалгадаг. Бүрэн PostgreSQL cutover болон алдагдсан production-ийг автоматаар сэргээх боломж хараахан идэвхжээгүй.';
  const download=$('backupDownload');
  download.hidden=!backup.files.length;
  download.onclick=async()=>{
    try{
      const result=await api('organization/backups/file?filename='+encodeURIComponent(backup.files[0]));
      const blob=new Blob([JSON.stringify(result.payload,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=backup.files[0];link.click();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
    }catch(err){show('Backup татахад алдаа: '+err.message);}
  };
  const log=$('operationsAudit');log.replaceChildren();
  for(const item of audit.events.slice(0,18)){
   const div=document.createElement('div');div.className='ops-audit-item';
   div.textContent=new Date(item.at).toLocaleString('mn-MN')+' · '+item.branch+' · '+item.type;
   log.append(div);
  }
  if(!audit.events.length)log.textContent='Одоогоор аудитын үйлдэл бүртгэгдээгүй байна.';
 }catch(err){show('Нэгдсэн тайлан: '+err.message);}
}
$('orgRefresh').onclick=refreshOrganization;
$('orgWindow').onchange=refreshOrganization;

$('backupNow').onclick=async()=>{
 const button=$('backupNow');button.disabled=true;
 try{const saved=await api('organization/backups/create','POST',{});show('Backup үүслээ: '+saved.backup.filename+' · Энэ нь local volume хуулбар.');await refreshOrganization();}
 catch(error){show('Backup алдаа: '+error.message);}finally{button.disabled=false;}
};

const adminMenu=[
 {id:'overview',icon:'▦',label:'Ерөнхий тойм',hint:'Нэгдсэн тайлан',platform:true},
 {id:'branches',icon:'▤',label:'Салбар ба эрх',hint:'Subscription',platform:true},
 {id:'analytics',icon:'◫',label:'Аналитик',hint:'Үр дүнгийн тайлан'},
 {id:'devices',icon:'▣',label:'Төхөөрөмж',hint:'Киоск мониторинг'},
 {id:'integrations',icon:'◈',label:'AI ба POS',hint:'Холболтын төлөв'},
 {id:'catalog',icon:'☷',label:'Эмийн каталог',hint:'Мэдээлэл ба импорт'},
 {id:'settings',icon:'⚙',label:'Брэнд, AI тохиргоо',hint:'Дүр ба яриа'},
 {id:'security',icon:'◇',label:'Аюулгүй байдал',hint:'Интеграцийн зөвлөмж'}
];
let activeAdminView=branchSlug?'analytics':'overview';
function showAdminView(id){
 const allowed=adminMenu.filter(m=>!m.platform||!branchSlug);
 if(!allowed.some(m=>m.id===id))id=allowed[0].id;
 activeAdminView=id;
 for(const view of document.querySelectorAll('.admin-view'))view.hidden=view.dataset.view!==id;
 for(const button of document.querySelectorAll('#adminNavigation button')){
  const selected=button.dataset.target===id;
  button.classList.toggle('is-active',selected);
  button.setAttribute('aria-current',selected?'page':'false');
 }
 const selected=adminMenu.find(m=>m.id===id);
 $('adminViewTitle').textContent=selected.label;
 $('adminBreadcrumb').textContent='RAINY / '+selected.hint.toUpperCase();
 document.querySelector('.admin-side').classList.remove('is-open');
 $('adminNavToggle').setAttribute('aria-expanded','false');
 try{history.replaceState(null,'',location.pathname+(branchSlug?'?branch='+encodeURIComponent(branchSlug)+'&':'?')+'tab='+encodeURIComponent(id));}catch{}
}
function initAdminNavigation(){
 const nav=$('adminNavigation');nav.replaceChildren();
 for(const item of adminMenu.filter(x=>!x.platform||!branchSlug)){
  const button=document.createElement('button');button.type='button';
  button.className='admin-nav-link';button.dataset.target=item.id;
  const glyph=document.createElement('span');glyph.className='admin-nav-icon';glyph.textContent=item.icon;
  const labels=document.createElement('span');labels.className='admin-nav-label';
  const title=document.createElement('strong');title.textContent=item.label;
  const hint=document.createElement('small');hint.textContent=item.hint;labels.append(title,hint);
  button.append(glyph,labels);
  button.onclick=()=>showAdminView(item.id);nav.append(button);
 }
 const query=new URLSearchParams(location.search).get('tab');
 showAdminView(adminMenu.some(x=>x.id===query)?query:activeAdminView);
 $('adminBranchPill').textContent=branchSlug?'Салбар: '+branchSlug:'Төв удирдлага';
}
$('adminNavToggle').onclick=()=>{
 const side=document.querySelector('.admin-side');
 const opened=side.classList.toggle('is-open');
 $('adminNavToggle').setAttribute('aria-expanded',String(opened));
};

$('integrationAgentSave').onclick=async()=>{
 const button=$('integrationAgentSave');button.disabled=true;
 try{
  const agentId=$('integrationAgentId').value.trim();
  await api('settings','PUT',{agentId});
  $('agentId').value=agentId;
  await refreshIntegrations();
  await refreshVoiceStatus();
  show('ElevenLabs Agent ID хадгалагдлаа. API түлхүүр серверийн нууц тохиргоонд хадгалагдана.');
 }catch(error){show('Agent холболт: '+error.message);}finally{button.disabled=false;}
};

async function loadOwnerBranchConfig(){
 const slug=$('ownerConfigSlug').value;
 if(!slug){show('Эхлээд байгууллага сонгоно уу.');return;}
 try{
  const result=await api('branches/config?slug='+encodeURIComponent(slug));
  const settings=result.settings;
  $('ownerConfigPharmacy').value=settings.pharmacyName||'';
  $('ownerConfigAssistant').value=settings.assistantName||'';
  $('ownerConfigAgent').value=settings.agentId||'';
  $('ownerConfigIdle').value=settings.idleTimeoutSec??120;
  $('ownerConfigDisconnect').checked=settings.resetOnDisconnect!==false;
  $('ownerConfigAvatarIdle').checked=settings.avatarIdleEnabled!==false;
  show('Байгууллагын тохиргоог уншлаа.');
 }catch(error){show('Тохиргоо унших алдаа: '+error.message);}
}
$('ownerConfigLoad').onclick=loadOwnerBranchConfig;
$('ownerConfigSlug').onchange=loadOwnerBranchConfig;
$('ownerBranchConfig').onsubmit=async event=>{
 event.preventDefault();
 const slug=$('ownerConfigSlug').value;
 if(!slug){show('Байгууллага сонгоно уу.');return;}
 const settings={
  pharmacyName:$('ownerConfigPharmacy').value.trim(),
  assistantName:$('ownerConfigAssistant').value.trim(),
  agentId:$('ownerConfigAgent').value.trim(),
  idleTimeoutSec:Number($('ownerConfigIdle').value),
  resetOnDisconnect:$('ownerConfigDisconnect').checked,
  avatarIdleEnabled:$('ownerConfigAvatarIdle').checked
 };
 try{await api('branches/config','PUT',{slug,settings});show('Байгууллагын AI тохиргоо хадгалагдлаа. Киоск дахин ачаалахад хэрэгжинэ.');}
 catch(error){show('Байгууллагын тохиргооны алдаа: '+error.message);}
};

const subscriptionMonthlyPrices={starter:399000,pro:699000,enterprise:1299000};
function renderSubscriptionPrice(){
 const price=subscriptionMonthlyPrices[$('subscriptionPlan').value];
 $('subscriptionPriceNote').textContent='Сарын багцын жишиг үнэ: '+new Intl.NumberFormat('mn-MN').format(price)+'₮. Төлбөр автоматаар татагдахгүй; эрхийн дуусах огноог админ тохируулна.';
}
$('subscriptionPlan').addEventListener('change',renderSubscriptionPrice);
renderSubscriptionPrice();

const catalogCsvHeaders=['id','name','aliases','category','form','description','warnings','storage','notes','shelf','priceMnt','stock','verified'];
const templateCsv='\uFEFF'+catalogCsvHeaders.join(',')+'\r\n'+
  'example-id,Жишээ эм,,Ангилал,Таблет,Зөвхөн баталгаажсан тайлбар,Эм зүйчтэй зөвлөнө,Хуурай орчинд,,,,0,false\r\n';
function downloadCatalogTemplate(){
 const blob=new Blob([templateCsv],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');
 a.href=url;a.download='rainy-pharmacy-catalog-template.csv';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('catalogCsvTemplate').onclick=downloadCatalogTemplate;
$('ownerCatalogTemplate').onclick=downloadCatalogTemplate;
$('ownerCatalogBlank').onclick=()=>{
 const slug=$('ownerCatalogSlug').value;
 if(!slug){show('Эхлээд байгууллага сонгоно уу.');return;}
 $('ownerCatalogJSON').value='[]';
 $('ownerCatalogJSON').dataset.loadedSlug=slug;
 show('Хоосон каталог бэлтгэлээ. Хадгалах товч дараагүй тул хуучин мэдээлэл өөрчлөгдөөгүй.');
};
$('ownerCatalogLoad').onclick=async()=>{
 const slug=$('ownerCatalogSlug').value;
 if(!slug){show('Байгууллага сонгоно уу.');return;}
 try{
  const result=await api('branches/catalog?slug='+encodeURIComponent(slug));
  $('ownerCatalogJSON').value=JSON.stringify(result.items,null,2);
  $('ownerCatalogJSON').dataset.loadedSlug=slug;
  show(result.items.length+' эмийн мэдээлэл уншлаа.');
 }catch(e){show('Каталог унших алдаа: '+e.message);}
};
$('ownerCatalogSlug').onchange=()=>{
 $('ownerCatalogJSON').value='';
 $('ownerCatalogJSON').dataset.loadedSlug='';
};
$('ownerCatalogCsvImport').onclick=async()=>{
 const file=$('ownerCatalogCsvFile').files?.[0];
 if(!file){show('CSV файлаа сонгоно уу.');return;}
 if(file.size>1000000){show('CSV 1MB-аас бага байна.');return;}
 try{
  const parsed=parseCatalogCSV(await file.text());
  $('ownerCatalogJSON').value=JSON.stringify(parsed,null,2);
  $('ownerCatalogJSON').dataset.loadedSlug=$('ownerCatalogSlug').value;
  show(parsed.length+' эмийн мэдээлэл шалгахад бэлэн. Хадгалах товч дарахаас өмнө нягтална уу.');
 }catch(e){show('CSV формат буруу: '+e.message);}
};
$('ownerCatalogSave').onclick=async()=>{
 const slug=$('ownerCatalogSlug').value;
 if(!slug||$('ownerCatalogJSON').dataset.loadedSlug!==slug){show('Тухайн байгууллагын каталогийг эхлээд уншина уу.');return;}
 try{
  const items=JSON.parse($('ownerCatalogJSON').value);
  if(!Array.isArray(items))throw Error('Каталог массив байна.');
  if(!confirm(slug+' байгууллагын каталогийг '+items.length+' эмээр СОЛИХ уу?'))return;
  const result=await api('branches/catalog','PUT',{slug,items});
  show(result.count+' эмийн мэдээлэл зөвхөн '+slug+' байгууллагад хадгалагдлаа.');
 }catch(e){show('Каталог хадгалах алдаа: '+e.message);}
};

$('ownerCredentialForm').onsubmit=async event=>{
 event.preventDefault();
 const slug=$('ownerCredentialSlug').value;
 if(!slug){show('Байгууллага сонгоно уу.');return;}
 const loginName=$('ownerLoginName').value.trim();
 const loginCode=$('ownerLoginCode').value;
 const adminToken=$('ownerAdminToken').value;
 if(!loginName&&!loginCode&&!adminToken){show('Солих мэдээлэл оруулна уу.');return;}
 if(!confirm(slug+' байгууллагын хуучин нэвтрэх мэдээллийг хүчингүй болгох уу?'))return;
 const body={slug};
 if(loginName)body.loginName=loginName;
 if(loginCode)body.loginCode=loginCode;
 if(adminToken)body.adminToken=adminToken;
 try{
  await api('branches/credentials','PUT',body);
  $('ownerLoginName').value='';
  $('ownerLoginCode').value='';
  $('ownerAdminToken').value='';
  show(slug+' байгууллагын нэвтрэх мэдээлэл шинэчлэгдлээ. Шинэ код/токеныг аюулгүй хадгална уу.');
 }catch(error){show('Нэвтрэх мэдээлэл солих алдаа: '+error.message);}
};


let creditPollingStarted=false;
const creditNumber=v=>new Intl.NumberFormat('mn-MN').format(v);
async function refreshElevenLabsCredits(){
 if(branchSlug||!token||document.visibilityState==='hidden')return;
 const status=$('elevenlabsCreditStatus'),updated=$('elevenlabsCreditUpdated');
 $('elevenlabsCreditPanel').hidden=false;
 $('elevenlabsCreditRefresh').disabled=true;
 try{
  const value=await api('elevenlabs/credits');
  if(!value.ok){
   status.textContent='Бодит хэрэглээний мэдээлэл боломжгүй — '+(value.message||'ElevenLabs холболтоо шалгана уу.');
   updated.textContent='Хэрэглээний үлдэгдлийг 0 гэж тооцоогүй. Agent ID болон тухайн API key-ийн User/Subscription унших зөвшөөрлийг шалгана уу.';
   return;
  }
  const included=value.included;
  status.textContent=included?
   'Багцад багтсан credit: '+creditNumber(included.remaining)+' үлдсэн · '+creditNumber(included.used)+' ашигласан / '+creditNumber(included.limit)+' нийт':
   'ElevenLabs-ийн энэ API хариултад credit тоон үзүүлэлт алга. 0 гэж үзэхгүй.';
  updated.textContent='Багц: '+value.tier+' · Төлөв: '+value.status+
    ' · Шалгасан: '+(value.checkedAt?new Date(value.checkedAt).toLocaleString('mn-MN'):'Тодорхойгүй')+
    ' · Нийт workspace-ийн хэрэглээ (PAYG Top Up тусдаа).';
 }catch(error){
  status.textContent='Credit татах алдаа: '+error.message;
  updated.textContent='Энэ нь 0 үлдэгдэл гэсэн үг биш.';
 }finally{$('elevenlabsCreditRefresh').disabled=false;}
}
function startElevenLabsCreditsPolling(){
 if(creditPollingStarted)return;
 creditPollingStarted=true;
 void refreshElevenLabsCredits();
 setInterval(()=>{if(document.visibilityState==='visible')void refreshElevenLabsCredits();},120000);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refreshElevenLabsCredits();});
}
$('elevenlabsCreditRefresh').onclick=refreshElevenLabsCredits;
