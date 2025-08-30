"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.caeValidator = exports.CAEValidator = void 0;
const DbService_1 = require("../../../services/DbService");
const validateCAE_1 = require("./validateCAE");
const AfipLogger_1 = require("./AfipLogger");
class CAEValidator {
    constructor() {
        this.logger = new AfipLogger_1.AfipLogger();
    }
    /**
     * Valida un CAE directamente
     */
    validateCAEDirect(cae, caeVto, context, options = {}) {
        try {
            (0, validateCAE_1.validateCAEAndThrow)(cae, caeVto, options);
            // Log de validación exitosa
            this.logger.logRequest('cae_validation_success', {
                operation: context.operation,
                cae,
                caeVto
            });
        }
        catch (error) {
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
    validateCAEFromFactura(facturaId, context, options = {}) {
        const db = (0, DbService_1.getDb)();
        const factura = db.getFacturaById(facturaId);
        if (!factura) {
            const error = {
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
            const error = {
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
    validateCAEFromComprobante(numero, ptoVta, tipoCbte, context, options = {}) {
        const db = (0, DbService_1.getDb)();
        const factura = db.getFactura(numero, ptoVta, tipoCbte);
        if (!factura) {
            const error = {
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
        this.validateCAEFromFactura(factura.id, {
            ...context,
            numero,
            ptoVta,
            tipoCbte
        }, options);
    }
    /**
     * Middleware para validar CAE antes de operaciones
     */
    validateBeforeOperation(facturaId, operation, options = {}) {
        this.validateCAEFromFactura(facturaId, { operation }, options);
    }
    /**
     * Middleware para validar CAE antes de operaciones por comprobante
     */
    validateBeforeOperationByComprobante(numero, ptoVta, tipoCbte, operation, options = {}) {
        this.validateCAEFromComprobante(numero, ptoVta, tipoCbte, { operation }, options);
    }
    /**
     * Obtiene el estado de un CAE desde una factura
     */
    getCAEStatusFromFactura(facturaId) {
        const db = (0, DbService_1.getDb)();
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
        const status = (0, validateCAE_1.getCAEStatus)(factura.cae, factura.cae_vencimiento);
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
    getCAEStatusFromComprobante(numero, ptoVta, tipoCbte) {
        const db = (0, DbService_1.getDb)();
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
        const status = (0, validateCAE_1.getCAEStatus)(factura.cae, factura.cae_vencimiento);
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
    findFacturasWithExpiringCAE(warningThresholdHours = 48) {
        const db = (0, DbService_1.getDb)();
        const facturas = db.listFacturas();
        const expiringFacturas = [];
        for (const factura of facturas) {
            if (!factura.cae || !factura.cae_vencimiento)
                continue;
            const result = (0, validateCAE_1.validateCAE)(factura.cae, factura.cae_vencimiento, {
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
    findFacturasWithExpiredCAE() {
        const db = (0, DbService_1.getDb)();
        const facturas = db.listFacturas();
        const expiredFacturas = [];
        for (const factura of facturas) {
            if (!factura.cae || !factura.cae_vencimiento)
                continue;
            const result = (0, validateCAE_1.validateCAE)(factura.cae, factura.cae_vencimiento, {
                logWarnings: false
            });
            if (result.isExpired) {
                expiredFacturas.push(factura);
            }
        }
        return expiredFacturas;
    }
}
exports.CAEValidator = CAEValidator;
// Instancia singleton
exports.caeValidator = new CAEValidator();
