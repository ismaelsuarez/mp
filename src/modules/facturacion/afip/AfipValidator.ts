import { AfipLogger } from './AfipLogger';
import { AfipVoucherType, ClasePorTipo } from './types';
import { getDb } from '../../../services/DbService';

export interface ValidationParams {
  cbteTipo: number;
  concepto: number;
  docTipo: number;
  monId: string;
  ptoVta: number;
  cuit?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class AfipValidator {
  private afip: any;
  private logger: AfipLogger;
  private DEBUG_FACT: boolean = process.env.FACTURACION_DEBUG === 'true';

  private debugLog(...args: any[]) {
    if (this.DEBUG_FACT) {
      // eslint-disable-next-line no-console
      console.log('[FACT][AfipValidator]', ...args);
    }
  }

  constructor(afipInstance: any) {
    this.afip = afipInstance;
    this.logger = new AfipLogger();
  }

  /**
   * Valida todos los parámetros de un comprobante usando FEParamGet*
   */
  async validateComprobante(params: ValidationParams): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      this.logger.logRequest('validateComprobante', { params });
      this.debugLog('Validando comprobante (FEParamGet*)', params);

      // 1. Validar tipos de comprobante
      await this.validateTipoComprobante(params.cbteTipo, errors);

      // 1.1 Reglas A/B/C según condición IVA del emisor (refuerzo backend)
      await this.validateClaseComprobanteSegunCondicionEmisor(params.cbteTipo, errors, warnings);

      // 2. Validar conceptos
      await this.validateConcepto(params.concepto, errors);

      // 3. Validar tipos de documento
      await this.validateTipoDocumento(params.docTipo, errors);

      // 4. Validar monedas
      await this.validateMoneda(params.monId, errors);

      // 5. Validar puntos de venta
      await this.validatePuntoVenta(params.ptoVta, errors);

      // 6. Validar cotización si moneda no es PES
      if (params.monId !== 'PES') {
        await this.validateCotizacion(params.monId, errors, warnings);
      }

      // 7. Validar tipos de IVA (opcional, para información)
      await this.validateTiposIva(warnings);

      const result: ValidationResult = {
        isValid: errors.length === 0,
        errors,
        warnings
      };

      this.logger.logResponse('validateComprobante', result);
      this.debugLog('Resultado validación FEParamGet*', result);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.logError('validateComprobante', error instanceof Error ? error : new Error(errorMessage), { params });
      return { isValid: false, errors: [`Error de validación: ${errorMessage}`], warnings: [] };
    }
  }

  /**
   * Refuerza reglas de clase de comprobante A/B/C según condición del emisor.
   * - Emisor MONOTRIBUTO/MT → solo clase C (11,12,13)
   * - Emisor RI → se permite A/B; si intenta C, se emite warning (reglas completas dependen del receptor)
   * Basado en lineamientos del manual ARCA (FEParamGetCondicionIvaReceptor).
   */
  private async validateClaseComprobanteSegunCondicionEmisor(cbteTipo: number, errors: string[], warnings: string[]): Promise<void> {
    try {
      const empresa = getDb().getEmpresaConfig?.();
      const cond = String(empresa?.condicion_iva || '').trim().toUpperCase();
      const esTipoDe = (arr: number[]) => arr.includes(Number(cbteTipo));

      if (cond === 'MONO' || cond === 'MT' || cond === 'MONOTRIBUTO') {
        if (!esTipoDe(ClasePorTipo.C)) {
          errors.push(`Para emisor Monotributo, solo se permiten comprobantes clase C (11,12,13). Recibido: ${cbteTipo}`);
        }
      } else if (cond === 'RI' || cond === 'RESPONSABLE INSCRIPTO' || cond === 'RESPONSABLE_INSCRIPTO') {
        if (esTipoDe(ClasePorTipo.C)) {
          warnings.push('Emisor Responsable Inscripto con comprobante clase C: verificar condición del receptor.');
        }
      }
    } catch (e) {
      // En caso de cualquier problema de lectura de config, no bloquear
      warnings.push('No se pudo verificar condición IVA del emisor para validar clase del comprobante.');
    }
  }

  /** Valida el tipo de comprobante usando FEParamGetTiposCbte */
  private async validateTipoComprobante(cbteTipo: number, errors: string[]): Promise<void> {
    try {
      const eb = this.afip?.ElectronicBilling;
      const fn = eb?.getVoucherTypes || eb?.getVoucherType;
      if (typeof fn !== 'function') {
        errors.push('SDK no expone método de tipos de comprobante (getVoucherTypes).');
        return;
      }
      const tiposCbte = (await fn.call(eb)) as AfipVoucherType[];
      const tipoValido = Array.isArray(tiposCbte) && tiposCbte.some((t) => Number((t as any).Id) === cbteTipo);
      if (!tipoValido) {
        const tiposDisponibles = (tiposCbte || []).map((t) => `${(t as any).Id} (${(t as any).Desc})`).join(', ');
        errors.push(`Tipo de comprobante inválido: ${cbteTipo}. Tipos válidos: ${tiposDisponibles}`);
      }
    } catch (error) {
      errors.push(`Error validando tipo de comprobante: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Valida el concepto usando FEParamGetTiposConcepto */
  private async validateConcepto(concepto: number, errors: string[]): Promise<void> {
    try {
      const conceptos = await this.afip.ElectronicBilling.getConceptTypes() as Array<{ Id: number | string; Desc: string }>;
      const conceptoValido = Array.isArray(conceptos) && conceptos.some((c) => Number((c as any).Id) === concepto);
      if (!conceptoValido) {
        const conceptosDisponibles = (conceptos || []).map((c) => `${(c as any).Id} (${(c as any).Desc})`).join(', ');
        errors.push(`Concepto inválido: ${concepto}. Conceptos válidos: ${conceptosDisponibles}`);
      }
    } catch (error) {
      errors.push(`Error validando concepto: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Valida el tipo de documento usando FEParamGetTiposDoc */
  private async validateTipoDocumento(docTipo: number, errors: string[]): Promise<void> {
    try {
      const tiposDoc = await this.afip.ElectronicBilling.getDocumentTypes() as Array<{ Id: number | string; Desc: string }>;
      const tipoValido = Array.isArray(tiposDoc) && tiposDoc.some((d) => Number((d as any).Id) === docTipo);
      if (!tipoValido) {
        const tiposDisponibles = (tiposDoc || []).map((d) => `${(d as any).Id} (${(d as any).Desc})`).join(', ');
        errors.push(`Tipo de documento inválido: ${docTipo}. Tipos válidos: ${tiposDisponibles}`);
      }
    } catch (error) {
      errors.push(`Error validando tipo de documento: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Valida la moneda usando FEParamGetTiposMonedas */
  private async validateMoneda(monId: string, errors: string[]): Promise<void> {
    try {
      const monedas = await this.afip.ElectronicBilling.getCurrenciesTypes() as Array<{ Id: string; Desc: string }>;
      const monedaValida = Array.isArray(monedas) && monedas.some((m) => (m as any).Id === monId);
      if (!monedaValida) {
        const monedasDisponibles = (monedas || []).map((m) => `${(m as any).Id} (${(m as any).Desc})`).join(', ');
        errors.push(`Moneda inválida: ${monId}. Monedas válidas: ${monedasDisponibles}`);
      }
    } catch (error) {
      errors.push(`Error validando moneda: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Valida el punto de venta usando FEParamGetPtosVenta */
  private async validatePuntoVenta(ptoVta: number, errors: string[]): Promise<void> {
    try {
      const eb = this.afip?.ElectronicBilling;
      const fn = eb?.getSalesPoints || eb?.getPointsOfSales;
      if (typeof fn !== 'function') {
        errors.push('SDK no expone método de puntos de venta (getSalesPoints/getPointsOfSales).');
        return;
      }
      const ptosVta = (await fn.call(eb)) as Array<{ Nro: number | string; Desc?: string }>;
      const ptoValido = Array.isArray(ptosVta) && ptosVta.some((p) => Number((p as any).Nro) === ptoVta);
      if (!ptoValido) {
        const ptosDisponibles = (ptosVta || []).map((p) => `${(p as any).Nro} (${(p as any).Desc || ''})`).join(', ');
        errors.push(`Punto de venta inválido: ${ptoVta}. Puntos válidos: ${ptosDisponibles}`);
      }
    } catch (error) {
      errors.push(`Error validando punto de venta: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Valida la cotización usando FEParamGetCotizacion */
  private async validateCotizacion(monId: string, errors: string[], warnings: string[]): Promise<void> {
    try {
      const cot = await this.afip.ElectronicBilling.getCurrencyCotization(monId) as { MonId: string; MonCotiz: number };
      if (!cot || typeof cot.MonCotiz !== 'number') {
        warnings.push(`No se obtuvo cotización válida para ${monId}`);
      }
    } catch (error) {
      warnings.push(`No se pudo validar cotización ${monId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Tipos de IVA informativos */
  private async validateTiposIva(warnings: string[]): Promise<void> {
    try {
      const eb = this.afip?.ElectronicBilling;
      const fn = eb?.getAliquotsTypes || eb?.getAliquotTypes;
      if (typeof fn === 'function') {
        await fn.call(eb);
      } else {
        warnings.push('SDK no expone método de tipos de IVA (getAliquotsTypes/getAliquotTypes)');
      }
    } catch (error) {
      warnings.push(`No se pudieron obtener tipos de IVA: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Obtiene información de validación para debugging
   */
  async getValidationInfo(): Promise<any> {
    try {
      const eb = this.afip?.ElectronicBilling;
      const tiposCbte = (eb?.getVoucherTypes ? await eb.getVoucherTypes() : undefined) || null;
      const conceptos = (eb?.getConceptTypes ? await eb.getConceptTypes() : undefined) || null;
      const tiposDoc = (eb?.getDocumentTypes ? await eb.getDocumentTypes() : undefined) || null;
      const monedas = (eb?.getCurrenciesTypes ? await eb.getCurrenciesTypes() : undefined) || null;
      const ptosVta = (eb?.getSalesPoints ? await eb.getSalesPoints() : (eb?.getPointsOfSales ? await eb.getPointsOfSales() : null));
      const tiposIva = (eb?.getAliquotsTypes ? await eb.getAliquotsTypes() : (eb?.getAliquotTypes ? await eb.getAliquotTypes() : null));
      const info = { tiposCbte, conceptos, tiposDoc, monedas, ptosVta, tiposIva };

      this.logger.logResponse('getValidationInfo', info);
      return info;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.logError('getValidationInfo', error instanceof Error ? error : new Error(errorMessage));
      throw new Error(`Error obteniendo información de validación: ${errorMessage}`);
    }
  }
}
