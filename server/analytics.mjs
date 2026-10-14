/**
 * RAINY pharmacy kiosk: aggregate, privacy-preserving analytics.
 * DO NOT collect or persist spoken words, text questions, prescriptions,
 * medicine names, user IDs, cookies, IP addresses, audio or images.
 *
 * Internal metrics are recorded only after server-side actions.
 * Public metrics are low-trust counters (not unique people, not sales).
 */
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
export const REPORTING_TIMEZONE='Asia/Ulaanbaatar';

export const ANALYTICS_METRICS=Object.freeze([
  'sessionStarted','questionsAsked','verifiedCatalogAnswers','demoInformationShown',
  'unresolvedQuestions','pharmacistReferrals','emergencyEscalations',
  'catalogOpened','medicineDetailsViewed',
  'voiceStarted','voiceConnected','voiceFailed','voiceMessagesObserved',
  'staffRequests','staffRequestsSent','visionAttempts','visionRecognitions'
]);
export const ANALYTICS_PUBLIC_EVENTS=Object.freeze([
  'sessionStarted','catalogOpened','medicineDetailsViewed',
  'voiceStarted','voiceConnected','voiceFailed','voiceMessagesObserved'
]);
const metricSet=new Set(ANALYTICS_METRICS);
const publicSet=new Set(ANALYTICS_PUBLIC_EVENTS);
const dateKeyPattern=/^\d{4}-\d{2}-\d{2}$/;

function mnDate(value) {
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:REPORTING_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(value);
  const field=type=>parts.find(p=>p.type===type)?.value;
  return field('year')+'-'+field('month')+'-'+field('day');
}
function dayMinus(dateKey,days){
  const [y,m,d]=dateKey.split('-').map(Number);
  return new Date(Date.UTC(y,m-1,d-days)).toISOString().slice(0,10);
}
function emptyCounts(){return Object.fromEntries(ANALYTICS_METRICS.map(m=>[m,0]));}
function cleanCounts(raw){
  const out=emptyCounts();
  for(const key of ANALYTICS_METRICS){
    const value=raw?.[key];
    if(Number.isSafeInteger(value)&&value>=0)out[key]=value;
  }
  return out;
}
function supportedDays(input){
  const n=Number(input);
  return [7,30,90].includes(n)?n:30;
}

export function metricForAnswer(answer){
  switch(answer?.kind){
    case 'catalog':return ['questionsAsked','verifiedCatalogAnswers'];
    case 'demo':return ['questionsAsked','demoInformationShown','pharmacistReferrals'];
    case 'pharmacist':return ['questionsAsked','pharmacistReferrals'];
    case 'unknown':return ['questionsAsked','unresolvedQuestions','pharmacistReferrals'];
    case 'emergency':return ['questionsAsked','emergencyEscalations','pharmacistReferrals'];
    default:return [];
  }
}
export function analyticsCSV(report){
  const metricColumns=['questionsAsked','verifiedCatalogAnswers',...ANALYTICS_METRICS.filter(m=>!['questionsAsked','verifiedCatalogAnswers'].includes(m))];
  const columns=['date',...metricColumns];
  return '\ufeff'+columns.join(',')+'\n'+report.days.map(day=>
    [day.date,...metricColumns.map(key=>day[key])].join(',')
  ).join('\n')+'\n';
}

export function createAnalyticsStore({filePath,now=()=>new Date()}){
  if(!filePath||typeof filePath!=='string')throw Error('Analytics storage file path required.');
  const state={version:1,byDay:{}};
  let loaded=false;
  let writes=Promise.resolve();

  async function load(){
    if(loaded)return;
    try{
      const parsed=JSON.parse(await readFile(filePath,'utf8'));
      if(parsed?.version===1 && parsed.byDay && typeof parsed.byDay==='object'){
        for(const [key,value] of Object.entries(parsed.byDay)){
          if(dateKeyPattern.test(key) && value && typeof value==='object'){
            state.byDay[key]=cleanCounts(value);
          }
        }
      }
    }catch(e){if(e.code!=='ENOENT')throw e;}
    loaded=true;
  }
  async function recordInternal(metrics){
    if(!loaded)throw Error('Analytics store not loaded.');
    if(!Array.isArray(metrics)||metrics.some(m=>!metricSet.has(m)))throw Error('Invalid metrics.');
    if(!metrics.length)return;
    const date=mnDate(now());
    const row=state.byDay[date]??emptyCounts();
    for(const metric of metrics)row[metric]++;
    state.byDay[date]=row;
    // Retain at most ~1 year of aggregates. No individual-level events are stored.
    const cutoff=dayMinus(date,399);
    for(const key of Object.keys(state.byDay))if(key<cutoff)delete state.byDay[key];
    const contents=JSON.stringify(state);
    const pending=writes.catch(()=>{}).then(async()=>{
      await mkdir(dirname(filePath),{recursive:true});
      await writeFile(filePath+'.tmp',contents,'utf8');
      await rename(filePath+'.tmp',filePath);
    });
    writes=pending;
    await pending;
  }
  async function recordPublic(event){
    if(!publicSet.has(event))throw Error('Invalid public event.');
    await recordInternal([event]);
  }
  function report(inputDays=30){
    if(!loaded)throw Error('Analytics store not loaded.');
    const count=supportedDays(inputDays);
    const today=mnDate(now());
    const days=Array.from({length:count},(_,index)=>{
      const date=dayMinus(today,count-index-1);
      return {date,...cleanCounts(state.byDay[date])};
    });
    const totals=emptyCounts();
    for(const day of days){
      for(const metric of ANALYTICS_METRICS)totals[metric]+=day[metric];
    }
    return {
      kind:'observed-counts',
      reportingTimezone:REPORTING_TIMEZONE,
      daysWindow:count,
      from:days[0].date,to:days.at(-1).date,
      generatedAt:now().toISOString(),
      totals,days,
      limitations:[
        'Session starts are device interaction counts, not unique visitors.',
        'Voice and UI activity counts are browser reported; they are not medical outcomes.',
        'Only server-verified catalog answers count as verifiedCatalogAnswers.',
        'Waiting time saved and revenue are not measured. Estimate assumptions separately.',
        'The dashboard does not store customer names, conversation text, audio or medication requests.'
      ]
    };
  }
  return {load,recordInternal,recordPublic,report};
}
