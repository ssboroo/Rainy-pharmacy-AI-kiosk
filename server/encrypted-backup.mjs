import {randomBytes,createCipheriv,createDecipheriv,createHash} from 'node:crypto';
export function encryptBackup(payload,key){
 const secret=Buffer.from(key||'','base64');
 if(secret.length!==32)throw Error('BACKUP_ENCRYPTION_KEY must be a 32-byte base64 key');
 const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',secret,iv);
 const plain=Buffer.from(JSON.stringify(payload));
 const ciphertext=Buffer.concat([cipher.update(plain),cipher.final()]);
 return {format:'rainy-aes-256-gcm-v1',nonce:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),
  ciphertext:ciphertext.toString('base64'),sha256:createHash('sha256').update(plain).digest('hex')};
}
export function decryptBackup(envelope,key){
 if(envelope?.format!=='rainy-aes-256-gcm-v1')throw Error('Unsupported backup format');
 const secret=Buffer.from(key||'','base64');
 if(secret.length!==32)throw Error('Invalid backup key');
 const decipher=createDecipheriv('aes-256-gcm',secret,Buffer.from(envelope.nonce,'base64'));
 decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
 const plain=Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,'base64')),decipher.final()]);
 if(createHash('sha256').update(plain).digest('hex')!==envelope.sha256)throw Error('Backup digest mismatch');
 return JSON.parse(plain.toString('utf8'));
}
