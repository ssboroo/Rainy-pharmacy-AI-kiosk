import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {copyElevenLabsWorklets} from '../scripts/copy-elevenlabs-worklets.mjs';
import {ELEVENLABS_WORKLET_PATHS} from '../src/voice-worklets.js';

test('ElevenLabs worklet URLs are same-origin JavaScript files, not blocked blob/data URLs',()=>{
  assert.deepEqual(ELEVENLABS_WORKLET_PATHS,{
    rawAudioProcessor:'/vendor/elevenlabs/rawAudioProcessor.js',
    audioConcatProcessor:'/vendor/elevenlabs/audioConcatProcessor.js'
  });
  for(const filename of Object.values(ELEVENLABS_WORKLET_PATHS)){
    assert.match(filename,/^\/vendor\/elevenlabs\/[A-Za-z]+\.js$/);
  }
});
test('build copies real ElevenLabs SDK worklets from installed package into served public directory',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'rainy-worklet-test-'));
  try{
    const paths=await copyElevenLabsWorklets(dir);
    assert.equal(paths.length,2);
    for(const path of Object.values(ELEVENLABS_WORKLET_PATHS)){
      const file=join(dir,path.slice(1));
      const info=await stat(file);
      const content=await readFile(file,'utf8');
      assert.ok(info.isFile());
      assert.ok(content.length>100);
      assert.match(content,/registerProcessor\s*\(/);
      assert.doesNotMatch(content,/<html/i);
    }
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('secure CSP stays strict and frontend SDK uses static audio worklet URLs',async()=>{
  const server=await readFile(new URL('../server/index.mjs',import.meta.url),'utf8');
  const client=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(server,/script-src 'self'/);
  assert.doesNotMatch(server,/script-src '[^']*' blob:/);
  assert.match(client,/workletPaths:\s*ELEVENLABS_WORKLET_PATHS/);
  assert.match(client,/connectionType:\s*'websocket'/);
});
