export type CondicionIva = 'RI' | 'MT' | 'EX' | 'CF';

export interface Emisor {
  razonSocial: string;
  cuit: string;
  domicilio?: string;
  condicionIVA?: CondicionIva;
  logoPath?: string;
}

export interface Receptor {
  nombre: string;
  documento?: string; // CUIT/DNI
  condicionIVA?: CondicionIva;
  domicilio?: string;
}

export interface Item {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  iva: number; // porcentaje (10.5, 21, 27)
  alicuotaIva: number; // alias para iva
}

export type TipoComprobante = 'A' | 'B' | 'C' | 'E' | 'FA' | 'FB' | 'NC' | 'RECIBO';

export interface Empresa {
  cuit: string;
  razonSocial: string;
  domicilio: string;
  condicionIva: CondicionIva;
  logoPath?: string;
}

export interface Cliente {
  cuit?: string;
  razonSocial: string;
  condicionIva: CondicionIva;
  domicilio?: string;
}

export interface Totales {
  neto: number;
  iva: number;
  total: number;
}

export interface Comprobante {
  tipo: TipoComprobante;
  cbteTipo?: number; // Código AFIP numérico (1,2,3,6,7,8,11,12,13)
  puntoVenta: number;
  numero?: number;
  fecha: string; // YYYYMMDD
  empresa: Empresa;
  cliente?: Cliente;
  condicionVenta?: string; // contado/cta cte/…
  items: Item[];
  totales: Totales;
  observaciones?: string;
  codigoOperacion?: string;
  // Nuevos campos para configuración AFIP
  concepto?: number; // 1=Productos, 2=Servicios, 3=Productos y Servicios
  docTipo?: number; // 80=CUIT, 86=CUIL, 96=DNI, 99=Consumidor Final
  monId?: string; // PES, DOL, EUR
  // Servicios (obligatorio si concepto 2 o 3)
  FchServDesde?: string; // YYYYMMDD
  FchServHasta?: string; // YYYYMMDD
  FchVtoPago?: string;   // YYYYMMDD
  // Comprobantes asociados (NC/ND)
  comprobantesAsociados?: Array<{ Tipo: number; PtoVta: number; Nro: number }>;
}

export interface DatosAFIP {
  cae: string;
  vencimientoCAE: string; // YYYYMMDD
  qrData: string; // URL QR AFIP completa
  observaciones?: any[];
}

export interface FacturaData {
  emisor: Emisor;
  receptor: Receptor;
  comprobante: Comprobante;
  afip?: DatosAFIP;
}

// Nuevos tipos para AFIP
export interface ServerStatus {
  appserver: string;
  dbserver: string;
  authserver: string;
}

export interface CertificadoInfo {
  valido: boolean;
  fechaExpiracion: Date;
  diasRestantes: number;
  error?: string;
}

export interface AfipLogEntry {
  timestamp: string;
  operation: string;
  request?: any;
  response?: any;
  error?: string;
  stack?: string;
}


