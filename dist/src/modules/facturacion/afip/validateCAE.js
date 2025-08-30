"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCAE = validateCAE;
exports.validateCAEAndThrow = validateCAEAndThrow;
exports.getCAEStatus = getCAEStatus;
exports.formatCAEExpiredError = formatCAEExpiredError;
exports.formatCAEExpiringWarning = formatCAEExpiringWarning;
const AfipLogger_1 = require("./AfipLogger");
/**
 * Valida si un CAE está vencido o próximo a vencer
 */
function validateCAE(cae, caeVto, options = {}) {
    const { warningThresholdHours = 48, logWarnings = true } = options;
    const logger = new AfipLogger_1.AfipLogger();
    const hoy = new Date();
    const vto = new Date(caeVto);
    // Validar que la fecha de vencimiento sea válida
    if (isNaN(vto.getTime())) {
        const error = `Fecha de vencimiento CAE inválida: ${caeVto}`;
        logger.logError('validateCAE_invalid_date', new Error(error), { cae, caeVto });
        return {
            isValid: false,
            isExpired: true,
            isExpiringSoon: false,
            hoursUntilExpiry: 0,
            daysUntilExpiry: 0,
            error
        };
    }
    // Calcular tiempo restante
    const diff = vto.getTime() - hoy.getTime();
    const hoursUntilExpiry = diff / (1000 * 60 * 60);
    const daysUntilExpiry = hoursUntilExpiry / 24;
    // Verificar si está vencido
    if (hoy > vto) {
        const error = `El CAE ${cae} está vencido desde ${Math.abs(daysUntilExpiry).toFixed(1)} días`;
        logger.logError('validateCAE_expired', new Error(error), {
            cae,
            caeVto,
            daysExpired: Math.abs(daysUntilExpiry),
            hoursExpired: Math.abs(hoursUntilExpiry)
        });
        return {
            isValid: false,
            isExpired: true,
            isExpiringSoon: false,
            hoursUntilExpiry: 0,
            daysUntilExpiry: 0,
            error
        };
    }
    // Verificar si está próximo a vencer
    const isExpiringSoon = hoursUntilExpiry < warningThresholdHours;
    if (isExpiringSoon && logWarnings) {
        const warning = `CAE ${cae} próximo a vencer: ${daysUntilExpiry.toFixed(1)} días restantes (vence el ${caeVto})`;
        logger.logRequest('validateCAE_expiring_soon', {
            cae,
            caeVto,
            daysUntilExpiry: daysUntilExpiry.toFixed(1),
            hoursUntilExpiry: hoursUntilExpiry.toFixed(1),
            warning
        });
        // También loggear como warning para mayor visibilidad
        console.warn(`[AFIP][ALERTA] ${warning}`);
    }
    return {
        isValid: true,
        isExpired: false,
        isExpiringSoon,
        hoursUntilExpiry,
        daysUntilExpiry,
        warning: isExpiringSoon ? `CAE próximo a vencer: ${daysUntilExpiry.toFixed(1)} días restantes` : undefined
    };
}
/**
 * Valida un CAE y lanza error si está vencido
 */
function validateCAEAndThrow(cae, caeVto, options = {}) {
    const result = validateCAE(cae, caeVto, options);
    if (!result.isValid) {
        throw new Error(result.error || 'CAE inválido');
    }
}
/**
 * Obtiene información detallada sobre el estado de un CAE
 */
function getCAEStatus(cae, caeVto) {
    const result = validateCAE(cae, caeVto, { logWarnings: false });
    if (result.isExpired) {
        return {
            status: 'EXPIRED',
            message: result.error || 'CAE vencido',
            details: {
                cae,
                vencimiento: caeVto,
                diasRestantes: 0,
                horasRestantes: 0
            }
        };
    }
    if (result.isExpiringSoon) {
        return {
            status: 'EXPIRING_SOON',
            message: `CAE próximo a vencer: ${result.daysUntilExpiry.toFixed(1)} días restantes`,
            details: {
                cae,
                vencimiento: caeVto,
                diasRestantes: result.daysUntilExpiry,
                horasRestantes: result.hoursUntilExpiry
            }
        };
    }
    if (!result.isValid) {
        return {
            status: 'INVALID_DATE',
            message: result.error || 'Fecha de vencimiento inválida',
            details: {
                cae,
                vencimiento: caeVto,
                diasRestantes: 0,
                horasRestantes: 0
            }
        };
    }
    return {
        status: 'VALID',
        message: `CAE válido: ${result.daysUntilExpiry.toFixed(1)} días restantes`,
        details: {
            cae,
            vencimiento: caeVto,
            diasRestantes: result.daysUntilExpiry,
            horasRestantes: result.hoursUntilExpiry
        }
    };
}
/**
 * Formatea un mensaje de error para CAE vencido
 */
function formatCAEExpiredError(cae, caeVto) {
    const result = validateCAE(cae, caeVto, { logWarnings: false });
    if (result.isExpired) {
        return `El CAE de esta factura está vencido. CAE: ${cae}, Vencimiento: ${caeVto}`;
    }
    return `Error de validación CAE: ${result.error || 'CAE inválido'}`;
}
/**
 * Formatea un mensaje de advertencia para CAE próximo a vencer
 */
function formatCAEExpiringWarning(cae, caeVto) {
    const result = validateCAE(cae, caeVto, { logWarnings: false });
    if (result.isExpiringSoon) {
        return `CAE próximo a vencer: ${result.daysUntilExpiry.toFixed(1)} días restantes. CAE: ${cae}, Vencimiento: ${caeVto}`;
    }
    return '';
}
