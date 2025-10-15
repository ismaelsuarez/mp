import { PaywayService } from './payway-stubs/src/payments/payway/PaywayService';
import { PaywayConfigRepo } from './repos/PaywayConfigRepo';

let repoSingleton: PaywayConfigRepo | null = null;

export function initPaywayRepo(passphrase: string) {
  repoSingleton = new PaywayConfigRepo(passphrase);
}

export async function makePaywayService(branchId: string) {
  if (!repoSingleton) throw new Error('initPaywayRepo(passphrase) must be called first');
  const cfg = await repoSingleton.get(branchId);
  if (!cfg) throw new Error(`Config Payway no encontrada para la sucursal ${branchId}`);
  return new PaywayService({
    baseUrl: cfg.baseUrl,
    apikey: cfg.apikey,
    cuitCuil: cfg.cuitCuil,
    pollIntervalMs: cfg.pollIntervalMs,
    pollMaxSeconds: cfg.pollMaxSeconds,
    defaultMerchantId: cfg.defaultMerchantId,
    defaultTerminalId: cfg.defaultTerminalId,
    defaultSerial: cfg.defaultSerial,
  });
}


