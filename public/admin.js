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
    $('editor').hidden=false;$('token').value='';show('Амжилттай нэвтэрлээ.');
    await Promise.all([refreshVoiceStatus(),refreshAnalytics()]);
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
    const response=await fetch('/api/admin/analytics.csv?days='+encodeURIComponent($('analyticsRange').value),{
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
