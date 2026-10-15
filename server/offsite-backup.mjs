import {S3Client,PutObjectCommand,GetObjectCommand,HeadObjectCommand} from '@aws-sdk/client-s3';
import {encryptBackup,decryptBackup} from './encrypted-backup.mjs';
export function createOffsiteBackup(config){
 const {endpoint,region,bucket,accessKeyId,secretAccessKey,encryptionKey}=config;
 if(!endpoint||!bucket||!accessKeyId||!secretAccessKey||!encryptionKey)return null;
 const client=new S3Client({endpoint,region:region||'auto',forcePathStyle:config.urlStyle==='path',credentials:{accessKeyId,secretAccessKey}});
 async function save(snapshot){
  const encrypted=encryptBackup(snapshot,encryptionKey);
  const key='rainy/'+new Date().toISOString().slice(0,10)+'/'+Date.now()+'-'+encrypted.sha256.slice(0,16)+'.json.gcm';
  await client.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:JSON.stringify(encrypted),ContentType:'application/vnd.rainy.encrypted+json'}));
  return {key,sha256:encrypted.sha256,encrypted:true};
 }
 async function restoreDrill(key){
  if(typeof key!=='string'||!/^rainy\/\d{4}-\d{2}-\d{2}\/\d+-[a-f0-9]{16}\.json\.gcm$/.test(key))throw Error('Invalid offsite backup key');
  const response=await client.send(new GetObjectCommand({Bucket:bucket,Key:key}));
  const raw=await response.Body.transformToString();
  // Validate decryption, checksum and basic schema without touching live records.
  const result=decryptBackup(JSON.parse(raw),encryptionKey);
  if(!result||typeof result!=='object'||!result.default||!Array.isArray(result.branches))throw Error('Backup restore drill schema invalid');
  return {verified:true,branches:result.branches.length,sha256:JSON.parse(raw).sha256};
 }
 return {save,restoreDrill};
}
