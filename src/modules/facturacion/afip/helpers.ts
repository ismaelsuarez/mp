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
   * Mapea un CbteTipo WSFE estándar al correspondiente MiPyME (FCE)
   * 1->201, 2->202, 3->203, 6->206, 7->207, 8->208, 11->211, 12->212, 13->213
   */
  static mapToMiPymeCbte(cbteTipo: number): number {
    const map: Record<number, number> = {
      1: 201, 2: 202, 3: 203, 6: 206, 7: 207, 8: 208, 11: 211, 12: 212, 13: 213
    };
    return map[cbteTipo] ?? cbteTipo;
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
   * Consolida los totales por alícuota para WSFEv1 (FECAESolicitar)
   * Retorna solo montos consolidados y el array Iva[] por alícuota.
   */
  static consolidateTotals(items: Comprobante['items']): {
    ImpTotConc: number;
    ImpOpEx: number;
    ImpTrib: number;
    ImpNeto: number;
    ImpIVA: number;
    ImpTotal: number;
    Iva: Array<{ Id: number; BaseImp: number; Importe: number }>;
  } {
    const netoPorAli: Map<number, number> = new Map();
    const ivaPorAli: Map<number, number> = new Map();

    let impOpEx = 0; // Operaciones exentas (alícuota 0)

    for (const item of items || []) {
      const base = (item.cantidad || 0) * (item.precioUnitario || 0);
      const ali = Number(item.iva || 0);
      if (ali === 0) { impOpEx += base; continue; }
      const impIva = (base * ali) / 100;
      netoPorAli.set(ali, (netoPorAli.get(ali) || 0) + base);
      ivaPorAli.set(ali, (ivaPorAli.get(ali) || 0) + impIva);
    }

    const ImpNeto = Array.from(netoPorAli.values()).reduce((a, b) => a + b, 0);
    const ImpIVA = Array.from(ivaPorAli.values()).reduce((a, b) => a + b, 0);
    const ImpTotConc = 0;
    const ImpTrib = 0;
    const ImpOpEx = impOpEx;
    const ImpTotal = ImpNeto + ImpIVA + ImpTotConc + ImpTrib + ImpOpEx;

    const Iva: Array<{ Id: number; BaseImp: number; Importe: number }> = [];
    for (const [ali, base] of netoPorAli.entries()) {
      const importe = ivaPorAli.get(ali) || 0;
      Iva.push({ Id: this.mapIvaId(ali), BaseImp: this.formatNumber(base), Importe: this.formatNumber(importe) });
    }

    return {
      ImpTotConc: this.formatNumber(ImpTotConc),
      ImpOpEx: this.formatNumber(ImpOpEx),
      ImpTrib: this.formatNumber(ImpTrib),
      ImpNeto: this.formatNumber(ImpNeto),
      ImpIVA: this.formatNumber(ImpIVA),
      ImpTotal: this.formatNumber(ImpTotal),
      Iva
    };
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

  /**
   * Mapea condición IVA del receptor (UI) al código ARCA (IVARECEPTOR)
   * Referencia (manual ARCA COMPG):
   * 1: IVA Responsable Inscripto
   * 6: Responsable Monotributo
   * 13: Monotributista Social
   * 16: Monotributo Trabajador Independiente Promovido
   * 4: IVA Sujeto Exento
   * 7: Sujeto No Categorizado
   * 8: Proveedor del Exterior
   * 9: Cliente del Exterior
   * 10: IVA Liberado – Ley N° 19.640
   * 15: IVA No Alcanzado
   * 5: Consumidor Final
   */
  static mapCondicionIvaReceptorToArcaCode(cond?: string): number | undefined {
    const v = String(cond || '').trim().toUpperCase();
    switch (v) {
      case 'RI':
      case 'RESPONSABLE INSCRIPTO':
        return 1;
      case 'MT':
      case 'MONOTRIBUTO':
        return 6;
      case 'MONOTRIBUTO SOCIAL':
      case 'MONOTRIBUTISTA SOCIAL':
        return 13;
      case 'MONOTRIBUTO TRABAJADOR INDEPENDIENTE PROMOVIDO':
        return 16;
      case 'EX':
      case 'EXENTO':
        return 4;
      case 'SNC':
      case 'SUJETO NO CATEGORIZADO':
        return 7;
      case 'PROVEEDOR EXTERIOR':
      case 'PROVEEDOR DEL EXTERIOR':
        return 8;
      case 'CLIENTE EXTERIOR':
      case 'CLIENTE DEL EXTERIOR':
        return 9;
      case 'LIBERADO 19640':
      case 'IVA LIBERADO – LEY N° 19.640':
        return 10;
      case 'NO ALCANZADO':
      case 'IVA NO ALCANZADO':
        return 15;
      case 'CF':
      case 'CONSUMIDOR FINAL':
        return 5;
      default:
        return undefined;
    }
  }
}

/**
 * Devuelve AAAAMM01 a partir de AAAAMMDD
 */
export function monthStartFromYYYYMMDD(yyyymmdd: string): string {
  try {
    const s = String(yyyymmdd || '').trim();
    if (/^\d{8}$/.test(s)) return s.slice(0, 6) + '01';
    // fallback simple si no cumple el patrón
    return (s || '').slice(0, 6) + '01';
  } catch {
    return '';
  }
}