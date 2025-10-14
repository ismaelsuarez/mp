import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';

type DpapiModule = {
  protectData: (data: Buffer, entropy?: Buffer | null, options?: { scope?: 'CurrentUser' | 'LocalMachine' }) => Buffer;
  unprotectData: (cipher: Buffer, entropy?: Buffer | null, options?: { scope?: 'CurrentUser' | 'LocalMachine' }) => Buffer;
};

function loadDpapi(): DpapiModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('node-dpapi');
  } catch {
    return null;
  }
}

function ensureDir(p: string) {
  try { fs.mkdirSync(p, { recursive: true }); } catch {}
}

export class SecureStore {
  private storeDir: string;
  private storePath: string;
  private dpapi: DpapiModule | null;

  constructor() {
    const base = app.getPath('userData');
    this.storeDir = path.join(base, 'secure');
    ensureDir(this.storeDir);
    this.storePath = path.join(this.storeDir, 'secure-store.json');
    this.dpapi = loadDpapi();
    if (!fs.existsSync(this.storePath)) {
      try { fs.writeFileSync(this.storePath, JSON.stringify({}), 'utf8'); } catch {}
    }
  }

  private readStore(): Record<string, string> {
    try {
      const raw = fs.readFileSync(this.storePath, 'utf8');
      return JSON.parse(raw || '{}');
    } catch { return {}; }
  }

  private writeStore(obj: Record<string, string>) {
    try { fs.writeFileSync(this.storePath, JSON.stringify(obj, null, 2), 'utf8'); } catch {}
  }

  private encrypt(data: Buffer): string {
    if (this.dpapi) {
      const out = this.dpapi.protectData(data, null, { scope: 'CurrentUser' });
      return out.toString('base64');
    }
    // Fallback: cifrado simétrico derivado de usuario + equipo (menos seguro que DPAPI)
    const keySeed = `${os.hostname()}|${process.env.USERNAME || process.env.USER || 'user'}`;
    const key = crypto.createHash('sha256').update(keySeed).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  private decrypt(b64: string): Buffer {
    const buf = Buffer.from(b64, 'base64');
    if (this.dpapi) {
      return this.dpapi.unprotectData(buf, null, { scope: 'CurrentUser' });
    }
    const keySeed = `${os.hostname()}|${process.env.USERNAME || process.env.USER || 'user'}`;
    const key = crypto.createHash('sha256').update(keySeed).digest();
    const iv = buf.subarray(0, 16);
    const tag = buf.subarray(16, 32);
    const enc = buf.subarray(32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec;
  }

  saveBinary(key: string, data: Buffer): void {
    const store = this.readStore();
    store[key] = this.encrypt(data);
    this.writeStore(store);
  }

  getBinary(key: string): Buffer | null {
    const store = this.readStore();
    const b64 = store[key];
    if (!b64) return null;
    try { return this.decrypt(b64); } catch { return null; }
  }

  importCertKey(certPath: string, keyPath: string): void {
    const cert = fs.readFileSync(certPath);
    const priv = fs.readFileSync(keyPath);
    this.saveBinary('afip.cert', cert);
    this.saveBinary('afip.key', priv);
  }

  /**
   * Crea archivos temporales con contenido del cert/key cifrados y retorna rutas y cleanup.
   */
  writeTempFilesForAfip(): { certPath: string; keyPath: string; cleanup: () => void } {
    const cert = this.getBinary('afip.cert');
    const priv = this.getBinary('afip.key');
    if (!cert || !priv) throw new Error('Certificado/clave seguros no encontrados');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'afip-tmp-'));
    const certPath = path.join(tmpDir, `cert-${Date.now()}.pem`);
    const keyPath = path.join(tmpDir, `key-${Date.now()}.pem`);
    fs.writeFileSync(certPath, cert, { mode: 0o600 });
    fs.writeFileSync(keyPath, priv, { mode: 0o600 });
    const cleanup = () => {
      try { fs.unlinkSync(certPath); } catch {}
      try { fs.unlinkSync(keyPath); } catch {}
      try { fs.rmdirSync(tmpDir); } catch {}
    };
    return { certPath, keyPath, cleanup };
  }
}

let singleton: SecureStore | null = null;
export function getSecureStore(): SecureStore {
  if (!singleton) singleton = new SecureStore();
  return singleton;
}


