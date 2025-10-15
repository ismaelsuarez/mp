export type PaywayConfig = {
  branchId: string;
  cuitCuil: string;
  baseUrl: string;
  apikey: string;
  defaultMerchantId: string;
  defaultTerminalId: string;
  defaultSerial: string;
  pollIntervalMs: number;
  pollMaxSeconds: number;
  settlementTime?: string;
  allowUnrefRefund: boolean;
};

export class PaymentConfigRepo {
  private store = new Map<string, PaywayConfig>();
  async upsert(cfg: PaywayConfig){ this.store.set(cfg.branchId, cfg); return cfg; }
  async get(branchId: string){ return this.store.get(branchId) || null; }
}
