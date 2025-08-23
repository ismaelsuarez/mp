import { getDb, FacturaRecord } from '../../../services/DbService';
import { validateCAE, validateCAEAndThrow, getCAEStatus, CAEValidationOptions } from './validateCAE';
import { AfipLogger } from './AfipLogger';

export interface CAEValidationContext {
  operation: string;
  facturaId?: number;
  numero?: number;
  ptoVta?: number;
  tipoCbte?: number;
  cae?: string;
  caeVto?: string;
}

export interface CAEValidationError {
  code: 'CAE_EXPIRED' | 'CAE_INVALID_DATE' | 'FACTURA_NOT_FOUND' | 'CAE_MISSING';
  message: string;
  details: {
    cae?: string;
    caeVto?: string;
    facturaId?: number;
    numero?: number;
    ptoVta?: number;
    tipoCbte?: number;
    operation: string;
  };
}

export class CAEValidator {
  private logger: AfipLogger;

  constructor() {
    this.logger = new AfipLogger();
  }

  /**
   * Valida un CAE directamente
   */
  validateCAEDirect(
    cae: string, 
    caeVto: string, 
    context: CAEValidationContext,
    options: CAEValidationOptions = {}
  ): void {
    try {
      validateCAEAndThrow(cae, caeVto, options);
      
      // Log de validación exitosa
      this.logger.logRequest('cae_validation_success', {
        operation: context.operation,
        cae,
        caeVto
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Log de error de validación
      this.logger.logError('cae_validation_failed', error instanceof Error ? error : new Error(errorMessage), {
        operation: context.operation,
        cae,
        caeVto,
        context
      });
      
      throw error;
    }
  }

  /**
   * Valida un CAE desde una factura existente
   */
  validateCAEFromFactura(
    facturaId: number,
    context: CAEValidationContext,
    options: CAEValidationOptions = {}
  ): void {
    const db = getDb();
    const factura = db.getFacturaById(facturaId);
    
    if (!factura) {
      const error: CAEValidationError = {
        code: 'FACTURA_NOT_FOUND',
        message: `Factura con ID ${facturaId} no encontrada`,
        details: {
          facturaId,
          operation: context.operation
        }
      };
      
      this.logger.logError('cae_validation_factura_not_found', new Error(error.message), {
        operation: context.operation,
        facturaId
      });
      
      throw new Error(error.message);
    }
    
    if (!factura.cae || !factura.cae_vencimiento) {
      const error: CAEValidationError = {
        code: 'CAE_MISSING',
        message: `La factura ${factura.numero} no tiene CAE registrado`,
        details: {
          facturaId,
          operation: context.operation
        }
      };
      
      this.logger.logError('cae_validation_cae_missing', new Error(error.message), {
        operation: context.operation,
        facturaId,
        factura: factura.numero
      });
      
      throw new Error(error.message);
    }
    
    // Validar CAE
    this.validateCAEDirect(factura.cae, factura.cae_vencimiento, {
      ...context,
      facturaId,
      numero: factura.numero,
      ptoVta: factura.pto_vta,
      tipoCbte: factura.tipo_cbte,
      cae: factura.cae,
      caeVto: factura.cae_vencimiento
    }, options);
  }

  /**
   * Valida un CAE desde número, punto de venta y tipo de comprobante
   */
  validateCAEFromComprobante(
    numero: number,
    ptoVta: number,
    tipoCbte: number,
    context: CAEValidationContext,
    options: CAEValidationOptions = {}
  ): void {
    const db = getDb();
    const factura = db.getFactura(numero, ptoVta, tipoCbte);
    
    if (!factura) {
      const error: CAEValidationError = {
        code: 'FACTURA_NOT_FOUND',
        message: `Comprobante no encontrado: ${tipoCbte}-${ptoVta}-${numero}`,
        details: {
          numero,
          ptoVta,
          tipoCbte,
          operation: context.operation
        }
      };
      
      this.logger.logError('cae_validation_comprobante_not_found', new Error(error.message), {
        operation: context.operation,
        numero,
        ptoVta,
        tipoCbte
      });
      
      throw new Error(error.message);
    }
    
    // Validar usando la factura encontrada
    this.validateCAEFromFactura(factura.id!, {
      ...context,
      numero,
      ptoVta,
      tipoCbte
    }, options);
  }

  /**
   * Middleware para validar CAE antes de operaciones
   */
  validateBeforeOperation(
    facturaId: number,
    operation: string,
    options: CAEValidationOptions = {}
  ): void {
    this.validateCAEFromFactura(facturaId, { operation }, options);
  }

  /**
   * Middleware para validar CAE antes de operaciones por comprobante
   */
  validateBeforeOperationByComprobante(
    numero: number,
    ptoVta: number,
    tipoCbte: number,
    operation: string,
    options: CAEValidationOptions = {}
  ): void {
    this.validateCAEFromComprobante(numero, ptoVta, tipoCbte, { operation }, options);
  }

  /**
   * Obtiene el estado de un CAE desde una factura
   */
  getCAEStatusFromFactura(facturaId: number): {
    status: 'VALID' | 'EXPIRED' | 'EXPIRING_SOON' | 'INVALID_DATE' | 'FACTURA_NOT_FOUND' | 'CAE_MISSING';
    message: string;
    details: {
      cae?: string;
      vencimiento?: string;
      diasRestantes?: number;
      horasRestantes?: number;
      facturaId: number;
    };
  } {
    const db = getDb();
    const factura = db.getFacturaById(facturaId);
    
    if (!factura) {
      return {
        status: 'FACTURA_NOT_FOUND',
        message: `Factura con ID ${facturaId} no encontrada`,
        details: { facturaId }
      };
    }
    
    if (!factura.cae || !factura.cae_vencimiento) {
      return {
        status: 'CAE_MISSING',
        message: `La factura ${factura.numero} no tiene CAE registrado`,
        details: { facturaId }
      };
    }
    
    const status = getCAEStatus(factura.cae, factura.cae_vencimiento);
    
    return {
      status: status.status,
      message: status.message,
      details: {
        ...status.details,
        facturaId
      }
    };
  }

  /**
   * Obtiene el estado de un CAE desde un comprobante
   */
  getCAEStatusFromComprobante(
    numero: number,
    ptoVta: number,
    tipoCbte: number
  ): {
    status: 'VALID' | 'EXPIRED' | 'EXPIRING_SOON' | 'INVALID_DATE' | 'FACTURA_NOT_FOUND' | 'CAE_MISSING';
    message: string;
    details: {
      cae?: string;
      vencimiento?: string;
      diasRestantes?: number;
      horasRestantes?: number;
      numero: number;
      ptoVta: number;
      tipoCbte: number;
    };
  } {
    const db = getDb();
    const factura = db.getFactura(numero, ptoVta, tipoCbte);
    
    if (!factura) {
      return {
        status: 'FACTURA_NOT_FOUND',
        message: `Comprobante no encontrado: ${tipoCbte}-${ptoVta}-${numero}`,
        details: { numero, ptoVta, tipoCbte }
      };
    }
    
    if (!factura.cae || !factura.cae_vencimiento) {
      return {
        status: 'CAE_MISSING',
        message: `La factura ${factura.numero} no tiene CAE registrado`,
        details: { numero, ptoVta, tipoCbte }
      };
    }
    
    const status = getCAEStatus(factura.cae, factura.cae_vencimiento);
    
    return {
      status: status.status,
      message: status.message,
      details: {
        ...status.details,
        numero,
        ptoVta,
        tipoCbte
      }
    };
  }

  /**
   * Busca facturas con CAE próximo a vencer
   */
  findFacturasWithExpiringCAE(warningThresholdHours: number = 48): FacturaRecord[] {
    const db = getDb();
    const facturas = db.listFacturas();
    const expiringFacturas: FacturaRecord[] = [];
    
    for (const factura of facturas) {
      if (!factura.cae || !factura.cae_vencimiento) continue;
      
      const result = validateCAE(factura.cae, factura.cae_vencimiento, {
        warningThresholdHours,
        logWarnings: false
      });
      
      if (result.isExpiringSoon) {
        expiringFacturas.push(factura);
      }
    }
    
    return expiringFacturas;
  }

  /**
   * Busca facturas con CAE vencido
   */
  findFacturasWithExpiredCAE(): FacturaRecord[] {
    const db = getDb();
    const facturas = db.listFacturas();
    const expiredFacturas: FacturaRecord[] = [];
    
    for (const factura of facturas) {
      if (!factura.cae || !factura.cae_vencimiento) continue;
      
      const result = validateCAE(factura.cae, factura.cae_vencimiento, {
        logWarnings: false
      });
      
      if (result.isExpired) {
        expiredFacturas.push(factura);
      }
    }
    
    return expiredFacturas;
  }
}

// Instancia singleton
export const caeValidator = new CAEValidator();
