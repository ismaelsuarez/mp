import * as crypto from 'crypto';

let keytar: any = null;
(async () => { try { keytar = await import('keytar'); } catch {} })();

function deriveKey(passphrase: string){
  return crypto.scryptSync(passphrase, 'payway-salt', 32);
}
export function encryptJSON(data: any, key: Buffer){
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(data),'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}
export function decryptJSON(b64: string, key: Buffer){
  const raw = Buffer.from(b64, 'base64');
  const iv = raw.subarray(0,12);
  const tag = raw.subarray(12,28);
  const enc = raw.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return JSON.parse(dec.toString('utf8'));
}

export async function saveSecretWithKeychain(service: string, account: string, value: string){
  if (!keytar) throw new Error('keytar not available');
  await keytar.default.setPassword(service, account, value);
}
export async function loadSecretWithKeychain(service: string, account: string){
  if (!keytar) throw new Error('keytar not available');
  return await keytar.default.getPassword(service, account);
}

export function makeLocalEncryptor(passphrase: string){
  const key = deriveKey(passphrase);
  return {
    encrypt: (obj: any) => encryptJSON(obj, key),
    decrypt: (b64: string) => decryptJSON(b64, key)
  };
}
