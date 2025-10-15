import { makePaystoreClient } from './PaywayClient';
import { PayRequest, PayResult } from './PaywayTypes';

export interface PaywayServiceOptions {
  baseUrl: string;
  apikey: string;
  cuitCuil: string;
  pollIntervalMs?: number;
  pollMaxSeconds?: number;
  defaultMerchantId: string;
  defaultTerminalId: string;
  defaultSerial: string;
}

export class PaywayService {
  private client = makePaystoreClient({
    baseUrl: this.opts.baseUrl,
    apikey: this.opts.apikey,
    cuitCuil: this.opts.cuitCuil
  });
  private pollIntervalMs: number;
  private pollMaxSeconds: number;

  constructor(private opts: PaywayServiceOptions){
    this.pollIntervalMs = opts.pollIntervalMs ?? 1500;
    this.pollMaxSeconds = opts.pollMaxSeconds ?? 120;
  }

  async requestAndWait(p: Omit<PayRequest,'merchant_id'|'terminal_id'|'serial'|'print_method'> & Partial<Pick<PayRequest,'merchant_id'|'terminal_id'|'serial'|'print_method'>>) : Promise<PayResult> {
    const payload: PayRequest = {
      merchant_id: p.merchant_id ?? this.opts.defaultMerchantId,
      terminal_id: p.terminal_id ?? this.opts.defaultTerminalId,
      serial: p.serial ?? this.opts.defaultSerial,
      amount: p.amount,
      currency: 'ARS',
      installments: p.installments,
      brand: p.brand,
      plan: p.plan,
      external_reference: p.external_reference,
      print_method: 'MOBITEF_NON_FISCAL',
    };
    const created = await this.client.requestPayment(payload);
    const id = (created as any)?.id ?? (created as any)?.paymentId ?? created?.id;
    if (!id) throw new Error('No se recibió ID de pago');

    let elapsed = 0;
    while (elapsed < this.pollMaxSeconds * 1000) {
      await new Promise(r => setTimeout(r, this.pollIntervalMs));
      elapsed += this.pollIntervalMs;
      const st = await this.client.getPaymentById(id);
      if (st.status === 'APPROVED' || st.status === 'DECLINED' || st.status === 'ERROR') {
        return { ...st, id };
      }
    }
    try { await this.client.cancelPayment(id, 'timeout'); } catch {}
    throw new Error('Timeout esperando resultado del POS');
  }

  async reversal(paymentId: string, reason = 'invoice_failed'){
    return this.client.requestReversal(paymentId, reason);
  }

  async settlementNow(terminal_id?: string, serial?: string){
    return this.client.requestSettlement(terminal_id ?? this.opts.defaultTerminalId, serial ?? this.opts.defaultSerial);
  }
}
