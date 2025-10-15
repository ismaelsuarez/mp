export type SplitPolicy = 'ALL_OR_NOTHING' | 'PARCIAL_PERMITIDO';
export type PayStatus = 'REQUESTED' | 'PROCESSING' | 'APPROVED' | 'DECLINED' | 'CANCELED' | 'UNDONE' | 'REFUNDED' | 'ERROR';

export interface PayRequest {
  merchant_id: string;
  terminal_id: string;
  serial: string;
  amount: number;            // in cents
  currency: 'ARS';
  installments?: number;
  brand?: string;            // 'VISA' | 'MASTERCARD' | 'AMEX' | 'DEBIT' | etc.
  plan?: string;             // 'NACIONAL' | ...
  external_reference: string;
  print_method: 'MOBITEF_NON_FISCAL';
}

export interface PayResult {
  id: string;
  status: PayStatus;
  auth_code?: string;
  ticket_number?: string;
  last4?: string;
  error_code?: string;
  error_message?: string;
}

export interface PaywayClient {
  requestPayment(p: PayRequest): Promise<PayResult>;
  getPaymentById(id: string): Promise<PayResult>;
  cancelPayment(id: string, reason?: string): Promise<void>;
  requestReversal(paymentId: string, reason: string): Promise<{ id: string }>;
  getReversal(id: string): Promise<any>;
  requestRefundUnreferenced(params: { amount: number; currency: 'ARS'; brand: string; reason: string; external_reference: string }): Promise<{ id: string }>;
  requestSettlement(terminal_id: string, serial: string): Promise<{ id: string }>;
  getSettlement(id: string): Promise<any>;
}
