import { DatosAFIP, Comprobante, TipoComprobante, ServerStatus, CertificadoInfo } from './types';
import { AfipVoucherResponse } from './afip/types';
import { AfipInstanceManager } from './afip/AfipInstanceManager';
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
import { getSecureStore } from '../../services/SecureStore';
import { ComprobanteProvincialParams, ResultadoProvincial } from './provincia/IProvinciaService';
import { timeValidator, validateSystemTimeAndThrow } from './utils/TimeValidator';
import { validateArcaRules } from './arca/ArcaAdapter';

// Eliminado: carga del SDK externo @afipsdk/afip.js

class AfipService {
  private afipInstance: any = null;
  private instanceManager: AfipInstanceManager | null = null;
  private logger: AfipLogger;
  private idempotencyManager: IdempotencyManager;
  private resilienceWrapper: ResilienceWrapper;
  private DEBUG_FACT: boolean = process.env.FACTURACION_DEBUG === 'true';
  private tempCleanup: (() => void) | null = null;

  private debugLog(...args: any[]) {
    if (this.DEBUG_FACT) {
      // eslint-disable-next-line no-console
      console.log('[FACT][AFIPService]', ...args);
    }
  }

  constructor() {
    this.logger = new AfipLogger();
    this.idempotencyManager = new IdempotencyManager();
    this.resilienceWrapper = new ResilienceWrapper(getResilienceConfig(), this.logger);
  }

  /**
   * Obtiene una instancia de AFIP configurada
   */
  private async getAfipInstance(): Promise<any> {
    this.debugLog('getAfipInstance: inicio');
    const cfg = getDb().getAfipConfig();
    if (!cfg) {
      throw new Error('Falta configurar AFIP en Administración');
    }
    this.debugLog('Config AFIP cargada', { entorno: cfg.entorno, cuit: cfg.cuit, pto_vta: cfg.pto_vta, cert_path: cfg.cert_path, key_path: cfg.key_path });

    // VALIDACIÓN DE TIEMPO NTP - NUEVA FUNCIONALIDAD
    try {
      await validateSystemTimeAndThrow();
      this.logger.logRequest('timeValidation', { status: 'passed', message: 'Sistema sincronizado con NTP' });
      this.debugLog('Validación NTP OK');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.logError('timeValidation', error instanceof Error ? error : new Error(errorMessage), {
        message: 'Validación de tiempo falló antes de crear instancia AFIP'
      });
      this.debugLog('Validación NTP FAIL', errorMessage);
      throw new Error(`Error de sincronización de tiempo: ${errorMessage}`);
    }

    // Resolver origen de cert/key: modo seguro (SecureStore) o rutas configuradas
    let resolvedCertPath = cfg.cert_path;
    let resolvedKeyPath = cfg.key_path;
    const useSecure = (!resolvedCertPath || String(resolvedCertPath).trim() === '') && (!resolvedKeyPath || String(resolvedKeyPath).trim() === '');
    if (useSecure) {
      this.debugLog('Modo 100% seguro activo: usando SecureStore para cert/key temporales');
      const { certPath, keyPath, cleanup } = getSecureStore().writeTempFilesForAfip();
      resolvedCertPath = certPath;
      resolvedKeyPath = keyPath;
      // Guardar cleanup para limpiar al renovar/limpiar instancia
      this.tempCleanup?.();
      this.tempCleanup = cleanup;
    }

    // Validar certificado antes de crear instancia (usar ruta resuelta)
    const certInfo = CertificateValidator.validateCertificate(resolvedCertPath);
    if (!certInfo.valido) {
      this.debugLog('Certificado inválido', certInfo);
      throw new Error(`Certificado inválido: ${certInfo.error}`);
    }
    this.debugLog('Certificado válido. Días restantes:', certInfo.diasRestantes);

    if (!this.instanceManager) {
      this.instanceManager = new AfipInstanceManager(() => ({
        cuit: Number(cfg.cuit),
        production: cfg.entorno === 'produccion',
        cert: resolvedCertPath,
        key: resolvedKeyPath
      }));
    }
    const instance = await this.instanceManager.getInstance();
    this.debugLog('Instancia AFIP creada/reutilizada', { production: cfg.entorno === 'produccion' });
    return (this.afipInstance = instance);
  }

