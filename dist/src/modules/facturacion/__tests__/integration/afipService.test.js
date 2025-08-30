"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const afipService_1 = require("../../afipService");
const comprobantes_1 = require("../fixtures/comprobantes");
const mocks_1 = require("../fixtures/mocks");
// Mock de todos los componentes
jest.mock('@afipsdk/afip.js', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => mocks_1.mockAfipInstance)
}));
jest.mock('../../utils/TimeValidator', () => ({
    timeValidator: mocks_1.mockTimeValidator,
    validateSystemTimeAndThrow: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../../afip/IdempotencyManager', () => ({
    IdempotencyManager: jest.fn().mockImplementation(() => mocks_1.mockIdempotencyManager)
}));
jest.mock('../../afip/ResilienceWrapper', () => ({
    ResilienceWrapper: jest.fn().mockImplementation(() => ({
        execute: jest.fn().mockImplementation(async (operation) => await operation())
    }))
}));
jest.mock('../../afip/AfipValidator', () => ({
    AfipValidator: jest.fn().mockImplementation(() => ({
        validateComprobante: jest.fn().mockResolvedValue({
            isValid: true,
            errors: [],
            warnings: []
        })
    }))
}));
jest.mock('../../../services/DbService', () => ({
    getDb: jest.fn(() => ({
        getAfipConfig: jest.fn().mockReturnValue({
            cuit: '20123456789',
            cert_path: './test-cert.crt',
            key_path: './test-key.key',
            entorno: 'testing',
            pto_vta: 1
        })
    }))
}));
describe('AfipService - Integración', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    describe('solicitarCAE', () => {
        it('debería emitir un comprobante válido exitosamente', async () => {
            const result = await afipService_1.afipService.solicitarCAE(comprobantes_1.comprobanteValido);
            expect(result).toHaveProperty('cae');
            expect(result).toHaveProperty('vencimientoCAE');
            expect(result).toHaveProperty('qrData');
            expect(result.cae).toBe('12345678901234');
            expect(result.vencimientoCAE).toBe('20250131');
            expect(result.qrData).toContain('https://www.afip.gob.ar/fe/qr/');
        });
        it('debería retornar CAE existente para comprobante duplicado', async () => {
            // Configurar mock para simular duplicado exitoso
            mocks_1.mockIdempotencyManager.checkIdempotency.mockResolvedValue({
                isDuplicate: true,
                shouldProceed: false,
                existingCae: '12345678901234',
                existingCaeVto: '20250131',
                error: null
            });
            const result = await afipService_1.afipService.solicitarCAE(comprobantes_1.comprobanteDuplicado);
            expect(result.cae).toBe('12345678901234');
            expect(result.vencimientoCAE).toBe('20250131');
            expect(mocks_1.mockIdempotencyManager.checkIdempotency).toHaveBeenCalled();
        });
        it('debería manejar errores de validación AFIP', async () => {
            // Mock de validación fallida
            const { AfipValidator } = require('../../afip/AfipValidator');
            AfipValidator.mockImplementation(() => ({
                validateComprobante: jest.fn().mockResolvedValue({
                    isValid: false,
                    errors: ['Tipo de comprobante inválido'],
                    warnings: []
                })
            }));
            await expect(afipService_1.afipService.solicitarCAE(comprobantes_1.comprobanteValido))
                .rejects.toThrow('Validación AFIP falló');
        });
        it('debería manejar errores de idempotencia', async () => {
            mocks_1.mockIdempotencyManager.checkIdempotency.mockResolvedValue({
                isDuplicate: false,
                shouldProceed: false,
                existingCae: null,
                existingCaeVto: null,
                error: 'Error de base de datos'
            });
            await expect(afipService_1.afipService.solicitarCAE(comprobantes_1.comprobanteValido))
                .rejects.toThrow('Error de idempotencia');
        });
        it('debería manejar errores de AFIP en createVoucher', async () => {
            // Mock de error en createVoucher
            mocks_1.mockAfipInstance.ElectronicBilling.createVoucher.mockRejectedValue(new Error('Error de AFIP'));
            await expect(afipService_1.afipService.solicitarCAE(comprobantes_1.comprobanteValido))
                .rejects.toThrow('Error solicitando CAE');
        });
        it('debería marcar como fallido cuando AFIP falla', async () => {
            mocks_1.mockAfipInstance.ElectronicBilling.createVoucher.mockRejectedValue(new Error('Error de AFIP'));
            try {
                await afipService_1.afipService.solicitarCAE(comprobantes_1.comprobanteValido);
            }
            catch (error) {
                // Esperado que falle
            }
            expect(mocks_1.mockIdempotencyManager.markAsFailed).toHaveBeenCalled();
        });
    });
    describe('solicitarCAEConProvincias', () => {
        it('debería procesar comprobante con AFIP y provincial exitosamente', async () => {
            const result = await afipService_1.afipService.solicitarCAEConProvincias(comprobantes_1.comprobanteValido);
            expect(result).toHaveProperty('afip');
            expect(result).toHaveProperty('provincial');
            expect(result).toHaveProperty('estado');
            expect(result.afip.success).toBe(true);
            expect(result.provincial.success).toBe(true);
            expect(result.estado).toBe('AFIP_OK_PROV_OK');
        });
        it('debería manejar fallo de AFIP y retornar estado correcto', async () => {
            mocks_1.mockAfipInstance.ElectronicBilling.createVoucher.mockRejectedValue(new Error('Error de AFIP'));
            const result = await afipService_1.afipService.solicitarCAEConProvincias(comprobantes_1.comprobanteValido);
            expect(result.afip.success).toBe(false);
            expect(result.provincial).toBeNull();
            expect(result.estado).toBe('AFIP_FAIL');
        });
    });
    describe('checkServerStatus', () => {
        it('debería verificar estado de servidores AFIP', async () => {
            const status = await afipService_1.afipService.checkServerStatus();
            expect(status).toHaveProperty('appserver');
            expect(status).toHaveProperty('dbserver');
            expect(status).toHaveProperty('authserver');
            expect(status.appserver).toBe('OK');
            expect(status.dbserver).toBe('OK');
            expect(status.authserver).toBe('OK');
        });
    });
    describe('validarCertificado', () => {
        it('debería validar certificado configurado', () => {
            const certInfo = afipService_1.afipService.validarCertificado();
            expect(certInfo).toHaveProperty('valido');
            expect(certInfo).toHaveProperty('fechaExpiracion');
            expect(certInfo).toHaveProperty('diasRestantes');
        });
    });
    describe('getUltimoAutorizado', () => {
        it('debería obtener último número autorizado', async () => {
            const ultimo = await afipService_1.afipService.getUltimoAutorizado(1, 'B');
            expect(ultimo).toBe(1000);
            expect(mocks_1.mockAfipInstance.ElectronicBilling.getLastVoucher).toHaveBeenCalledWith(1, 6);
        });
    });
    describe('getLogs', () => {
        it('debería retornar logs de AFIP', () => {
            const logs = afipService_1.afipService.getLogs();
            expect(Array.isArray(logs)).toBe(true);
        });
    });
    describe('getValidationInfo', () => {
        it('debería obtener información de validación', async () => {
            const info = await afipService_1.afipService.getValidationInfo();
            expect(info).toHaveProperty('voucherTypes');
            expect(info).toHaveProperty('conceptTypes');
            expect(info).toHaveProperty('documentTypes');
        });
    });
    describe('estadísticas', () => {
        it('debería obtener estadísticas de idempotencia', () => {
            const stats = afipService_1.afipService.getIdempotencyStats();
            expect(stats).toHaveProperty('pending');
            expect(stats).toHaveProperty('approved');
            expect(stats).toHaveProperty('failed');
        });
        it('debería obtener estadísticas de validación de tiempo', () => {
            const stats = afipService_1.afipService.getTimeValidationStats();
            expect(stats).toHaveProperty('totalValidations');
            expect(stats).toHaveProperty('averageDrift');
            expect(stats).toHaveProperty('lastValidation');
        });
        it('debería obtener estado de validación de tiempo', () => {
            const status = afipService_1.afipService.getTimeValidationStatus();
            expect(status).toHaveProperty('isConfigured');
            expect(status).toHaveProperty('lastValidationTime');
            expect(status).toHaveProperty('isLastValidationValid');
        });
    });
    describe('limpieza', () => {
        it('debería limpiar comprobantes antiguos', () => {
            const deletedCount = afipService_1.afipService.cleanupIdempotency();
            expect(typeof deletedCount).toBe('number');
            expect(deletedCount).toBeGreaterThanOrEqual(0);
        });
    });
    describe('obtener comprobantes por estado', () => {
        it('debería obtener comprobantes pendientes', () => {
            const comprobantes = afipService_1.afipService.getComprobantesByEstado('PENDING');
            expect(Array.isArray(comprobantes)).toBe(true);
        });
        it('debería obtener comprobantes aprobados', () => {
            const comprobantes = afipService_1.afipService.getComprobantesByEstado('APPROVED');
            expect(Array.isArray(comprobantes)).toBe(true);
        });
        it('debería obtener comprobantes fallidos', () => {
            const comprobantes = afipService_1.afipService.getComprobantesByEstado('FAILED');
            expect(Array.isArray(comprobantes)).toBe(true);
        });
    });
    describe('validación de tiempo', () => {
        it('debería forzar validación de tiempo', async () => {
            const result = await afipService_1.afipService.forceTimeValidation();
            expect(result).toHaveProperty('isValid');
            expect(result).toHaveProperty('drift');
            expect(result).toHaveProperty('systemTime');
            expect(result).toHaveProperty('ntpTime');
        });
    });
    describe('manejo de errores', () => {
        it('debería manejar configuración AFIP faltante', async () => {
            const { getDb } = require('../../../services/DbService');
            getDb.mockReturnValue({
                getAfipConfig: jest.fn().mockReturnValue(null)
            });
            await expect(afipService_1.afipService.solicitarCAE(comprobantes_1.comprobanteValido))
                .rejects.toThrow('Falta configurar AFIP');
        });
        it('debería manejar errores de certificado inválido', async () => {
            // Mock de certificado inválido
            const { CertificateValidator } = require('../../afip/CertificateValidator');
            CertificateValidator.validateCertificate = jest.fn().mockReturnValue({
                valido: false,
                error: 'Certificado expirado'
            });
            await expect(afipService_1.afipService.solicitarCAE(comprobantes_1.comprobanteValido))
                .rejects.toThrow('Certificado inválido');
        });
    });
});
