import test from 'node:test';
import assert from 'node:assert/strict';
import {AVATAR_3D_PROFILES,clampAudioLevel,resolveExpression} from '../src/avatar-profiles.js';
import {AVATARS} from '../server/core.mjs';

test('each kiosk avatar has a unique, complete premium 3D appearance',()=>{
  assert.deepEqual(Object.keys(AVATAR_3D_PROFILES).sort(),AVATARS.map(a=>a.id).sort());
  const ids=new Set();
  for(const [id,p] of Object.entries(AVATAR_3D_PROFILES)){
    assert.equal(ids.has(id),false); ids.add(id);
    assert.ok(['human','robot','hologram'].includes(p.kind));
    for(const field of ['skin','body','iris','trim','accent']){
      assert.match(p[field],/^#[a-fA-F0-9]{6}$/);
    }
    assert.ok(p.name?.length>=2);
  }
});
test('audio amplitude must never break facial geometry',()=>{
  for(const [input,expected] of [[-12,0],[0,0],[.42,.42],[1,1],[30,1],[NaN,0],[undefined,0],[Infinity,0]]){
    assert.equal(clampAudioLevel(input),expected);
  }
});
test('unknown emotional states fall back to friendly neutral and never prescribe',()=>{
  assert.equal(resolveExpression('speaking'),'talking');
  assert.equal(resolveExpression('listening'),'attentive');
  assert.equal(resolveExpression('connecting'),'thinking');
  assert.equal(resolveExpression('emergency'),'concerned');
  assert.equal(resolveExpression('<script>'),'neutral');
});