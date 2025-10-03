/**
 * Helper para consultar cotización AFIP/ARCA desde el renderer o IPC
 * Puede ser llamado desde la UI antes de generar un .fac
 */

import { AfipService } from './afipService';

export interface CotizacionOptions {
  moneda: 'DOL' | 'EUR';
  fecha?: string; // YYYYMMDD - Fecha del comprobante (opcional, default: HOY)
  canMisMonExt?: 'S' | 'N'; // S = cancela en misma moneda (usar día hábil anterior)
}

export interface CotizacionResult {
  moneda: string;
  cotizOficial: number;
  fechaCotiz: string; // YYYYMMDD
  fechaSolicitada?: string;
  canMisMonExt: 'S' | 'N';
  diaHabilAnterior?: string;
  rangoTolerado: {
    min: number;
    max: number;
    minPercent: number;
    maxPercent: number;
  };
  recomendacion: string;
  paraFac: {
    linea: string; // "COTIZADOL:1400.00"
    cancelaMismaMoneda?: string; // "CANCELA_MISMA_MONEDA:S" si aplica
  };
}

/**
 * Calcula el día hábil anterior (excluyendo sábados y domingos)
 */
function prevDiaHabil(yyyymmdd: string): string {
  const y = Number(yyyymmdd.slice(0, 4));
  const m = Number(yyyymmdd.slice(4, 6)) - 1;
  const d = Number(yyyymmdd.slice(6, 8));
  const dt = new Date(Date.UTC(y, m, d));
  
  do {
    dt.setUTCDate(dt.getUTCDate() - 1);
  } while (dt.getUTCDay() === 0 || dt.getUTCDay() === 6);
  
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}${mm}${dd}`;
}

/**
 * Consulta la cotización oficial de AFIP/ARCA
 * 
 * @example
 * // Cliente que cancela en pesos (usa cotización del día)
 * const cotiz = await consultarCotizacionAfip({ moneda: 'DOL' });
 * console.log(cotiz.paraFac.linea); // "COTIZADOL:1345.50"
 * 
 * @example
 * // Cliente que cancela en dólares (usa cotización del día hábil anterior)
 * const cotiz = await consultarCotizacionAfip({ 
 *   moneda: 'DOL', 
 *   fecha: '20251002', 
 *   canMisMonExt: 'S' 
 * });
 * console.log(cotiz.paraFac.linea); // "COTIZADOL:1340.00"
 * console.log(cotiz.paraFac.cancelaMismaMoneda); // "CANCELA_MISMA_MONEDA:S"
 */
export async function consultarCotizacionAfip(
  options: CotizacionOptions
): Promise<CotizacionResult> {
  const { moneda, fecha, canMisMonExt = 'N' } = options;

  // Determinar qué fecha usar para la consulta
  let fechaCotizAConsultar: string | undefined;
  let diaHabilAnterior: string | undefined;

  if (canMisMonExt === 'S' && fecha) {
    // Si cancela en misma moneda: OBLIGATORIO usar día hábil anterior
    diaHabilAnterior = prevDiaHabil(fecha);
    fechaCotizAConsultar = diaHabilAnterior;
  }
  // Si NO cancela en misma moneda o no hay fecha: usar cotización de HOY

  const afipService = new AfipService();
  const afip = await (afipService as any).getAfipInstance();
  
  let valor: number;
  let fechaResp: string;
  
  try {
    const svc = afip?.ElectronicBilling;
    if (!svc) throw new Error('ElectronicBilling no disponible');
    
    let result: any;
    
    if (typeof svc.getCurrencyCotization === 'function') {
      result = fechaCotizAConsultar 
        ? await svc.getCurrencyCotization(moneda, fechaCotizAConsultar)
        : await svc.getCurrencyCotization(moneda);
    } else if (typeof svc.getCurrencyQuotation === 'function') {
      result = fechaCotizAConsultar
        ? await svc.getCurrencyQuotation(moneda, fechaCotizAConsultar)
        : await svc.getCurrencyQuotation(moneda);
    } else if (typeof svc.getParamGetCotizacion === 'function') {
      const args: any = { MonId: moneda };
      if (fechaCotizAConsultar) args.FchCotiz = fechaCotizAConsultar;
      result = await svc.getParamGetCotizacion(args);
    } else {
      throw new Error('Ningún método de cotización disponible en SDK');
    }
    
    valor = Number((result && (result.MonCotiz ?? result?.ResultGet?.MonCotiz)) || 0);
    fechaResp = String((result && (result.FchCotiz ?? result?.ResultGet?.FchCotiz)) || '');
    
    if (!Number.isFinite(valor) || valor <= 1) {
      throw new Error(`Cotización inválida: ${valor}`);
    }
  } catch (error: any) {
    throw new Error(`No se pudo obtener cotización de AFIP: ${error.message}`);
  }

  // Calcular rango tolerado (política del sistema)
  // Según líneas 523-531 de afipService.ts
  const maxUpPercent = 80; // +80% por arriba
  const maxDownPercent = 5; // -5% por debajo

  const upper = Number((valor * (1 + maxUpPercent / 100)).toFixed(6));
  const lower = Number((valor * (1 - maxDownPercent / 100)).toFixed(6));

  // Recomendación para el .fac
  let recomendacion: string;
  if (canMisMonExt === 'S') {
    recomendacion = `Debe usar EXACTAMENTE ${valor.toFixed(2)} (cotización del día hábil anterior ${diaHabilAnterior}). AFIP NO tolera desviaciones.`;
  } else {
    recomendacion = `Puede usar entre ${lower.toFixed(2)} y ${upper.toFixed(2)} (tolerancia: -5% / +80% sobre ${valor.toFixed(2)}). Se recomienda usar la oficial.`;
  }

  return {
    moneda,
    cotizOficial: valor,
    fechaCotiz: fechaResp || 'HOY',
    fechaSolicitada: fecha,
    canMisMonExt,
    diaHabilAnterior,
    rangoTolerado: {
      min: lower,
      max: upper,
      minPercent: -maxDownPercent,
      maxPercent: maxUpPercent,
    },
    recomendacion,
    paraFac: {
      linea: `COTIZADOL:${valor.toFixed(2)}`,
      cancelaMismaMoneda: canMisMonExt === 'S' ? 'CANCELA_MISMA_MONEDA:S' : undefined,
    },
  };
}

/**
 * Valida si una cotización custom está dentro del rango tolerado por AFIP
 */
export function validarCotizacion(
  cotizCustom: number,
  cotizOficial: number,
  canMisMonExt: 'S' | 'N'
): { valida: boolean; razon?: string } {
  if (canMisMonExt === 'S') {
    // Modo EXACT: debe ser exactamente la oficial
    if (Math.abs(cotizCustom - cotizOficial) > 0.000001) {
      return {
        valida: false,
        razon: `Para CANCELA_MISMA_MONEDA:S debe usar exactamente ${cotizOficial}. Valor ingresado: ${cotizCustom}`,
      };
    }
  } else {
    // Modo TOLERANT: debe estar en rango ±80%/-5%
    const upper = cotizOficial * 1.8;
    const lower = cotizOficial * 0.95;
    if (cotizCustom < lower || cotizCustom > upper) {
      return {
        valida: false,
        razon: `Cotización ${cotizCustom} fuera del rango tolerado [${lower.toFixed(2)}, ${upper.toFixed(2)}]`,
      };
    }
  }

  return { valida: true };
}

