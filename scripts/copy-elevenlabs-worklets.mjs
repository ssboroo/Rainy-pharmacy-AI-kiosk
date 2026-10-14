/**
 * Strict-CSP ElevenLabs AudioWorklet installation.
 *
 * The SDK's default worklets are blob/data URLs, blocked by script-src 'self'.
 * Copy the version-matched upstream worklets from the installed package into
 * Vite's public assets. Never use third-party CDN or weaken script-src.
 */
import {mkdir,copyFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const names=['rawAudioProcessor.js','audioConcatProcessor.js'];

export async function copyElevenLabsWorklets(publicDir=resolve('public')){
  const directory=join(publicDir,'vendor','elevenlabs');
  await mkdir(directory,{recursive:true});
  const installed=[];
  for(const name of names){
    const moduleName='@elevenlabs/client/worklets/'+name;
    const source=fileURLToPath(import.meta.resolve(moduleName));
    const script=await readFile(source,'utf8');
    if(!script.includes('registerProcessor(')){
      throw Error('Unexpected ElevenLabs worklet content: '+moduleName);
    }
    const destination=join(directory,name);
    await copyFile(source,destination);
    installed.push(destination);
  }
  return installed;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const files=await copyElevenLabsWorklets();
    console.log('Prepared strict-CSP ElevenLabs AudioWorklets:',files.map(x=>x.split('/').slice(-1)[0]).join(', '));
  }catch(error){
    console.error('ElevenLabs AudioWorklet setup failed:',error.message);
    process.exitCode=1;
  }
}
