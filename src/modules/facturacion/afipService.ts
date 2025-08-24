import { DatosAFIP, Comprobante, TipoComprobante, ServerStatus, CertificadoInfo } from './types';
import { getDb } from '../../services/DbService';
import { AfipLogger } from './afip/AfipLogger';
import { CertificateValidator } from './afip/CertificateValidator';
import { AfipHelpers } from './afip/helpers';
import { AfipValidator, ValidationParams } from './afip/AfipValidator';
import { IdempotencyManager } from './afip/IdempotencyManager';
import { ResilienceWrapper } from './afip/ResilienceWrapper';
import { getResilienceConfig } from './afip/config';
import { caeValidator } from './afip/CAEValidator';
import { getProvinciaManager } from './provincia/ProvinciaManager';
import { ComprobanteProvincialParams, ResultadoProvincial } from './provincia/IProvinciaService';
import { timeValidator, validateSystemTimeAndThrow } from './utils/TimeValidator';

// Carga diferida del SDK para evitar crash si falta
function loadAfip() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@afipsdk/afip.js');
  } catch (e) {
    throw new Error('SDK AFIP no instalado. Instala "@afipsdk/afip.js" o indica el SDK a usar.');
  }
}

class AfipService {
  private afipInstance: any = null;
  private logger: AfipLogger;
  private idempotencyManager: IdempotencyManager;
  private resilienceWrapper: ResilienceWrapper;

  constructor() {
    this.logger = new AfipLogger();
    this.idempotencyManager = new IdempotencyManager();
    this.resilienceWrapper = new ResilienceWrapper(getResilienceConfig(), this.logger);
  }

