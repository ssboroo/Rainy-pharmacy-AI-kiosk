/** Local scheduled snapshots, not off-site disaster recovery. */
import {mkdir,readFile,writeFile,readdir,unlink,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const dateCode=now=>now.toISOString().replace(/[:.]/g,'-');
export function createBackupManager({directory,dataDir,now=()=>new Date(),maxFiles=14}){
 if(!directory||!dataDir)throw Error('Backup paths required');
 async function snapshot(payload){
  // Snapshot only validated non-sensitive business data. The payload is constructed
  // on the server; no provider keys/admin tokens/device enrollment secrets.
  const record={version:1,createdAt:now().toISOString(),data:payload};
  const raw=JSON.stringify(record);
  const sha256=createHash('sha256').update(raw).digest('hex');
  await mkdir(directory,{recursive:true});
  const filename='rainy-'+dateCode(now())+'-'+sha256.slice(0,10)+'.json';
  const file=join(directory,filename);
  await writeFile(file+'.tmp',raw,{mode:0o600,flag:'wx'});
  await rename(file+'.tmp',file);
  const names=(await readdir(directory)).filter(v=>/^rainy-[\dTZ-]+-[a-f0-9]{10}\.json$/.test(v)).sort();
  for(const old of names.slice(0,Math.max(0,names.length-maxFiles)))await unlink(join(directory,old));
  return {filename,sha256,createdAt:record.createdAt,bytes:Buffer.byteLength(raw)};
 }
 async function list(){
  try{
   const names=(await readdir(directory)).filter(v=>/^rainy-[\dTZ-]+-[a-f0-9]{10}\.json$/.test(v)).sort().reverse();
   return names;
  }catch(e){if(e.code==='ENOENT')return [];throw e;}
 }
 async function verify(filename){
  if(typeof filename!=='string'||!/^rainy-[\dTZ-]+-[a-f0-9]{10}\.json$/.test(filename))throw Error('Invalid backup name');
  const raw=await readFile(join(directory,filename),'utf8');
  const sha256=createHash('sha256').update(raw).digest('hex');
  if(!filename.endsWith('-'+sha256.slice(0,10)+'.json'))throw Object.assign(Error('Backup checksum mismatch'),{code:422});
  return {filename,sha256,payload:JSON.parse(raw)};
 }
 return {snapshot,list,verify};
}
