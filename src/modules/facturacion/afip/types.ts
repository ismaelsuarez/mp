/**
 * Tipados fuertes para respuestas del SDK @afipsdk/afip.js
 */

export interface AfipObservation {
  Code: number | string;
  Msg: string;
}

export interface AfipErrorItem {
  Code: number | string;
  Msg: string;
}

export interface AfipVoucherResponse {
  CAE: string;
  CAEFchVto: string; // YYYYMMDD
  Observaciones?: AfipObservation[] | null;
  Reproceso?: string | null;
  // En algunas versiones el SDK incluye campos adicionales
  // que no son relevantes para esta app. Los dejamos abiertos.
  [key: string]: unknown;
}

export type AfipLastVoucherResponse = number; // FECompUltimoAutorizado devuelve un número

export interface AfipVoucherType {
  Id: number | string;
  Desc: string;
}

export interface AfipServerStatus {
  appserver: string;
  dbserver: string;
  authserver: string;
}

/** Error normalizado proveniente del SDK (o axios) */
export interface AfipSdkError {
  code?: string | number;
  message: string;
  isAxiosError?: boolean;
  response?: unknown;
  request?: unknown;
  stack?: string;
}

/** Parámetros para validaciones FEParamGet* */
export interface ValidationParams {
  cbteTipo: number;
  concepto: number;
  docTipo: number;
  monId: string;
  ptoVta: number;
  cuit?: string;
}


/** Enumeraciones y constantes útiles (inspiradas en SDKs TS) */
export enum CbteTipo {
  FA_A = 1,
  ND_A = 2,
  NC_A = 3,
  FA_B = 6,
  ND_B = 7,
  NC_B = 8,
  FA_C = 11,
  ND_C = 12,
  NC_C = 13
}

export enum DocTipo {
  CUIT = 80,
  CUIL = 86,
  DNI = 96,
  CONSUMIDOR_FINAL = 99
}

export enum Concepto {
  PRODUCTOS = 1,
  SERVICIOS = 2,
  PROD_Y_SERV = 3
}

export enum Moneda {
  PES = 'PES',
  USD = 'DOL',
  EUR = 'EUR'
}

export enum AliquotaId {
  IVA_0 = 3,
  IVA_10_5 = 4,
  IVA_21 = 5,
  IVA_27 = 6,
  IVA_5 = 8,
  IVA_2_5 = 9
}

export const ClasePorTipo: Record<'A' | 'B' | 'C', number[]> = {
  A: [CbteTipo.FA_A, CbteTipo.ND_A, CbteTipo.NC_A],
  B: [CbteTipo.FA_B, CbteTipo.ND_B, CbteTipo.NC_B],
  C: [CbteTipo.FA_C, CbteTipo.ND_C, CbteTipo.NC_C]
};

export function inferirClasePorCbteTipo(cbteTipo: number): 'A' | 'B' | 'C' | 'DESCONOCIDA' {
  if (ClasePorTipo.A.includes(cbteTipo)) return 'A';
  if (ClasePorTipo.B.includes(cbteTipo)) return 'B';
  if (ClasePorTipo.C.includes(cbteTipo)) return 'C';
  return 'DESCONOCIDA';
}