  /**
   * Flujo ARCA (WSBFEv1) mínimo: solo validación local por ahora.
   * Próximo paso: integrar WSAA para wsbfev1 y BFEAuthorize/BFEGetPARAM.
   */
  private async solicitarCAEArca(comprobante: Comprobante): Promise<DatosAFIP> {
    // Validaciones ARCA locales
    const arcaVal = validateArcaRules(comprobante);
    if (!arcaVal.isValid) {
      throw new Error(`Reglas ARCA: ${arcaVal.errors.join('; ')}`);
    }
    if (arcaVal.warnings.length) {
      this.debugLog('ARCA warnings', arcaVal.warnings);
    }

    // Placeholder: hasta integrar BFEAuthorize, devolvemos error claro
    throw new Error('ARCA activo: falta integrar WSAA/BFEAuthorize. Configurar homologación ARCA.');
  }

  /**
   * Solicita CAE para un comprobante con control de idempotencia
   */
  async solicitarCAE(comprobante: Comprobante): Promise<DatosAFIP> {
    try {
      this.debugLog('solicitarCAE: inicio', {
        tipo: comprobante.tipo,
        puntoVenta: comprobante.puntoVenta,
        fecha: comprobante.fecha,
        total: comprobante.totales?.total
      });
      // Validar comprobante básico
      const errors = AfipHelpers.validateComprobante(comprobante);
      if (errors.length > 0) {
        this.debugLog('solicitarCAE: validación local falló', errors);
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      const isArca = (process.env.AFIP_MODE || '').toLowerCase() === 'arca';

      // Si ARCA está activo, no usar WSFE: ir por flujo ARCA
      if (isArca) {
        this.debugLog('AFIP_MODE=arca → usar flujo WSBFEv1');
        return await this.solicitarCAEArca(comprobante);
      }

      const afip = await this.getAfipInstance();
      const cfg = getDb().getAfipConfig()!;
      
      // Tomar pto de venta desde UI si viene, caso contrario usar config
      const ptoVta = comprobante.puntoVenta || cfg.pto_vta;
      const tipoCbte = AfipHelpers.mapTipoCbte(comprobante.tipo);
      this.debugLog('Parámetros AFIP', { ptoVta, tipoCbte });


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
        this.debugLog('Validación FEParamGet* FAIL', validationResult);
        throw new Error(errorMessage);
      }

      // Log warnings si existen
      if (validationResult.warnings.length > 0) {
        this.logger.logRequest('validationWarnings', { warnings: validationResult.warnings });
        this.debugLog('Validación FEParamGet* warnings', validationResult.warnings);
      }

      // Obtener último número autorizado con resiliencia
      const last = await this.resilienceWrapper.execute(
        () => afip.ElectronicBilling.getLastVoucher(ptoVta, tipoCbte),
        'getLastVoucher'
      ) as number;
      
      const numero = Number(last) + 1;
      this.debugLog('getLastVoucher OK', { last: Number(last), siguiente: numero });

      // CONTROL DE IDEMPOTENCIA - NUEVA FUNCIONALIDAD
      const idempotencyResult = await this.idempotencyManager.checkIdempotency(
        ptoVta, 
        tipoCbte, 
        numero,
        { comprobante, validationParams }
      );
      this.debugLog('Idempotencia', idempotencyResult);

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

      // Consolidar totales por alícuota (enviar SOLO montos consolidados a AFIP)
      const totales = AfipHelpers.consolidateTotals(comprobante.items);
      const ivaArray = totales.Iva;
      this.debugLog('Construyendo request createVoucher (consolidado)', totales);

      // Construir request para AFIP
      // Normalizaciones de tipos/formatos exigidos por WSFE
      const concepto = Number(comprobante.concepto || 1);
      const docTipo = Number(comprobante.docTipo || 99);
      const docNro = comprobante.cliente?.cuit
        ? Number(String(comprobante.cliente.cuit).replace(/\D/g, ''))
        : 0;
      const cbteFch = String(comprobante.fecha).replace(/-/g, '');
      const monId = String(comprobante.monId || 'PES').trim().toUpperCase();

      const request: any = {
        CantReg: 1,
        PtoVta: ptoVta,
        CbteTipo: tipoCbte,
        Concepto: concepto,
        DocTipo: docTipo,
        DocNro: docNro,
        CbteDesde: numero,
        CbteHasta: numero,
        CbteFch: cbteFch,
        ImpTotal: totales.ImpTotal,
        ImpTotConc: totales.ImpTotConc,
        ImpNeto: totales.ImpNeto,
        ImpOpEx: totales.ImpOpEx,
        ImpIVA: totales.ImpIVA,
        ImpTrib: totales.ImpTrib,
        MonId: monId,
        MonCotiz: 1,
        Iva: ivaArray
      };

      // ARCA / Provinciales: IVARECEPTOR (si hay condición IVA del receptor)
      try {
        const ivarc = AfipHelpers.mapCondicionIvaReceptorToArcaCode(comprobante.cliente?.condicionIva);
        if (ivarc !== undefined) (request as any).IVARECEPTOR = ivarc;
      } catch {}

      // Ajustes para monotributo con comprobantes C: no discrimina IVA
      try {
        const cfgEmpresa = getDb().getEmpresaConfig?.();
        const cond = String(cfgEmpresa?.condicion_iva || '').toUpperCase();
        if ((cond === 'MT' || cond === 'MONO') && [11,12,13].includes(tipoCbte)) {
          request.ImpIVA = 0;
          request.Iva = [];
          if (!comprobante.cliente?.cuit) {
            request.DocTipo = 99;
            request.DocNro = 0;
          }
        }
      } catch {}

      // Fechas de servicio: obligatorias si Concepto es 2 o 3
      if (Number(request.Concepto) === 2 || Number(request.Concepto) === 3) {
        const normalize = (s?: string) => (s ? String(s).replace(/-/g, '') : undefined);
        const fdesde = normalize(comprobante.FchServDesde);
        const fhasta = normalize(comprobante.FchServHasta);
        const fvto = normalize(comprobante.FchVtoPago);
        if (fdesde) request.FchServDesde = fdesde;
        if (fhasta) request.FchServHasta = fhasta;
        if (fvto) request.FchVtoPago = fvto;
      }

      // Comprobantes asociados (NC/ND)
      if (Array.isArray(comprobante.comprobantesAsociados) && comprobante.comprobantesAsociados.length > 0) {
        request.CbtesAsoc = comprobante.comprobantesAsociados.map(x => ({
          Tipo: Number(x.Tipo),
          PtoVta: Number(x.PtoVta),
          Nro: Number(x.Nro)
        }));
      }

      // Solicitar CAE con resiliencia
      const response = await this.resilienceWrapper.execute(
        () => afip.ElectronicBilling.createVoucher(request),
        'createVoucher'
      ) as AfipVoucherResponse;

      const cae: string = String(response.CAE);
      const caeVto: string = String(response.CAEFchVto);
      const observaciones = Array.isArray(response.Observaciones) ? response.Observaciones : undefined;
      this.debugLog('createVoucher OK', { cae, caeVto });

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

      return { cae, vencimientoCAE: caeVto, qrData, observaciones };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.debugLog('solicitarCAE ERROR', errorMessage);
      
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
    this.debugLog('solicitarCAEConProvincias: inicio');

    try {
      // 1. Solicitar CAE a AFIP primero
      const afipResult = await this.solicitarCAE(comprobante);
      this.debugLog('AFIP CAE obtenido', { cae: afipResult.cae, vto: afipResult.vencimientoCAE });
      
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
      ) as number;
      const numero = Number(last);
      this.debugLog('Número AFIP (con provincias)', numero);

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
        ivareceptor: AfipHelpers.mapCondicionIvaReceptorToArcaCode(comprobante.cliente?.condicionIva),
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
      this.debugLog('Resultado provincial', { estado: resultado.estado, servicio: resultado.provincial?.servicio });

      this.logger.logRequest('procesamiento_provincial_completado', {
        cae: afipResult.cae,
        estadoFinal: resultado.estado,
        servicioProvincial: resultado.provincial?.servicio,
        duracion: Date.now() - startTime
      });

      return resultado;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.debugLog('solicitarCAEConProvincias ERROR', errorMessage);
      
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
      this.debugLog('ServerStatus', status);

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
        this.debugLog('validarCertificado: no hay configuración');
        return {
          valido: false,
          fechaExpiracion: new Date(),
          diasRestantes: 0,
          error: 'No hay configuración AFIP'
        };
      }

      const info = CertificateValidator.validateCertificate(cfg.cert_path);
      this.debugLog('validarCertificado:', info);
      return info;

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
      ) as number;

      const n = Number(last);
      this.debugLog('getUltimoAutorizado', { puntoVenta, tipoComprobante, last: n });
      return n;

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

  /** Limpia la instancia de AFIP para forzar renovaciones de TA */
  clearInstance(): void {
    this.instanceManager?.clearCache();
    this.afipInstance = null;
    // Limpiar archivos temporales si se usó modo seguro
    try { this.tempCleanup?.(); } catch {}
    this.tempCleanup = null;
    this.debugLog('Instancia AFIP limpiada');
  }
}

// Exportar instancia singleton
export const afipService = new AfipService();

// Exportar función legacy para compatibilidad
export async function solicitarCAE(comprobante: Comprobante): Promise<DatosAFIP> {
  return afipService.solicitarCAE(comprobante);
}


