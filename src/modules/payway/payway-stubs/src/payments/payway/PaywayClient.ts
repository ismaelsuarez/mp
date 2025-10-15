import axios, { AxiosInstance } from 'axios';
import { PayRequest, PayResult, PaywayClient } from './PaywayTypes';

export interface PaystoreClientOptions {
  baseUrl: string;     // e.g. https://api-sandbox.prismamediosdepago.com/v1/paystore_terminals
  apikey: string;
  cuitCuil: string;
  timeoutMs?: number;
}

export function makePaystoreClient(opts: PaystoreClientOptions): PaywayClient {
  const http: AxiosInstance = axios.create({
    baseURL: opts.baseUrl,
    headers: { apikey: opts.apikey, 'Content-Type': 'application/json' },
    timeout: opts.timeoutMs ?? 15000
  });
  const params = { cuit_cuil: opts.cuitCuil };

  function normError(e: any): never {
    const status = e?.response?.status;
    const data = e?.response?.data;
    const msg = data?.message || data?.error || e.message;
    const code = data?.code || data?.errorCode || status;
    const err = new Error(`[Paystore] ${code || status}: ${msg}`);
    (err as any).code = code || status;
    (err as any).details = data;
    throw err;
  }

  return {
    async requestPayment(p: PayRequest) {
      try {
        const { data } = await http.post('/payments', p, { params });
        return data as PayResult;
      } catch (e) { normError(e); }
    },
    async getPaymentById(id: string) {
      try {
        const { data } = await http.get(`/payments/${id}`, { params });
        return data as PayResult;
      } catch (e) { normError(e); }
    },
    async cancelPayment(id: string, reason?: string) {
      try {
        await http.post(`/payments/${id}/cancellations`, { reason }, { params });
      } catch (e) { normError(e); }
    },
    async requestReversal(paymentId: string, reason: string) {
      try {
        const { data } = await http.post('/reversals', { payment_id: paymentId, reason }, { params });
        return data as { id: string };
      } catch (e) { normError(e); }
    },
    async getReversal(id: string) {
      try {
        const { data } = await http.get(`/reversals/${id}`, { params });
        return data;
      } catch (e) { normError(e); }
    },
    async requestRefundUnreferenced(arg: { amount: number; currency: 'ARS'; brand: string; reason: string; external_reference: string }) {
      try {
        const { data } = await http.post('/refunds', arg, { params });
        return data as { id: string };
      } catch (e) { normError(e); }
    },
    async requestSettlement(terminal_id: string, serial: string) {
      try {
        const { data } = await http.post('/settlements', { terminal_id, serial }, { params });
        return data as { id: string };
      } catch (e) { normError(e); }
    },
    async getSettlement(id: string) {
      try {
        const { data } = await http.get(`/settlements/${id}`, { params });
        return data;
      } catch (e) { normError(e); }
    },
  };
}
