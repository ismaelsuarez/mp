/**
 * @package @core/afip/calculators
 * @description Calculadoras de totales e IVA para AFIP
 * 
 * Funciones puras para cálculo de totales consolidados,
 * arrays de IVA y bases imponibles por alícuota.
 */

import { Item } from '@shared/types/facturacion';
import { AliquotaId } from '@shared/types/afip';

/**
 * Resultado de consolidación de totales AFIP
 */
export interface ConsolidatedTotals {
  ImpTotConc: number;    // Importe total de conceptos no gravados
  ImpOpEx: number;       // Importe de operaciones exentas
  ImpTrib: number;       // Importe de tributos/percepciones
  ImpNeto: number;       // Importe neto gravado
  ImpIVA: number;        // Importe total de IVA
  ImpTotal: number;      // Importe total del comprobante
  Iva: Array<{           // Array de IVA por alícuota
    Id: number;          // ID de alícuota AFIP
    BaseImp: number;     // Base imponible
    Importe: number;     // Importe de IVA
  }>;
}

/**
 * Mapea alícuota porcentual a ID de AFIP
 * 
 * @param alic - Alícuota en porcentaje (0, 2.5, 5, 10.5, 21, 27)
 * @returns ID de alícuota AFIP
 */
export function mapIvaIdFromPercentage(alic: number): number {
  if (alic === 0) return AliquotaId.IVA_0;
  if (alic === 2.5) return AliquotaId.IVA_2_5;
  if (alic === 5) return AliquotaId.IVA_5;
  if (alic === 10.5) return AliquotaId.IVA_10_5;
  if (alic === 21) return AliquotaId.IVA_21;
  if (alic === 27) return AliquotaId.IVA_27;
  return AliquotaId.IVA_21; // Default
}

/**
 * Mapea un código de comprobante WSFE estándar al correspondiente MiPyME (FCE)
 * 
 * Mapeo completo:
 * - 1 (FA A) → 201 (FCE A)
 * - 2 (ND A) → 202
 * - 3 (NC A) → 203
 * - 6 (FA B) → 206 (FCE B)
 * - 7 (ND B) → 207
 * - 8 (NC B) → 208
 * - 11 (FA C) → 211 (FCE C)
 * - 12 (ND C) → 212
 * - 13 (NC C) → 213
 * 
 * @param cbteTipo - Código de comprobante WSFE estándar
 * @returns Código de comprobante MiPyME (FCE), o el mismo si no tiene mapeo
 */
export function mapToMiPymeCbte(cbteTipo: number): number {
  const map: Record<number, number> = {
    1: 201,   // FA A → FCE A
    2: 202,   // ND A → FCE ND A
    3: 203,   // NC A → FCE NC A
    6: 206,   // FA B → FCE B
    7: 207,   // ND B → FCE ND B
    8: 208,   // NC B → FCE NC B
    11: 211,  // FA C → FCE C
    12: 212,  // ND C → FCE ND C
    13: 213   // NC C → FCE NC C
  };
  
  return map[cbteTipo] ?? cbteTipo;
}

/**
 * Formatea un número para AFIP (redondeo a 2 decimales)
 * 
 * @param value - Número a formatear
 * @returns Número redondeado a 2 decimales
 */
export function formatNumberForAfip(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Construye array de IVA agrupado por alícuota
 * 
 * Agrupa items por alícuota de IVA y calcula base imponible
 * e importe de IVA para cada grupo.
 * 
 * @param items - Items del comprobante
 * @returns Array de IVA por alícuota
 */
export function buildIvaArray(items: Item[]): Array<{
  Id: number;
  BaseImp: number;
  Importe: number;
}> {
  const ivaArray: Array<{ Id: number; BaseImp: number; Importe: number }> = [];
  const bases = new Map<number, number>();

  // Sumar bases por alícuota
  for (const item of items || []) {
    const base = (item.cantidad || 0) * (item.precioUnitario || 0);
    const alic = Number(item.iva || 0);
    bases.set(alic, (bases.get(alic) || 0) + base);
  }

  // Construir array de IVA para AFIP
  for (const [alic, base] of bases) {
    ivaArray.push({
      Id: mapIvaIdFromPercentage(alic),
      BaseImp: base,
      Importe: (base * alic) / 100
    });
  }

  return ivaArray;
}

/**
 * Consolida totales por alícuota para WSFEv1 (FECAESolicitar)
 * 
 * Calcula todos los montos consolidados requeridos por AFIP:
 * - Importe neto gravado (suma de bases por alícuota)
 * - Importe de IVA (suma de IVAs calculados)
 * - Operaciones exentas (alícuota 0%)
 * - Importe total (suma de todos los conceptos)
 * 
 * @param items - Items del comprobante
 * @returns Totales consolidados para AFIP
 */
export function consolidateTotals(items: Item[]): ConsolidatedTotals {
  const netoPorAli: Map<number, number> = new Map();
  const ivaPorAli: Map<number, number> = new Map();

  let impOpEx = 0; // Operaciones exentas (alícuota 0)

  // Calcular bases e IVA por alícuota
  for (const item of items || []) {
    const base = (item.cantidad || 0) * (item.precioUnitario || 0);
    const ali = Number(item.iva || 0);
    
    // Operaciones exentas (alícuota 0%)
    if (ali === 0) {
      impOpEx += base;
      continue;
    }
    
    // Calcular IVA y acumular por alícuota
    const impIva = (base * ali) / 100;
    netoPorAli.set(ali, (netoPorAli.get(ali) || 0) + base);
    ivaPorAli.set(ali, (ivaPorAli.get(ali) || 0) + impIva);
  }

  // Totales consolidados
  const ImpNeto = Array.from(netoPorAli.values()).reduce((a, b) => a + b, 0);
  const ImpIVA = Array.from(ivaPorAli.values()).reduce((a, b) => a + b, 0);
  const ImpTotConc = 0;  // Conceptos no gravados (no usado actualmente)
  const ImpTrib = 0;     // Tributos/percepciones (no usado actualmente)
  const ImpOpEx = impOpEx;
  const ImpTotal = ImpNeto + ImpIVA + ImpTotConc + ImpTrib + ImpOpEx;

  // Construir array de IVA por alícuota
  const Iva: Array<{ Id: number; BaseImp: number; Importe: number }> = [];
  for (const [ali, base] of netoPorAli.entries()) {
    const importe = ivaPorAli.get(ali) || 0;
    Iva.push({
      Id: mapIvaIdFromPercentage(ali),
      BaseImp: formatNumberForAfip(base),
      Importe: formatNumberForAfip(importe)
    });
  }

  return {
    ImpTotConc: formatNumberForAfip(ImpTotConc),
    ImpOpEx: formatNumberForAfip(ImpOpEx),
    ImpTrib: formatNumberForAfip(ImpTrib),
    ImpNeto: formatNumberForAfip(ImpNeto),
    ImpIVA: formatNumberForAfip(ImpIVA),
    ImpTotal: formatNumberForAfip(ImpTotal),
    Iva
  };
}

