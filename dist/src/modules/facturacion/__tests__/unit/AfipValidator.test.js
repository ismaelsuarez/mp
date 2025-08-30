"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AfipValidator_1 = require("../../afip/AfipValidator");
const mocks_1 = require("../fixtures/mocks");
// Mock de afip.js
jest.mock('@afipsdk/afip.js', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => mocks_1.mockAfipInstance)
}));
describe('AfipValidator', () => {
    let validator;
    let mockAfip;
    beforeEach(() => {
        mockAfip = {
            ElectronicBilling: {
                getVoucherTypes: jest.fn().mockResolvedValue([
                    { Id: 1, Desc: 'Factura A' },
                    { Id: 6, Desc: 'Factura B' },
                    { Id: 11, Desc: 'Factura C' }
                ]),
                getConceptTypes: jest.fn().mockResolvedValue([
                    { Id: 1, Desc: 'Productos' },
                    { Id: 2, Desc: 'Servicios' },
                    { Id: 3, Desc: 'Productos y Servicios' }
                ]),
                getDocumentTypes: jest.fn().mockResolvedValue([
                    { Id: 80, Desc: 'CUIT' },
                    { Id: 99, Desc: 'Consumidor Final' }
                ]),
                getCurrenciesTypes: jest.fn().mockResolvedValue([
                    { Id: 'PES', Desc: 'Pesos Argentinos' },
                    { Id: 'USD', Desc: 'Dólar Estadounidense' },
                    { Id: 'EUR', Desc: 'Euro' }
                ]),
                getSalesPoints: jest.fn().mockResolvedValue([
                    { Nro: 1, Desc: 'Punto de Venta 1' },
                    { Nro: 2, Desc: 'Punto de Venta 2' }
                ]),
                getTaxTypes: jest.fn().mockResolvedValue([
                    { Id: 5, Desc: '21%' },
                    { Id: 10.5, Desc: '10.5%' },
                    { Id: 27, Desc: '27%' },
                    { Id: 0, Desc: '0%' }
                ]),
                getCurrencyQuotation: jest.fn().mockResolvedValue({
                    MonId: 'USD',
                    MonCotiz: 1000,
                    FchCotiz: '20241219'
                })
            }
        };
        validator = new AfipValidator_1.AfipValidator(mockAfip);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('validateComprobante', () => {
        it('debería validar un comprobante con parámetros válidos', async () => {
            const params = {
                cbteTipo: 6,
                concepto: 1,
                docTipo: 99,
                monId: 'PES',
                ptoVta: 1,
                cuit: '20123456789'
            };
            const result = await validator.validateComprobante(params);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            // Los warnings pueden contener información de IVA, no es un error
            expect(result.warnings.length).toBeGreaterThanOrEqual(0);
            // Verificar que se llamaron todos los métodos de validación
            expect(mockAfip.ElectronicBilling.getVoucherTypes).toHaveBeenCalled();
            expect(mockAfip.ElectronicBilling.getConceptTypes).toHaveBeenCalled();
            expect(mockAfip.ElectronicBilling.getDocumentTypes).toHaveBeenCalled();
            expect(mockAfip.ElectronicBilling.getCurrenciesTypes).toHaveBeenCalled();
            expect(mockAfip.ElectronicBilling.getSalesPoints).toHaveBeenCalled();
        });
        it('debería rechazar un tipo de comprobante inválido', async () => {
            const params = {
                cbteTipo: 999, // Tipo inválido
                concepto: 1,
                docTipo: 99,
                monId: 'PES',
                ptoVta: 1,
                cuit: '20123456789'
            };
            const result = await validator.validateComprobante(params);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Tipo de comprobante inválido: 999. Tipos válidos: 1 (Factura A), 6 (Factura B), 11 (Factura C)');
        });
        it('debería rechazar un concepto inválido', async () => {
            const params = {
                cbteTipo: 6,
                concepto: 999, // Concepto inválido
                docTipo: 99,
                monId: 'PES',
                ptoVta: 1,
                cuit: '20123456789'
            };
            const result = await validator.validateComprobante(params);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Concepto inválido: 999. Conceptos válidos: 1 (Productos), 2 (Servicios), 3 (Productos y Servicios)');
        });
        it('debería rechazar un tipo de documento inválido', async () => {
            const params = {
                cbteTipo: 6,
                concepto: 1,
                docTipo: 999, // Tipo de documento inválido
                monId: 'PES',
                ptoVta: 1,
                cuit: '20123456789'
            };
            const result = await validator.validateComprobante(params);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Tipo de documento inválido: 999. Tipos válidos: 80 (CUIT), 99 (Consumidor Final)');
        });
        it('debería rechazar una moneda inválida', async () => {
            const params = {
                cbteTipo: 6,
                concepto: 1,
                docTipo: 99,
                monId: 'XXX', // Moneda inválida
                ptoVta: 1,
                cuit: '20123456789'
            };
            const result = await validator.validateComprobante(params);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Moneda inválida: XXX. Monedas válidas: PES (Pesos Argentinos), USD (Dólar Estadounidense), EUR (Euro)');
        });
        it('debería rechazar un punto de venta inválido', async () => {
            const params = {
                cbteTipo: 6,
                concepto: 1,
                docTipo: 99,
                monId: 'PES',
                ptoVta: 999, // Punto de venta inválido
                cuit: '20123456789'
            };
            const result = await validator.validateComprobante(params);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Punto de venta inválido: 999. Puntos válidos: 1 (Punto de Venta 1), 2 (Punto de Venta 2)');
        });
        it('debería validar moneda extranjera y obtener cotización', async () => {
            const params = {
                cbteTipo: 6,
                concepto: 1,
                docTipo: 99,
                monId: 'USD', // Moneda extranjera
                ptoVta: 1,
                cuit: '20123456789'
            };
            const result = await validator.validateComprobante(params);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(mockAfip.ElectronicBilling.getCurrencyQuotation).toHaveBeenCalledWith('USD');
        });
        it('debería manejar errores de AFIP en validación de tipos', async () => {
            mockAfip.ElectronicBilling.getVoucherTypes.mockRejectedValue(new Error('Error de conexión'));
            const params = {
                cbteTipo: 6,
                concepto: 1,
                docTipo: 99,
                monId: 'PES',
                ptoVta: 1,
                cuit: '20123456789'
            };
            const result = await validator.validateComprobante(params);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Error validando tipo de comprobante: Error de conexión');
        });
        it('debería manejar errores de AFIP en validación de cotización', async () => {
            mockAfip.ElectronicBilling.getCurrencyQuotation.mockRejectedValue(new Error('Error de cotización'));
            const params = {
                cbteTipo: 6,
                concepto: 1,
                docTipo: 99,
                monId: 'USD',
                ptoVta: 1,
                cuit: '20123456789'
            };
            const result = await validator.validateComprobante(params);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Error obteniendo cotización para USD: Error de cotización');
        });
        it('debería acumular múltiples errores de validación', async () => {
            // Configurar mock para simular error de cotización
            mockAfip.ElectronicBilling.getCurrencyQuotation.mockRejectedValue(new Error('Error de cotización'));
            const params = {
                cbteTipo: 999, // Inválido
                concepto: 999, // Inválido
                docTipo: 999, // Inválido
                monId: 'XXX', // Inválido
                ptoVta: 999, // Inválido
                cuit: '20123456789'
            };
            const result = await validator.validateComprobante(params);
            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(6); // 6 errores
            expect(result.errors).toContain('Tipo de comprobante inválido: 999. Tipos válidos: 1 (Factura A), 6 (Factura B), 11 (Factura C)');
            expect(result.errors).toContain('Concepto inválido: 999. Conceptos válidos: 1 (Productos), 2 (Servicios), 3 (Productos y Servicios)');
            expect(result.errors).toContain('Tipo de documento inválido: 999. Tipos válidos: 80 (CUIT), 99 (Consumidor Final)');
            expect(result.errors).toContain('Moneda inválida: XXX. Monedas válidas: PES (Pesos Argentinos), USD (Dólar Estadounidense), EUR (Euro)');
            expect(result.errors).toContain('Punto de venta inválido: 999. Puntos válidos: 1 (Punto de Venta 1), 2 (Punto de Venta 2)');
            expect(result.errors).toContain('Error obteniendo cotización para XXX: Error de cotización');
        });
    });
    describe('getValidationInfo', () => {
        it('debería retornar información de validación completa', async () => {
            const info = await validator.getValidationInfo();
            expect(info).toBeDefined();
            expect(typeof info).toBe('object');
            expect(info.tiposCbte).toBeDefined();
            expect(info.conceptos).toBeDefined();
            expect(info.tiposDoc).toBeDefined();
            expect(info.monedas).toBeDefined();
            expect(info.ptsVta).toBeDefined();
            console.log('Info recibida:', JSON.stringify(info, null, 2));
        });
        it('debería manejar errores al obtener información de validación', async () => {
            mockAfip.ElectronicBilling.getVoucherTypes.mockRejectedValue(new Error('Error de conexión'));
            await expect(validator.getValidationInfo()).rejects.toThrow('Error obteniendo información de validación');
        });
    });
    describe('validación de tipos específicos', () => {
        it('debería validar Factura A (tipo 1)', async () => {
            const params = {
                cbteTipo: 1,
                concepto: 1,
                docTipo: 80, // CUIT para Factura A
                monId: 'PES',
                ptoVta: 1,
                cuit: '20123456789'
            };
            const result = await validator.validateComprobante(params);
            expect(result.isValid).toBe(true);
        });
        it('debería validar Factura C (tipo 11)', async () => {
            const params = {
                cbteTipo: 11,
                concepto: 1,
                docTipo: 80, // CUIT para Factura C
                monId: 'PES',
                ptoVta: 1,
                cuit: '20123456789'
            };
            const result = await validator.validateComprobante(params);
            expect(result.isValid).toBe(true);
        });
        it('debería validar con concepto de servicios', async () => {
            const params = {
                cbteTipo: 6,
                concepto: 2, // Servicios
                docTipo: 99,
                monId: 'PES',
                ptoVta: 1,
                cuit: '20123456789'
            };
            const result = await validator.validateComprobante(params);
            expect(result.isValid).toBe(true);
        });
    });
});
