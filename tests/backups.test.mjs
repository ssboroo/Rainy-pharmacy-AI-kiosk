import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createBackupManager} from '../server/backups.mjs';
test('local snapshots retain latest N files and verify SHA-256 content digest',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'rainy-backups-'));
 let n=0;
 const store=createBackupManager({directory:join(dir,'snapshots'),dataDir:dir,now:()=>new Date('2026-10-15T'+String(n++).padStart(2,'0')+':00:00Z'),maxFiles:2});
 try{
  await store.snapshot({catalog:[]});
  await store.snapshot({catalog:[]});
  await store.snapshot({catalog:[]});
  const files=await store.list();
  assert.equal(files.length,2);
  const v=await store.verify(files[0]);
  assert.equal(v.sha256.length,64);
  assert.equal(v.payload.data.catalog.length,0);
  await assert.rejects(store.verify('../tokens.txt'),/Invalid/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
