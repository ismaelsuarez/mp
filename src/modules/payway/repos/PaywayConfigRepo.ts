import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import Store from 'electron-store';
import { makeLocalEncryptor } from '../payway-stubs/src/lib/crypto/secretStore';

export type PaywayConfig = {
  branchId: string;
  cuitCuil: string;
  baseUrl: string;
  apikey: string;               // secreto
  defaultMerchantId: string;
  defaultTerminalId: string;
  defaultSerial: string;
  pollIntervalMs: number;
  pollMaxSeconds: number;
  settlementTime?: string;
  allowUnrefRefund: boolean;
};

function getEncryptionKey(): string | undefined {
  try {
    const dir = app.getPath('userData');
    const keyPath = path.join(dir, 'config.key');
    if (fs.existsSync(keyPath)) return fs.readFileSync(keyPath, 'utf8');
    const key = Buffer.from(`${process.pid}-${Date.now()}-${Math.random()}`).toString('hex');
    try { fs.writeFileSync(keyPath, key, { mode: 0o600 }); } catch {}
    return key;
  } catch { return undefined; }
}

type PaywayStore = {
  payway?: {
    configByBranch?: Record<string, Omit<PaywayConfig, 'apikey'|'defaultMerchantId'|'defaultTerminalId'|'defaultSerial'>>;
    secretsByBranch?: Record<string, string>; // base64 ciphertext
  }
};

export class PaywayConfigRepo {
  private passphrase: string;
  private store: Store<PaywayStore>;

  constructor(passphrase: string) {
    this.passphrase = passphrase || getEncryptionKey() || 'local-default-passphrase';
    this.store = new Store<PaywayStore>({ name: 'settings', encryptionKey: getEncryptionKey() });
  }

  private enc() {
    return makeLocalEncryptor(this.passphrase);
  }

  async upsert(cfg: PaywayConfig) {
    const current = this.store.get('payway') || {} as NonNullable<PaywayStore['payway']>;
    const configByBranch = current.configByBranch || {};
    const secretsByBranch = current.secretsByBranch || {};

    configByBranch[cfg.branchId] = {
      branchId: cfg.branchId,
      cuitCuil: cfg.cuitCuil,
      baseUrl: cfg.baseUrl,
      pollIntervalMs: cfg.pollIntervalMs,
      pollMaxSeconds: cfg.pollMaxSeconds,
      settlementTime: cfg.settlementTime,
      allowUnrefRefund: cfg.allowUnrefRefund,
    } as any;

    const { encrypt } = this.enc();
    const payload = encrypt({
      apikey: cfg.apikey,
      defaultMerchantId: cfg.defaultMerchantId,
      defaultTerminalId: cfg.defaultTerminalId,
      defaultSerial: cfg.defaultSerial,
    });
    secretsByBranch[cfg.branchId] = payload;

    this.store.set('payway', { configByBranch, secretsByBranch });
    return cfg;
  }

  async get(branchId: string): Promise<PaywayConfig | null> {
    const p = this.store.get('payway');
    const cfg = p?.configByBranch?.[branchId];
    const b64 = p?.secretsByBranch?.[branchId];
    if (!cfg || !b64) return null;
    const { decrypt } = this.enc();
    const data = decrypt(b64);
    return {
      branchId,
      cuitCuil: cfg.cuitCuil,
      baseUrl: cfg.baseUrl,
      apikey: data.apikey,
      defaultMerchantId: data.defaultMerchantId,
      defaultTerminalId: data.defaultTerminalId,
      defaultSerial: data.defaultSerial,
      pollIntervalMs: cfg.pollIntervalMs,
      pollMaxSeconds: cfg.pollMaxSeconds,
      settlementTime: cfg.settlementTime,
      allowUnrefRefund: cfg.allowUnrefRefund,
    } as PaywayConfig;
  }
}