  /**
   * Obtiene una instancia de AFIP configurada
   */
  private async getAfipInstance(): Promise<any> {
    if (this.afipInstance) {
      return this.afipInstance;
    }

    const cfg = getDb().getAfipConfig();
    if (!cfg) {
      throw new Error('Falta configurar AFIP en Administración');
    }

    // VALIDACIÓN DE TIEMPO NTP - NUEVA FUNCIONALIDAD
    try {
      await validateSystemTimeAndThrow();
      this.logger.logRequest('timeValidation', { status: 'passed', message: 'Sistema sincronizado con NTP' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.logError('timeValidation', error instanceof Error ? error : new Error(errorMessage), {
        message: 'Validación de tiempo falló antes de crear instancia AFIP'
      });
      throw new Error(`Error de sincronización de tiempo: ${errorMessage}`);
    }

    // Validar certificado antes de crear instancia
    const certInfo = CertificateValidator.validateCertificate(cfg.cert_path);
    if (!certInfo.valido) {
      throw new Error(`Certificado inválido: ${certInfo.error}`);
    }

    const Afip = loadAfip();
    this.afipInstance = new Afip({
      CUIT: Number(cfg.cuit),
      production: cfg.entorno === 'produccion',
      cert: cfg.cert_path,
      key: cfg.key_path
    });

    return this.afipInstance;
  }

  /**
   * Solicita CAE para un comprobante con control de idempotencia
   */
  async solicitarCAE(comprobante: Comprobante): Promise<DatosAFIP> {
    try {
      // Validar comprobante básico
      const errors = AfipHelpers.validateComprobante(comprobante);
      if (errors.length > 0) {
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      const afip = await this.getAfipInstance();
      const cfg = getDb().getAfipConfig()!;
      
      const ptoVta = cfg.pto_vta || comprobante.puntoVenta;
      const tipoCbte = AfipHelpers.mapTipoCbte(comprobante.tipo);

      // VALIDACIÓN CON FEParamGet* - NUEVA FUNCIONALIDAD
      const validator = new AfipValidator(afip);
      const validationParams: ValidationParams = {
        cbteTipo: tipoCbte,
        concepto: comprobante.concepto || 1,
        docTipo: comprobante.docTipo || 99,
        monId: comprobante.monId || 'PES',
        ptoVta: ptoVta,
        cuit: cfg.cuit
      };

      // Ejecutar validación con AFIP
      const validationResult = await validator.validateComprobante(validationParams);
      
      if (!validationResult.isValid) {
        const errorMessage = `Validación AFIP falló: ${validationResult.errors.join('; ')}`;
        this.logger.logError('solicitarCAE', new Error(errorMessage), { 
          comprobante, 
          validationResult 
        });
        throw new Error(errorMessage);
      }

      // Log warnings si existen
      if (validationResult.warnings.length > 0) {
        this.logger.logRequest('validationWarnings', { warnings: validationResult.warnings });
      }

      // Obtener último número autorizado con resiliencia
      const last = await this.resilienceWrapper.execute(
        () => afip.ElectronicBilling.getLastVoucher(ptoVta, tipoCbte),
        'getLastVoucher'
      ) as any;
      
      const numero = Number(last) + 1;

      // CONTROL DE IDEMPOTENCIA - NUEVA FUNCIONALIDAD
      const idempotencyResult = await this.idempotencyManager.checkIdempotency(
        ptoVta, 
        tipoCbte, 
        numero,
        { comprobante, validationParams }
      );

      // Si es un duplicado exitoso, retornar CAE existente
      if (idempotencyResult.isDuplicate && !idempotencyResult.shouldProceed && idempotencyResult.existingCae) {
        this.logger.logRequest('idempotency_hit', { 
          ptoVta, tipoCbte, numero, 
          existingCae: idempotencyResult.existingCae 
        });

        // Construir QR con CAE existente
        const qrData = AfipHelpers.buildQrUrl({
          cuit: Number(cfg.cuit),
          ptoVta,
          tipoCmp: tipoCbte,
          nroCmp: numero,
          importe: comprobante.totales.total,
          fecha: comprobante.fecha,
          cae: idempotencyResult.existingCae
        });

        return { 
          cae: idempotencyResult.existingCae, 
          vencimientoCAE: idempotencyResult.existingCaeVto || '', 
          qrData 
        };
      }

      // Si hay error en idempotencia, fallar
      if (idempotencyResult.error) {
        throw new Error(`Error de idempotencia: ${idempotencyResult.error}`);
      }

      // Si no debe proceder, fallar
      if (!idempotencyResult.shouldProceed) {
        throw new Error('Comprobante en proceso, intente nuevamente en unos momentos');
      }

      // Construir array de IVA
      const ivaArray = AfipHelpers.buildIvaArray(comprobante.items);

      // Construir request para AFIP
      const request = {
        CantReg: 1,
        PtoVta: ptoVta,
        CbteTipo: tipoCbte,
        Concepto: comprobante.concepto || 1,
        DocTipo: comprobante.docTipo || 99,
        DocNro: comprobante.cliente?.cuit ? Number(comprobante.cliente.cuit) : 0,
        CbteDesde: numero,
        CbteHasta: numero,
        CbteFch: comprobante.fecha,
        ImpTotal: AfipHelpers.formatNumber(comprobante.totales.total),
        ImpTotConc: 0,
        ImpNeto: AfipHelpers.formatNumber(comprobante.totales.neto),
        ImpOpEx: 0,
        ImpIVA: AfipHelpers.formatNumber(comprobante.totales.iva),
        ImpTrib: 0,
        MonId: comprobante.monId || 'PES',
        MonCotiz: 1,
        Iva: ivaArray
      };

      // Solicitar CAE con resiliencia
      const response = await this.resilienceWrapper.execute(
        () => afip.ElectronicBilling.createVoucher(request),
        'createVoucher'
      ) as any;

      const cae: string = response.CAE;
      const caeVto: string = response.CAEFchVto;

      // Marcar como exitoso en control de idempotencia
      await this.idempotencyManager.markAsApproved(ptoVta, tipoCbte, numero, cae, caeVto);

      // Construir QR
      const qrData = AfipHelpers.buildQrUrl({
        cuit: Number(cfg.cuit),
        ptoVta,
        tipoCmp: tipoCbte,
        nroCmp: numero,
        importe: comprobante.totales.total,
        fecha: comprobante.fecha,
        cae
      });

      return { cae, vencimientoCAE: caeVto, qrData };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Marcar como fallido en control de idempotencia si tenemos los datos
      try {
        const cfg = getDb().getAfipConfig();
        if (cfg) {
          const ptoVta = cfg.pto_vta || comprobante.puntoVenta;
          const tipoCbte = AfipHelpers.mapTipoCbte(comprobante.tipo);
          
          // Solo intentar marcar como fallido si ya tenemos el número
          // Si el error ocurrió antes de obtener el número, no podemos marcarlo
          if (comprobante.numero) {
            await this.idempotencyManager.markAsFailed(ptoVta, tipoCbte, comprobante.numero, errorMessage);
          }
        }
      } catch (markError) {
        // Si falla el marcado, solo logear
        this.logger.logError('markAsFailed_error', markError instanceof Error ? markError : new Error(String(markError)));
      }

      this.logger.logError('solicitarCAE', error instanceof Error ? error : new Error(errorMessage), { comprobante });
      throw new Error(`Error solicitando CAE: ${errorMessage}`);
    }
  }

  /**
   * Solicita CAE para un comprobante y lo procesa con administraciones provinciales
   */
  async solicitarCAEConProvincias(comprobante: Comprobante): Promise<ResultadoProvincial> {
    const startTime = Date.now();
    
    this.logger.logRequest('solicitarCAE_con_provincias_inicio', {
      tipo: comprobante.tipo,
      puntoVenta: comprobante.puntoVenta,
      total: comprobante.totales.total,
      cuitEmisor: comprobante.empresa.cuit
    });

    try {
      // 1. Solicitar CAE a AFIP primero
      const afipResult = await this.solicitarCAE(comprobante);
      
      this.logger.logRequest('afip_cae_obtenido', {
        cae: afipResult.cae,
        vencimiento: afipResult.vencimientoCAE,
        numero: comprobante.numero
      });

      // 2. Preparar datos para servicios provinciales
      const cfg = getDb().getAfipConfig()!;
      const ptoVta = cfg.pto_vta || comprobante.puntoVenta;
      const tipoCbte = AfipHelpers.mapTipoCbte(comprobante.tipo);
      
      // Obtener número del comprobante (calculado en solicitarCAE)
      const last = await this.resilienceWrapper.execute(
        () => this.getAfipInstance().then(afip => afip.ElectronicBilling.getLastVoucher(ptoVta, tipoCbte)),
        'getLastVoucher'
      ) as any;
      const numero = Number(last);

      const provincialParams: ComprobanteProvincialParams = {
        cae: afipResult.cae,
        caeVencimiento: afipResult.vencimientoCAE,
        numero,
        puntoVenta: ptoVta,
        tipoComprobante: tipoCbte,
        fecha: comprobante.fecha,
        cuitEmisor: comprobante.empresa.cuit,
        razonSocialEmisor: comprobante.empresa.razonSocial,
        cuitReceptor: comprobante.cliente?.cuit,
        razonSocialReceptor: comprobante.cliente?.razonSocial,
        condicionIvaReceptor: comprobante.cliente?.condicionIva,
        neto: comprobante.totales.neto,
        iva: comprobante.totales.iva,
        total: comprobante.totales.total,
        detalle: comprobante.items.map(item => ({
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          alicuotaIva: item.alicuotaIva
        })),
        observaciones: comprobante.observaciones,
        codigoOperacion: comprobante.codigoOperacion
      };

      // 3. Procesar con administraciones provinciales
      const provinciaManager = getProvinciaManager();
      const resultado = await provinciaManager.procesarComprobante(provincialParams);

      this.logger.logRequest('procesamiento_provincial_completado', {
        cae: afipResult.cae,
        estadoFinal: resultado.estado,
        servicioProvincial: resultado.provincial?.servicio,
        duracion: Date.now() - startTime
      });

      return resultado;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.logError('solicitarCAE_con_provincias_error', error instanceof Error ? error : new Error(errorMessage), {
        comprobante: {
          tipo: comprobante.tipo,
          puntoVenta: comprobante.puntoVenta,
          total: comprobante.totales.total
        },
        duracion: Date.now() - startTime
      });

      // Si el error es de AFIP, devolver resultado de fallo completo
      return {
        afip: {
          success: false,
          error: errorMessage
        },
        provincial: null,
        estado: 'AFIP_FAIL'
      };
    }
  }

  /**
   * Verifica el estado de los servidores de AFIP
   */
  async checkServerStatus(): Promise<ServerStatus> {
    try {
      const afip = await this.getAfipInstance();
      
      const status = await this.resilienceWrapper.execute(
        () => afip.ElectronicBilling.getServerStatus(),
        'getServerStatus'
      ) as any;

      return {
        appserver: status.AppServer,
        dbserver: status.DbServer,
        authserver: status.AuthServer
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.logError('checkServerStatus', error instanceof Error ? error : new Error(errorMessage));
      throw new Error(`Error verificando estado de servidores: ${errorMessage}`);
    }
  }

  /**
   * Valida el certificado configurado
   */
  validarCertificado(): CertificadoInfo {
    try {
      const cfg = getDb().getAfipConfig();
      if (!cfg) {
        return {
          valido: false,
          fechaExpiracion: new Date(),
          diasRestantes: 0,
          error: 'No hay configuración AFIP'
        };
      }

      return CertificateValidator.validateCertificate(cfg.cert_path);

    } catch (error) {
      return {
        valido: false,
        fechaExpiracion: new Date(),
        diasRestantes: 0,
        error: `Error validando certificado: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Obtiene el último número autorizado para un punto de venta y tipo
   */
  async getUltimoAutorizado(puntoVenta: number, tipoComprobante: TipoComprobante): Promise<number> {
    try {
      const afip = await this.getAfipInstance();
      const tipoCbte = AfipHelpers.mapTipoCbte(tipoComprobante);

      const last = await this.resilienceWrapper.execute(
        () => afip.ElectronicBilling.getLastVoucher(puntoVenta, tipoCbte),
        'getLastVoucher'
      ) as any;

      return Number(last);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.logError('getUltimoAutorizado', error instanceof Error ? error : new Error(errorMessage), { puntoVenta, tipoComprobante });
      throw new Error(`Error obteniendo último autorizado: ${errorMessage}`);
    }
  }

  /**
   * Obtiene los logs de AFIP para una fecha específica
   */
  getLogs(date?: string) {
    return this.logger.getLogs(date);
  }

  /**
   * Obtiene información de validación de AFIP para debugging
   */
  async getValidationInfo(): Promise<any> {
    try {
      const afip = await this.getAfipInstance();
      const validator = new AfipValidator(afip);
      return await validator.getValidationInfo();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.logError('getValidationInfo', error instanceof Error ? error : new Error(errorMessage));
      throw new Error(`Error obteniendo información de validación: ${errorMessage}`);
    }
  }

  /**
   * Obtiene estadísticas de idempotencia
   */
  getIdempotencyStats(): { pending: number; approved: number; failed: number } {
    return this.idempotencyManager.getStats();
  }

  /**
   * Limpia comprobantes antiguos
   */
  cleanupIdempotency(): number {
    return this.idempotencyManager.cleanup();
  }

  /**
   * Obtiene comprobantes por estado para debugging
   */
  getComprobantesByEstado(estado: 'PENDING' | 'APPROVED' | 'FAILED'): any[] {
    return this.idempotencyManager.getComprobantesByEstado(estado);
  }

  /**
   * Obtiene estadísticas de resiliencia
   */
  getResilienceStats(): any {
    return this.resilienceWrapper.getStats();
  }

  /**
   * Obtiene el estado del circuit breaker
   */
  getCircuitBreakerState(): any {
    return this.resilienceWrapper.getCircuitBreakerState();
  }

  /**
   * Obtiene estadísticas del circuit breaker
   */
  getCircuitBreakerStats(): any {
    return this.resilienceWrapper.getCircuitBreakerStats();
  }

  /**
   * Fuerza el cierre del circuit breaker
   */
  forceCloseCircuitBreaker(): void {
    this.resilienceWrapper.forceCloseCircuitBreaker();
  }

  /**
   * Fuerza la apertura del circuit breaker
   */
  forceOpenCircuitBreaker(): void {
    this.resilienceWrapper.forceOpenCircuitBreaker();
  }

  /**
   * Resetea las estadísticas de resiliencia
   */
  resetResilienceStats(): void {
    this.resilienceWrapper.resetStats();
  }

  /**
   * Obtiene el tiempo restante antes del próximo intento del circuit breaker
   */
  getTimeUntilNextAttempt(): number {
    return this.resilienceWrapper.getTimeUntilNextAttempt();
  }

  /**
   * Verifica si el circuit breaker está listo para half-open
   */
  isReadyForHalfOpen(): boolean {
    return this.resilienceWrapper.isReadyForHalfOpen();
  }

  /**
   * Valida el CAE de una factura antes de una operación
   */
  validateCAEBeforeOperation(
    facturaId: number,
    operation: string
  ): void {
    caeValidator.validateBeforeOperation(facturaId, operation);
  }

  /**
   * Valida el CAE de un comprobante antes de una operación
   */
  validateCAEBeforeOperationByComprobante(
    numero: number,
    ptoVta: number,
    tipoCbte: number,
    operation: string
  ): void {
    caeValidator.validateBeforeOperationByComprobante(numero, ptoVta, tipoCbte, operation);
  }

  /**
   * Obtiene el estado del CAE de una factura
   */
  getCAEStatus(facturaId: number): any {
    return caeValidator.getCAEStatusFromFactura(facturaId);
  }

  /**
   * Obtiene el estado del CAE de un comprobante
   */
  getCAEStatusByComprobante(
    numero: number,
    ptoVta: number,
    tipoCbte: number
  ): any {
    return caeValidator.getCAEStatusFromComprobante(numero, ptoVta, tipoCbte);
  }

  /**
   * Busca facturas con CAE próximo a vencer
   */
  findFacturasWithExpiringCAE(warningThresholdHours: number = 48): any[] {
    return caeValidator.findFacturasWithExpiringCAE(warningThresholdHours);
  }

  /**
   * Busca facturas con CAE vencido
   */
  findFacturasWithExpiredCAE(): any[] {
    return caeValidator.findFacturasWithExpiredCAE();
  }

  /**
   * Obtiene estadísticas de validación de tiempo
   */
  getTimeValidationStats(): any {
    return timeValidator.getStats();
  }

  /**
   * Obtiene el estado de validación de tiempo
   */
  getTimeValidationStatus(): any {
    return timeValidator.getStatus();
  }

  /**
   * Fuerza una validación de tiempo inmediata
   */
  async forceTimeValidation(): Promise<any> {
    return timeValidator.validateSystemTime();
  }

  /**
   * Limpia la instancia de AFIP (útil para testing)
   */
  clearInstance(): void {
    this.afipInstance = null;
  }
}

// Exportar instancia singleton
export const afipService = new AfipService();

// Exportar función legacy para compatibilidad
export async function solicitarCAE(comprobante: Comprobante): Promise<DatosAFIP> {
  return afipService.solicitarCAE(comprobante);
}


