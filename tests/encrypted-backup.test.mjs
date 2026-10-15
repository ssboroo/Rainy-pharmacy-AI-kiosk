import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {encryptBackup,decryptBackup} from '../server/encrypted-backup.mjs';
test('AES-256-GCM backup decrypt/restore drill and rejects wrong key/tampering',()=>{
 const key=randomBytes(32).toString('base64'),wrong=randomBytes(32).toString('base64');
 const payload={version:1,branches:[{name:'Эмийн сан',catalog:[{name:'Эм'}]}]};
 const envelope=encryptBackup(payload,key);
 assert.equal(envelope.format,'rainy-aes-256-gcm-v1');
 assert.equal(JSON.stringify(envelope).includes('Эмийн сан'),false);
 assert.deepEqual(decryptBackup(envelope,key),payload);
 assert.throws(()=>decryptBackup(envelope,wrong));
 assert.throws(()=>decryptBackup({...envelope,tag:'AAAA'},key));
 assert.throws(()=>encryptBackup(payload,'not-a-key'));
});
