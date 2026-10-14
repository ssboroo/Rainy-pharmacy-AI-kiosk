import test from 'node:test';
import assert from 'node:assert/strict';
import {AVATARS} from '../server/core.mjs';
import {AVATAR_STYLES, avatarMarkup, normalizeVoiceEnergy, expressionFor} from '../src/avatar-25d.js';

test('all existing five names have a distinct 2.5D illustration and accent',()=>{
  const names=AVATARS.map(a=>a.id);
  assert.deepEqual(Object.keys(AVATAR_STYLES).sort(),names.sort());
  assert.equal(new Set(Object.values(AVATAR_STYLES).map(p=>p.tint)).size,names.length);
  assert.equal(new Set(Object.values(AVATAR_STYLES).map(p=>p.identity)).size,names.length);
  for(const id of names){
    const svg=avatarMarkup(id);
    assert.match(svg,/viewBox="0 0 800 800"/);
    assert.match(svg,/class=".*2d5-portrait/);
    assert.match(svg,/class=".*2d5-eyes/);
    assert.match(svg,/class=".*2d5-mouth-open/);
    assert.match(svg,/class=".*2d5-head/);
    assert.match(svg,/class=".*2d5-body/);
    assert.ok(svg.length>4000);
  }
});
test('SVG markup uses unique per-portrait IDs so several can coexist',()=>{
  const first=avatarMarkup('nomi','instance-one');
  const second=avatarMarkup('nomi','instance-two');
  assert.match(first,/id="instance-one-mask"/);
  assert.match(second,/id="instance-two-mask"/);
  assert.doesNotMatch(first,/instance-two/);
});
test('unknown avatar selection fails safe to Nomi without HTML injection',()=>{
  const svg=avatarMarkup('<img onerror=alert(1)>');
  assert.match(svg,/2d5-portrait/);
  assert.doesNotMatch(svg,/onerror/);
});
test('audio intensity is clamped and prevents NaN browser layout',()=>{
  for(const [input,out] of [[-10,0],[0,0],[.7,.7],[2,1],[NaN,0],[Infinity,0],[undefined,0]]){
    assert.equal(normalizeVoiceEnergy(input),out);
  }
});
test('expression states correspond to listening, speaking, thinking',()=>{
  assert.equal(expressionFor('speaking'),'speaking');
  assert.equal(expressionFor('listening'),'attentive');
  assert.equal(expressionFor('wake'),'attentive');
  assert.equal(expressionFor('connecting'),'thinking');
  assert.equal(expressionFor('emergency'),'concerned');
  assert.equal(expressionFor('whatever'),'calm');
});