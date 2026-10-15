import {parseCatalogCSV} from './catalog-csv.js';
let token='';
const $=id=>document.getElementById(id);
const branchSlug=new URLSearchParams(window.location.search).get('branch')||'';
const scopeUrl=path=>path+(branchSlug?(path.includes('?')?'&':'?')+'branch='+encodeURIComponent(branchSlug):'');
let logoData='';
const show=message=>{$('status').textContent=message;};
async function api(route,method='GET',body){
  const response=await fetch(scopeUrl('/api/admin/'+route),{method,headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Server error');return data;
}
$('login').onclick=async()=>{
  token=$('token').value.trim();
  try{
    const [s,c]=await Promise.all([api('settings'),api('catalog')]);
    const config=s.settings;
    for(const key of ['pharmacyName','assistantName','greeting','locationName','agentId','defaultAvatar','accent']) if($(key))$(key).value=config[key];
    logoData=config.logoData||'';
    updateLogoPreview();
    $('catalog').value=JSON.stringify(c.items,null,2);
    $('currentBranchBanner').textContent=branchSlug?'🔐 Салбарын тусгаарлагдсан админ: '+branchSlug:'✦ Үндсэн / төв эмийн сангийн админ';
    if(!branchSlug){$('branchManager').hidden=false;$('organizationOperations').hidden=false;await loadBranches();await refreshOrganization();}
    else $('branchManager').hidden=true;
    $('editor').hidden=false;$('token').value='';show('Амжилттай нэвтэрлээ.');
    await Promise.all([refreshVoiceStatus(),refreshAnalytics(),refreshDevices(),refreshIntegrations()]);
  }catch(e){token='';show('Нэвтэрч чадсангүй: '+e.message);}
};
const avatars=[['nomi','Номи — робот'],['mira','Мира — AI хүн'],['kiki','Кики — робот'],['aria','Ариа — hologram'],['bobo','Бобо — робот']];
for(const [id,name] of avatars){const el=document.createElement('option');el.value=id;el.textContent=name;$('defaultAvatar').append(el);}
$('saveSettings').onclick=async()=>{
  const data={};for(const key of ['pharmacyName','assistantName','greeting','locationName','agentId','defaultAvatar','accent'])data[key]=$(key).value;
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
    const {branch}=await api('branches','POST',{slug,name});
    $('newBranchToken').textContent=branch.adminToken;
    const links=$('newBranchLinks');links.replaceChildren();
    const kiosk=document.createElement('a');kiosk.href='/?branch='+encodeURIComponent(slug);kiosk.textContent='Киоск нээх ↗';kiosk.target='_blank';kiosk.rel='noopener';
    const admin=document.createElement('a');admin.href='/admin.html?branch='+encodeURIComponent(slug);admin.textContent='Салбарын админ нээх ↗';admin.target='_blank';admin.rel='noopener';
    links.append(kiosk,admin);
    $('newBranchCredentials').hidden=false;
    $('createBranchForm').reset();
    await loadBranches();
    show('Салбар үүслээ. Түүний токеныг аюулгүй хадгална уу.');
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
   for(const value of [item.name,item.subscription.status,item.metrics.questionsAsked,item.metrics.verifiedCatalogAnswers,item.metrics.pharmacistReferrals,item.devices.online+'/'+item.devices.total]){
    const td=document.createElement('td');td.textContent=String(value);tr.append(td);
   }
   table.append(tr);
  }
  $('slaStatus').textContent='Төхөөрөмж: '+sla.deviceCount+' · Онлайн: '+sla.online+' · Офлайн: '+sla.offline+' · Гэрээний uptime: хэмжигдээгүй';
  $('backupStatus').textContent='Хадгалсан хуулбар: '+backup.files.length+' · Сүүлийн: '+(backup.files[0]||'Байхгүй')+' · Off-site: үгүй';
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
