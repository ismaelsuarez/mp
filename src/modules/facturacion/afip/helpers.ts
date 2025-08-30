import { TipoComprobante, Comprobante } from '../types';
import dayjs from 'dayjs';

export class AfipHelpers {
  /**
   * Mapea el tipo de comprobante interno al código AFIP
   */
  static mapTipoCbte(tipo: TipoComprobante): number {
    switch (tipo) {
      case 'A': return 1;            // Factura A
      case 'B': return 6;            // Factura B
      case 'C': return 11;           // Factura C
      case 'FA': return 1;           // Alias Factura A
      case 'FB': return 6;           // Alias Factura B
      case 'RECIBO': return 4;       // Recibo A (ajustar según uso requerido)
      case 'NC': return 13;          // Nota de Crédito C por defecto
      default: return 11;            // Por defecto, usar C
    }
  }

  /**
   * Mapea (clase=A/B/C, tipo base=FACTURA/NC/ND) al código AFIP exacto
   */
  static mapCbteByClass(kind: 'FACT'|'NC'|'ND', clase: 'A'|'B'|'C'): number {
    if (kind === 'FACT') {
      return clase === 'A' ? 1 : (clase === 'B' ? 6 : 11);
    }
    if (kind === 'NC') {
      return clase === 'A' ? 3 : (clase === 'B' ? 8 : 13);
    }
    // ND
    return clase === 'A' ? 2 : (clase === 'B' ? 7 : 12);
  }

  /**
   * Mapea el porcentaje de IVA al ID de alícuota AFIP
   */
  static mapIvaId(porcentaje: number): number {
    switch (porcentaje) {
      case 10.5: return 4; // IVA 10.5%
      case 21: return 5;   // IVA 21%
      case 27: return 6;   // IVA 27%
      default: return 5;   // Por defecto IVA 21%
    }
  }

  /**
   * Construye el array de IVA para AFIP agrupando por alícuota
   */
  static buildIvaArray(items: Comprobante['items']): any[] {
    const ivaArray: any[] = [];
    const bases = new Map<number, number>();

    // Sumar bases por alícuota
    for (const item of items) {
      const base = item.cantidad * item.precioUnitario;
      bases.set(item.iva, (bases.get(item.iva) || 0) + base);
    }

    // Construir array de IVA para AFIP
    for (const [alic, base] of bases) {
      ivaArray.push({
        Id: this.mapIvaId(alic),
        BaseImp: base,
        Importe: (base * alic) / 100
      });
    }

    return ivaArray;
  }

  /**
   * Construye la URL del QR para AFIP
   */
  static buildQrUrl(data: {
    cuit: number;
    ptoVta: number;
    tipoCmp: number;
    nroCmp: number;
    importe: number;
    fecha: string;
    cae: string;
  }): string {
    const qrData = {
      ver: 1,
      fecha: dayjs(data.fecha, 'YYYYMMDD').format('YYYY-MM-DD'),
      cuit: data.cuit,
      ptoVta: data.ptoVta,
      tipoCmp: data.tipoCmp,
      nroCmp: data.nroCmp,
      importe: Number(data.importe.toFixed(2)),
      moneda: 'PES',
      ctz: 1,
      tipoDocRec: 99,
      nroDocRec: 0,
      tipoCodAut: 'E',
      codAut: Number(data.cae)
    };

    const base = 'https://www.afip.gob.ar/fe/qr/?p=';
    const payload = Buffer.from(JSON.stringify(qrData)).toString('base64');
    return base + payload;
  }

  /**
   * Valida que los datos del comprobante sean correctos
   */
  static validateComprobante(comprobante: Comprobante): string[] {
    const errors: string[] = [];

    if (!comprobante.fecha || comprobante.fecha.length !== 8) {
      errors.push('Fecha debe estar en formato YYYYMMDD');
    }

    if (comprobante.puntoVenta <= 0) {
      errors.push('Punto de venta debe ser mayor a 0');
    }

    if (comprobante.numero <= 0) {
      errors.push('Número de comprobante debe ser mayor a 0');
    }

    if (!comprobante.items || comprobante.items.length === 0) {
      errors.push('El comprobante debe tener al menos un item');
    }

    if (comprobante.totales.total <= 0) {
      errors.push('El total debe ser mayor a 0');
    }

    return errors;
  }

  /**
   * Formatea un número para AFIP (sin decimales)
   */
  static formatNumber(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
