"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.afipService = void 0;
exports.solicitarCAE = solicitarCAE;
const DbService_1 = require("../../services/DbService");
const AfipLogger_1 = require("./afip/AfipLogger");
const CertificateValidator_1 = require("./afip/CertificateValidator");
const helpers_1 = require("./afip/helpers");
const AfipValidator_1 = require("./afip/AfipValidator");
const IdempotencyManager_1 = require("./afip/IdempotencyManager");
const ResilienceWrapper_1 = require("./afip/ResilienceWrapper");
const config_1 = require("./afip/config");
const CAEValidator_1 = require("./afip/CAEValidator");
const ProvinciaManager_1 = require("./provincia/ProvinciaManager");
const TimeValidator_1 = require("./utils/TimeValidator");
const ArcaAdapter_1 = require("./arca/ArcaAdapter");
// Carga diferida del SDK para evitar crash si falta
function loadAfip() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require('@afipsdk/afip.js');
    }
    catch (e) {
        throw new Error('SDK AFIP no instalado. Instala "@afipsdk/afip.js" o indica el SDK a usar.');
    }
}
class AfipService {
    debugLog(...args) {
        if (this.DEBUG_FACT) {
            // eslint-disable-next-line no-console
            console.log('[FACT][AFIPService]', ...args);
        }
    }
    constructor() {
        this.afipInstance = null;
        this.DEBUG_FACT = process.env.FACTURACION_DEBUG === 'true';
        this.logger = new AfipLogger_1.AfipLogger();
        this.idempotencyManager = new IdempotencyManager_1.IdempotencyManager();
        this.resilienceWrapper = new ResilienceWrapper_1.ResilienceWrapper((0, config_1.getResilienceConfig)(), this.logger);
    }
    /**
     * Obtiene una instancia de AFIP configurada
     */
    async getAfipInstance() {
        this.debugLog('getAfipInstance: inicio');
        if (this.afipInstance) {
            this.debugLog('getAfipInstance: reutilizando instancia existente');
            return this.afipInstance;
        }
        const cfg = (0, DbService_1.getDb)().getAfipConfig();
        if (!cfg) {
            throw new Error('Falta configurar AFIP en Administración');
        }
        this.debugLog('Config AFIP cargada', { entorno: cfg.entorno, cuit: cfg.cuit, pto_vta: cfg.pto_vta, cert_path: cfg.cert_path, key_path: cfg.key_path });
        // VALIDACIÓN DE TIEMPO NTP - NUEVA FUNCIONALIDAD
        try {
            await (0, TimeValidator_1.validateSystemTimeAndThrow)();
            this.logger.logRequest('timeValidation', { status: 'passed', message: 'Sistema sincronizado con NTP' });
            this.debugLog('Validación NTP OK');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.logError('timeValidation', error instanceof Error ? error : new Error(errorMessage), {
                message: 'Validación de tiempo falló antes de crear instancia AFIP'
            });
            this.debugLog('Validación NTP FAIL', errorMessage);
            throw new Error(`Error de sincronización de tiempo: ${errorMessage}`);
        }
        // Validar certificado antes de crear instancia
        const certInfo = CertificateValidator_1.CertificateValidator.validateCertificate(cfg.cert_path);
        if (!certInfo.valido) {
            this.debugLog('Certificado inválido', certInfo);
            throw new Error(`Certificado inválido: ${certInfo.error}`);
        }
        this.debugLog('Certificado válido. Días restantes:', certInfo.diasRestantes);
        const Afip = loadAfip();
        this.afipInstance = new Afip({
            CUIT: Number(cfg.cuit),
            production: cfg.entorno === 'produccion',
            cert: cfg.cert_path,
            key: cfg.key_path
        });
        this.debugLog('Instancia AFIP creada', { production: cfg.entorno === 'produccion' });
        return this.afipInstance;
    }
    /**
     * Flujo ARCA (WSBFEv1) mínimo: solo validación local por ahora.
     * Próximo paso: integrar WSAA para wsbfev1 y BFEAuthorize/BFEGetPARAM.
     */
    async solicitarCAEArca(comprobante) {
        // Validaciones ARCA locales
        const arcaVal = (0, ArcaAdapter_1.validateArcaRules)(comprobante);
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
    async solicitarCAE(comprobante) {
        try {
            this.debugLog('solicitarCAE: inicio', {
                tipo: comprobante.tipo,
                puntoVenta: comprobante.puntoVenta,
                fecha: comprobante.fecha,
                total: comprobante.totales?.total
            });
            // Validar comprobante básico
            const errors = helpers_1.AfipHelpers.validateComprobante(comprobante);
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
            const cfg = (0, DbService_1.getDb)().getAfipConfig();
            // Tomar pto de venta desde UI si viene, caso contrario usar config
            const ptoVta = comprobante.puntoVenta || cfg.pto_vta;
            const tipoCbte = helpers_1.AfipHelpers.mapTipoCbte(comprobante.tipo);
            this.debugLog('Parámetros AFIP', { ptoVta, tipoCbte });
            // VALIDACIÓN CON FEParamGet* - NUEVA FUNCIONALIDAD
            const validator = new AfipValidator_1.AfipValidator(afip);
            const validationParams = {
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
            const last = await this.resilienceWrapper.execute(() => afip.ElectronicBilling.getLastVoucher(ptoVta, tipoCbte), 'getLastVoucher');
            const numero = Number(last) + 1;
            this.debugLog('getLastVoucher OK', { last: Number(last), siguiente: numero });
            // CONTROL DE IDEMPOTENCIA - NUEVA FUNCIONALIDAD
            const idempotencyResult = await this.idempotencyManager.checkIdempotency(ptoVta, tipoCbte, numero, { comprobante, validationParams });
            this.debugLog('Idempotencia', idempotencyResult);
            // Si es un duplicado exitoso, retornar CAE existente
            if (idempotencyResult.isDuplicate && !idempotencyResult.shouldProceed && idempotencyResult.existingCae) {
                this.logger.logRequest('idempotency_hit', {
                    ptoVta, tipoCbte, numero,
                    existingCae: idempotencyResult.existingCae
                });
                // Construir QR con CAE existente
                const qrData = helpers_1.AfipHelpers.buildQrUrl({
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
            const ivaArray = helpers_1.AfipHelpers.buildIvaArray(comprobante.items);
            this.debugLog('Construyendo request createVoucher');
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
                ImpTotal: helpers_1.AfipHelpers.formatNumber(comprobante.totales.total),
                ImpTotConc: 0,
                ImpNeto: helpers_1.AfipHelpers.formatNumber(comprobante.totales.neto),
                ImpOpEx: 0,
                ImpIVA: helpers_1.AfipHelpers.formatNumber(comprobante.totales.iva),
                ImpTrib: 0,
                MonId: comprobante.monId || 'PES',
                MonCotiz: 1,
                Iva: ivaArray
            };
            // Fechas de servicio: obligatorias si Concepto es 2 o 3
            if (Number(request.Concepto) === 2 || Number(request.Concepto) === 3) {
                const normalize = (s) => (s ? String(s).replace(/-/g, '') : undefined);
                const fdesde = normalize(comprobante.FchServDesde);
                const fhasta = normalize(comprobante.FchServHasta);
                const fvto = normalize(comprobante.FchVtoPago);
                if (fdesde)
                    request.FchServDesde = fdesde;
                if (fhasta)
                    request.FchServHasta = fhasta;
                if (fvto)
                    request.FchVtoPago = fvto;
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
            const response = await this.resilienceWrapper.execute(() => afip.ElectronicBilling.createVoucher(request), 'createVoucher');
            const cae = response.CAE;
            const caeVto = response.CAEFchVto;
            const observaciones = Array.isArray(response.Observaciones) ? response.Observaciones : undefined;
            this.debugLog('createVoucher OK', { cae, caeVto });
            // Marcar como exitoso en control de idempotencia
            await this.idempotencyManager.markAsApproved(ptoVta, tipoCbte, numero, cae, caeVto);
            // Construir QR
            const qrData = helpers_1.AfipHelpers.buildQrUrl({
                cuit: Number(cfg.cuit),
                ptoVta,
                tipoCmp: tipoCbte,
                nroCmp: numero,
                importe: comprobante.totales.total,
                fecha: comprobante.fecha,
                cae
            });
            return { cae, vencimientoCAE: caeVto, qrData, observaciones };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.debugLog('solicitarCAE ERROR', errorMessage);
            // Marcar como fallido en control de idempotencia si tenemos los datos
            try {
                const cfg = (0, DbService_1.getDb)().getAfipConfig();
                if (cfg) {
                    const ptoVta = cfg.pto_vta || comprobante.puntoVenta;
                    const tipoCbte = helpers_1.AfipHelpers.mapTipoCbte(comprobante.tipo);
                    // Solo intentar marcar como fallido si ya tenemos el número
                    // Si el error ocurrió antes de obtener el número, no podemos marcarlo
                    if (comprobante.numero) {
                        await this.idempotencyManager.markAsFailed(ptoVta, tipoCbte, comprobante.numero, errorMessage);
                    }
                }
            }
            catch (markError) {
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
    async solicitarCAEConProvincias(comprobante) {
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
            const cfg = (0, DbService_1.getDb)().getAfipConfig();
            const ptoVta = cfg.pto_vta || comprobante.puntoVenta;
            const tipoCbte = helpers_1.AfipHelpers.mapTipoCbte(comprobante.tipo);
            // Obtener número del comprobante (calculado en solicitarCAE)
            const last = await this.resilienceWrapper.execute(() => this.getAfipInstance().then(afip => afip.ElectronicBilling.getLastVoucher(ptoVta, tipoCbte)), 'getLastVoucher');
            const numero = Number(last);
            this.debugLog('Número AFIP (con provincias)', numero);
            const provincialParams = {
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
            const provinciaManager = (0, ProvinciaManager_1.getProvinciaManager)();
            const resultado = await provinciaManager.procesarComprobante(provincialParams);
            this.debugLog('Resultado provincial', { estado: resultado.estado, servicio: resultado.provincial?.servicio });
            this.logger.logRequest('procesamiento_provincial_completado', {
                cae: afipResult.cae,
                estadoFinal: resultado.estado,
                servicioProvincial: resultado.provincial?.servicio,
                duracion: Date.now() - startTime
            });
            return resultado;
        }
        catch (error) {
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
    async checkServerStatus() {
        try {
            const afip = await this.getAfipInstance();
            const status = await this.resilienceWrapper.execute(() => afip.ElectronicBilling.getServerStatus(), 'getServerStatus');
            this.debugLog('ServerStatus', status);
            return {
                appserver: status.AppServer,
                dbserver: status.DbServer,
                authserver: status.AuthServer
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.logError('checkServerStatus', error instanceof Error ? error : new Error(errorMessage));
            throw new Error(`Error verificando estado de servidores: ${errorMessage}`);
        }
    }
    /**
     * Valida el certificado configurado
     */
    validarCertificado() {
        try {
            const cfg = (0, DbService_1.getDb)().getAfipConfig();
            if (!cfg) {
                this.debugLog('validarCertificado: no hay configuración');
                return {
                    valido: false,
                    fechaExpiracion: new Date(),
                    diasRestantes: 0,
                    error: 'No hay configuración AFIP'
                };
            }
            const info = CertificateValidator_1.CertificateValidator.validateCertificate(cfg.cert_path);
            this.debugLog('validarCertificado:', info);
            return info;
        }
        catch (error) {
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
    async getUltimoAutorizado(puntoVenta, tipoComprobante) {
        try {
            const afip = await this.getAfipInstance();
            const tipoCbte = helpers_1.AfipHelpers.mapTipoCbte(tipoComprobante);
            const last = await this.resilienceWrapper.execute(() => afip.ElectronicBilling.getLastVoucher(puntoVenta, tipoCbte), 'getLastVoucher');
            const n = Number(last);
            this.debugLog('getUltimoAutorizado', { puntoVenta, tipoComprobante, last: n });
            return n;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.logError('getUltimoAutorizado', error instanceof Error ? error : new Error(errorMessage), { puntoVenta, tipoComprobante });
            throw new Error(`Error obteniendo último autorizado: ${errorMessage}`);
        }
    }
    /**
     * Obtiene los logs de AFIP para una fecha específica
     */
    getLogs(date) {
        return this.logger.getLogs(date);
    }
    /**
     * Obtiene información de validación de AFIP para debugging
     */
    async getValidationInfo() {
        try {
            const afip = await this.getAfipInstance();
            const validator = new AfipValidator_1.AfipValidator(afip);
            return await validator.getValidationInfo();
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.logError('getValidationInfo', error instanceof Error ? error : new Error(errorMessage));
            throw new Error(`Error obteniendo información de validación: ${errorMessage}`);
        }
    }
    /**
     * Obtiene estadísticas de idempotencia
     */
    getIdempotencyStats() {
        return this.idempotencyManager.getStats();
    }
    /**
     * Limpia comprobantes antiguos
     */
    cleanupIdempotency() {
        return this.idempotencyManager.cleanup();
    }
    /**
     * Obtiene comprobantes por estado para debugging
     */
    getComprobantesByEstado(estado) {
        return this.idempotencyManager.getComprobantesByEstado(estado);
    }
    /**
     * Obtiene estadísticas de resiliencia
     */
    getResilienceStats() {
        return this.resilienceWrapper.getStats();
    }
    /**
     * Obtiene el estado del circuit breaker
     */
    getCircuitBreakerState() {
        return this.resilienceWrapper.getCircuitBreakerState();
    }
    /**
     * Obtiene estadísticas del circuit breaker
     */
    getCircuitBreakerStats() {
        return this.resilienceWrapper.getCircuitBreakerStats();
    }
    /**
     * Fuerza el cierre del circuit breaker
     */
    forceCloseCircuitBreaker() {
        this.resilienceWrapper.forceCloseCircuitBreaker();
    }
    /**
     * Fuerza la apertura del circuit breaker
     */
    forceOpenCircuitBreaker() {
        this.resilienceWrapper.forceOpenCircuitBreaker();
    }
    /**
     * Resetea las estadísticas de resiliencia
     */
    resetResilienceStats() {
        this.resilienceWrapper.resetStats();
    }
    /**
     * Obtiene el tiempo restante antes del próximo intento del circuit breaker
     */
    getTimeUntilNextAttempt() {
        return this.resilienceWrapper.getTimeUntilNextAttempt();
    }
    /**
     * Verifica si el circuit breaker está listo para half-open
     */
    isReadyForHalfOpen() {
        return this.resilienceWrapper.isReadyForHalfOpen();
    }
    /**
     * Valida el CAE de una factura antes de una operación
     */
    validateCAEBeforeOperation(facturaId, operation) {
        CAEValidator_1.caeValidator.validateBeforeOperation(facturaId, operation);
    }
    /**
     * Valida el CAE de un comprobante antes de una operación
     */
    validateCAEBeforeOperationByComprobante(numero, ptoVta, tipoCbte, operation) {
        CAEValidator_1.caeValidator.validateBeforeOperationByComprobante(numero, ptoVta, tipoCbte, operation);
    }
    /**
     * Obtiene el estado del CAE de una factura
     */
    getCAEStatus(facturaId) {
        return CAEValidator_1.caeValidator.getCAEStatusFromFactura(facturaId);
    }
    /**
     * Obtiene el estado del CAE de un comprobante
     */
    getCAEStatusByComprobante(numero, ptoVta, tipoCbte) {
        return CAEValidator_1.caeValidator.getCAEStatusFromComprobante(numero, ptoVta, tipoCbte);
    }
    /**
     * Busca facturas con CAE próximo a vencer
     */
    findFacturasWithExpiringCAE(warningThresholdHours = 48) {
        return CAEValidator_1.caeValidator.findFacturasWithExpiringCAE(warningThresholdHours);
    }
    /**
     * Busca facturas con CAE vencido
     */
    findFacturasWithExpiredCAE() {
        return CAEValidator_1.caeValidator.findFacturasWithExpiredCAE();
    }
    /**
     * Obtiene estadísticas de validación de tiempo
     */
    getTimeValidationStats() {
        return TimeValidator_1.timeValidator.getStats();
    }
    /**
     * Obtiene el estado de validación de tiempo
     */
    getTimeValidationStatus() {
        return TimeValidator_1.timeValidator.getStatus();
    }
    /**
     * Fuerza una validación de tiempo inmediata
     */
    async forceTimeValidation() {
        return TimeValidator_1.timeValidator.validateSystemTime();
    }
    /**
     * Limpia la instancia de AFIP (útil para testing)
     */
    clearInstance() {
        this.afipInstance = null;
        this.debugLog('Instancia AFIP limpiada');
    }
}
// Exportar instancia singleton
exports.afipService = new AfipService();
// Exportar función legacy para compatibilidad
async function solicitarCAE(comprobante) {
    return exports.afipService.solicitarCAE(comprobante);
}
