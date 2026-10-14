import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createAnalyticsStore,analyticsCSV,metricForAnswer,ANALYTICS_PUBLIC_EVENTS} from '../server/analytics.mjs';

test('counts real interactions separately from self reported kiosk events',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'rainy-analytics-'));
  const clock=()=>new Date('2026-10-14T10:00:00.000Z');
  try{
    const store=createAnalyticsStore({filePath:join(dir,'analytics.json'),now:clock});
    await store.load();
    await store.recordInternal(['questionsAsked','verifiedCatalogAnswers']);
    await store.recordInternal(['questionsAsked','demoInformationShown','pharmacistReferrals']);
    await store.recordInternal(['questionsAsked','emergencyEscalations','pharmacistReferrals']);
    await store.recordPublic('voiceConnected');
    await store.recordPublic('sessionStarted');
    const report=store.report(7);
    assert.equal(report.totals.questionsAsked,3);
    assert.equal(report.totals.verifiedCatalogAnswers,1);
    assert.equal(report.totals.demoInformationShown,1);
    assert.equal(report.totals.pharmacistReferrals,2);
    assert.equal(report.totals.emergencyEscalations,1);
    assert.equal(report.totals.voiceConnected,1);
    assert.equal(report.totals.sessionStarted,1);
    assert.equal(report.days.length,7);
    assert.equal(report.reportingTimezone,'Asia/Ulaanbaatar');
    assert.equal(report.kind,'observed-counts');
    assert.equal(report.estimatedStaffMinutes,undefined);
    const saved=JSON.parse(await readFile(join(dir,'analytics.json'),'utf8'));
    assert.equal(JSON.stringify(saved).includes('voice transcript'),false);
    const restarted=createAnalyticsStore({filePath:join(dir,'analytics.json'),now:clock});
    await restarted.load();
    assert.deepEqual(restarted.report(7).totals,report.totals);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('server summary never considers demo results to be verified resolutions',()=>{
  assert.deepEqual(metricForAnswer({kind:'catalog',requiresPharmacist:false}),['questionsAsked','verifiedCatalogAnswers']);
  assert.deepEqual(metricForAnswer({kind:'demo',requiresPharmacist:true}),['questionsAsked','demoInformationShown','pharmacistReferrals']);
  assert.deepEqual(metricForAnswer({kind:'unknown',requiresPharmacist:true}),['questionsAsked','unresolvedQuestions','pharmacistReferrals']);
  assert.deepEqual(metricForAnswer({kind:'pharmacist',requiresPharmacist:true}),['questionsAsked','pharmacistReferrals']);
  assert.deepEqual(metricForAnswer({kind:'emergency',requiresPharmacist:true}),['questionsAsked','emergencyEscalations','pharmacistReferrals']);
  assert.deepEqual(metricForAnswer({kind:'invalid'}),[]);
});
test('public metrics accept only non-medical event names; cannot forge verified resolutions',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'rainy-analytics-'));
  try{
    const store=createAnalyticsStore({filePath:join(dir,'analytics.json')});
    await store.load();
    assert.ok(ANALYTICS_PUBLIC_EVENTS.includes('catalogOpened'));
    await assert.rejects(store.recordPublic('verifiedCatalogAnswers'),/Invalid public event/);
    await assert.rejects(store.recordPublic('pharmacistReferrals'),/Invalid public event/);
    await assert.rejects(store.recordPublic({question:'personal prescription'}),/Invalid public event/);
    await store.recordPublic('medicineDetailsViewed');
    assert.equal(store.report(7).totals.medicineDetailsViewed,1);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('CSV export contains daily aggregates and no identifying data',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'rainy-analytics-'));
  try{
    const store=createAnalyticsStore({filePath:join(dir,'analytics.json'),now:()=>new Date('2026-10-14T10:00:00Z')});
    await store.load();
    await store.recordInternal(['questionsAsked','verifiedCatalogAnswers']);
    const csv=analyticsCSV(store.report(7));
    assert.match(csv,/date,questionsAsked,verifiedCatalogAnswers/);
    assert.match(csv,/2026-10-14,1,1/);
    assert.doesNotMatch(csv,/personal prescription|fullName|transcript|ipAddress/i);
    assert.equal(csv.split('\n').length,9);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('reporting window clamps to supported 7, 30 and 90 day ranges',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'rainy-analytics-'));
  try{
    const store=createAnalyticsStore({filePath:join(dir,'analytics.json')});
    await store.load();
    assert.equal(store.report(999).days.length,30);
    assert.equal(store.report(7).days.length,7);
    assert.equal(store.report(90).days.length,90);
  }finally{await rm(dir,{recursive:true,force:true});}
});
