"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AfipValidator = void 0;
const AfipLogger_1 = require("./AfipLogger");
class AfipValidator {
    debugLog(...args) {
        if (this.DEBUG_FACT) {
            // eslint-disable-next-line no-console
            console.log('[FACT][AfipValidator]', ...args);
        }
    }
    constructor(afipInstance) {
        this.DEBUG_FACT = process.env.FACTURACION_DEBUG === 'true';
        this.afip = afipInstance;
        this.logger = new AfipLogger_1.AfipLogger();
    }
    /**
     * Valida todos los parámetros de un comprobante usando FEParamGet*
     */
    async validateComprobante(params) {
        const errors = [];
        const warnings = [];
        try {
            this.logger.logRequest('validateComprobante', { params });
            this.debugLog('Validando comprobante (FEParamGet*)', params);
            // 1. Validar tipos de comprobante
            await this.validateTipoComprobante(params.cbteTipo, errors);
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
            const result = {
                isValid: errors.length === 0,
                errors,
                warnings
            };
            this.logger.logResponse('validateComprobante', result);
            this.debugLog('Resultado validación FEParamGet*', result);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.logError('validateComprobante', error instanceof Error ? error : new Error(errorMessage), { params });
            return {
                isValid: false,
                errors: [`Error de validación: ${errorMessage}`],
                warnings: []
            };
        }
    }
    /**
     * Valida el tipo de comprobante usando FEParamGetTiposCbte
     */
    async validateTipoComprobante(cbteTipo, errors) {
        try {
            const tiposCbte = await this.afip.ElectronicBilling.getVoucherTypes();
            const tipoValido = tiposCbte.some((t) => Number(t.Id) === cbteTipo);
            if (!tipoValido) {
                const tiposDisponibles = tiposCbte.map((t) => `${t.Id} (${t.Desc})`).join(', ');
                errors.push(`Tipo de comprobante inválido: ${cbteTipo}. Tipos válidos: ${tiposDisponibles}`);
            }
        }
        catch (error) {
            errors.push(`Error validando tipo de comprobante: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Valida el concepto usando FEParamGetTiposConcepto
     */
    async validateConcepto(concepto, errors) {
        try {
            const conceptos = await this.afip.ElectronicBilling.getConceptTypes();
            const conceptoValido = conceptos.some((c) => Number(c.Id) === concepto);
            if (!conceptoValido) {
                const conceptosDisponibles = conceptos.map((c) => `${c.Id} (${c.Desc})`).join(', ');
                errors.push(`Concepto inválido: ${concepto}. Conceptos válidos: ${conceptosDisponibles}`);
            }
        }
        catch (error) {
            errors.push(`Error validando concepto: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Valida el tipo de documento usando FEParamGetTiposDoc
     */
    async validateTipoDocumento(docTipo, errors) {
        try {
            const tiposDoc = await this.afip.ElectronicBilling.getDocumentTypes();
            const tipoValido = tiposDoc.some((d) => Number(d.Id) === docTipo);
            if (!tipoValido) {
                const tiposDisponibles = tiposDoc.map((d) => `${d.Id} (${d.Desc})`).join(', ');
                errors.push(`Tipo de documento inválido: ${docTipo}. Tipos válidos: ${tiposDisponibles}`);
            }
        }
        catch (error) {
            errors.push(`Error validando tipo de documento: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Valida la moneda usando FEParamGetTiposMonedas
     */
    async validateMoneda(monId, errors) {
        try {
            const monedas = await this.afip.ElectronicBilling.getCurrenciesTypes();
            const monedaValida = monedas.some((m) => m.Id === monId);
            if (!monedaValida) {
                const monedasDisponibles = monedas.map((m) => `${m.Id} (${m.Desc})`).join(', ');
                errors.push(`Moneda inválida: ${monId}. Monedas válidas: ${monedasDisponibles}`);
            }
        }
        catch (error) {
            errors.push(`Error validando moneda: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Valida el punto de venta usando FEParamGetPtosVenta
     */
    async validatePuntoVenta(ptoVta, errors) {
        try {
            const ptosVta = await this.afip.ElectronicBilling.getSalesPoints();
            const ptoValido = ptosVta.some((p) => Number(p.Nro) === ptoVta);
            if (!ptoValido) {
                const ptosDisponibles = ptosVta.map((p) => `${p.Nro} (${p.Desc})`).join(', ');
                errors.push(`Punto de venta inválido: ${ptoVta}. Puntos válidos: ${ptosDisponibles}`);
            }
        }
        catch (error) {
            errors.push(`Error validando punto de venta: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Valida la cotización usando FEParamGetCotizacion
     */
    async validateCotizacion(monId, errors, warnings) {
        try {
            const cotizacion = await this.afip.ElectronicBilling.getCurrencyQuotation(monId);
            if (!cotizacion || !cotizacion.MonCotiz || Number(cotizacion.MonCotiz) <= 0) {
                errors.push(`No se pudo obtener cotización válida para moneda: ${monId}`);
            }
            else {
                warnings.push(`Cotización obtenida para ${monId}: ${cotizacion.MonCotiz}`);
            }
        }
        catch (error) {
            errors.push(`Error obteniendo cotización para ${monId}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Valida tipos de IVA (solo para información)
     */
    async validateTiposIva(warnings) {
        try {
            const tiposIva = await this.afip.ElectronicBilling.getTaxTypes();
            warnings.push(`Tipos de IVA disponibles: ${tiposIva.map((i) => `${i.Id} (${i.Desc})`).join(', ')}`);
        }
        catch (error) {
            warnings.push(`No se pudieron obtener tipos de IVA: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Obtiene información de validación para debugging
     */
    async getValidationInfo() {
        try {
            const info = {
                tiposCbte: await this.afip.ElectronicBilling.getVoucherTypes(),
                conceptos: await this.afip.ElectronicBilling.getConceptTypes(),
                tiposDoc: await this.afip.ElectronicBilling.getDocumentTypes(),
                monedas: await this.afip.ElectronicBilling.getCurrenciesTypes(),
                ptosVta: await this.afip.ElectronicBilling.getSalesPoints(),
                tiposIva: await this.afip.ElectronicBilling.getTaxTypes()
            };
            this.logger.logResponse('getValidationInfo', info);
            return info;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.logError('getValidationInfo', error instanceof Error ? error : new Error(errorMessage));
            throw new Error(`Error obteniendo información de validación: ${errorMessage}`);
        }
    }
}
exports.AfipValidator = AfipValidator;
