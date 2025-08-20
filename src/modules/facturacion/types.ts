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
}

export type TipoComprobante = 'FA' | 'FB' | 'NC' | 'RECIBO';

export interface Totales {
  neto: number;
  iva: number;
  total: number;
}

export interface Comprobante {
  tipo: TipoComprobante;
  puntoVenta: number;
  numero: number;
  fecha: string; // YYYYMMDD
  condicionVenta?: string; // contado/cta cte/…
  items: Item[];
  totales: Totales;
}

export interface DatosAFIP {
  cae: string;
  vencimientoCAE: string; // YYYYMMDD
  qrData: string; // URL QR AFIP completa
}

export interface FacturaData {
  emisor: Emisor;
  receptor: Receptor;
  comprobante: Comprobante;
  afip?: DatosAFIP;
}


