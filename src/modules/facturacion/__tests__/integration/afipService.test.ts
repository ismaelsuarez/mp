import { afipService } from '../../afipService';
import { comprobanteValido, comprobanteDuplicado } from '../fixtures/comprobantes';
import { mockAfipInstance, mockTimeValidator, mockIdempotencyManager } from '../fixtures/mocks';

// Mock de todos los componentes
jest.mock('@afipsdk/afip.js', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockAfipInstance)
}));

jest.mock('../../utils/TimeValidator', () => ({
  timeValidator: mockTimeValidator,
  validateSystemTimeAndThrow: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../afip/IdempotencyManager', () => ({
  IdempotencyManager: jest.fn().mockImplementation(() => mockIdempotencyManager)
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
      const result = await afipService.solicitarCAE(comprobanteValido);

      expect(result).toHaveProperty('cae');
      expect(result).toHaveProperty('vencimientoCAE');
      expect(result).toHaveProperty('qrData');
      expect(result.cae).toBe('12345678901234');
      expect(result.vencimientoCAE).toBe('20250131');
      expect(result.qrData).toContain('https://www.afip.gob.ar/fe/qr/');
    });

    it('debería retornar CAE existente para comprobante duplicado', async () => {
      // Configurar mock para simular duplicado exitoso
      mockIdempotencyManager.checkIdempotency.mockResolvedValue({
        isDuplicate: true,
        shouldProceed: false,
        existingCae: '12345678901234',
        existingCaeVto: '20250131',
        error: null
      });

      const result = await afipService.solicitarCAE(comprobanteDuplicado);

      expect(result.cae).toBe('12345678901234');
      expect(result.vencimientoCAE).toBe('20250131');
      expect(mockIdempotencyManager.checkIdempotency).toHaveBeenCalled();
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

      await expect(afipService.solicitarCAE(comprobanteValido))
        .rejects.toThrow('Validación AFIP falló');
    });

    it('debería manejar errores de idempotencia', async () => {
      mockIdempotencyManager.checkIdempotency.mockResolvedValue({
        isDuplicate: false,
        shouldProceed: false,
        existingCae: null,
        existingCaeVto: null,
        error: 'Error de base de datos'
      });

      await expect(afipService.solicitarCAE(comprobanteValido))
        .rejects.toThrow('Error de idempotencia');
    });

    it('debería manejar errores de AFIP en createVoucher', async () => {
      // Mock de error en createVoucher
      mockAfipInstance.ElectronicBilling.createVoucher.mockRejectedValue(
        new Error('Error de AFIP')
      );

      await expect(afipService.solicitarCAE(comprobanteValido))
        .rejects.toThrow('Error solicitando CAE');
    });

    it('debería marcar como fallido cuando AFIP falla', async () => {
      mockAfipInstance.ElectronicBilling.createVoucher.mockRejectedValue(
        new Error('Error de AFIP')
      );

      try {
        await afipService.solicitarCAE(comprobanteValido);
      } catch (error) {
        // Esperado que falle
      }

      expect(mockIdempotencyManager.markAsFailed).toHaveBeenCalled();
    });
  });

  describe('solicitarCAEConProvincias', () => {
    it('debería procesar comprobante con AFIP y provincial exitosamente', async () => {
      const result = await afipService.solicitarCAEConProvincias(comprobanteValido);

      expect(result).toHaveProperty('afip');
      expect(result).toHaveProperty('provincial');
      expect(result).toHaveProperty('estado');
      expect(result.afip.success).toBe(true);
      expect(result.provincial.success).toBe(true);
      expect(result.estado).toBe('AFIP_OK_PROV_OK');
    });

    it('debería manejar fallo de AFIP y retornar estado correcto', async () => {
      mockAfipInstance.ElectronicBilling.createVoucher.mockRejectedValue(
        new Error('Error de AFIP')
      );

      const result = await afipService.solicitarCAEConProvincias(comprobanteValido);

      expect(result.afip.success).toBe(false);
      expect(result.provincial).toBeNull();
      expect(result.estado).toBe('AFIP_FAIL');
    });
  });

  describe('checkServerStatus', () => {
    it('debería verificar estado de servidores AFIP', async () => {
      const status = await afipService.checkServerStatus();

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
      const certInfo = afipService.validarCertificado();

      expect(certInfo).toHaveProperty('valido');
      expect(certInfo).toHaveProperty('fechaExpiracion');
      expect(certInfo).toHaveProperty('diasRestantes');
    });
  });

  describe('getUltimoAutorizado', () => {
    it('debería obtener último número autorizado', async () => {
      const ultimo = await afipService.getUltimoAutorizado(1, 'B');

      expect(ultimo).toBe(1000);
      expect(mockAfipInstance.ElectronicBilling.getLastVoucher).toHaveBeenCalledWith(1, 6);
    });
  });

  describe('getLogs', () => {
    it('debería retornar logs de AFIP', () => {
      const logs = afipService.getLogs();

      expect(Array.isArray(logs)).toBe(true);
    });
  });

  describe('getValidationInfo', () => {
    it('debería obtener información de validación', async () => {
      const info = await afipService.getValidationInfo();

      expect(info).toHaveProperty('voucherTypes');
      expect(info).toHaveProperty('conceptTypes');
      expect(info).toHaveProperty('documentTypes');
    });
  });

  describe('estadísticas', () => {
    it('debería obtener estadísticas de idempotencia', () => {
      const stats = afipService.getIdempotencyStats();

      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('approved');
      expect(stats).toHaveProperty('failed');
    });

    it('debería obtener estadísticas de validación de tiempo', () => {
      const stats = afipService.getTimeValidationStats();

      expect(stats).toHaveProperty('totalValidations');
      expect(stats).toHaveProperty('averageDrift');
      expect(stats).toHaveProperty('lastValidation');
    });

    it('debería obtener estado de validación de tiempo', () => {
      const status = afipService.getTimeValidationStatus();

      expect(status).toHaveProperty('isConfigured');
      expect(status).toHaveProperty('lastValidationTime');
      expect(status).toHaveProperty('isLastValidationValid');
    });
  });

  describe('limpieza', () => {
    it('debería limpiar comprobantes antiguos', () => {
      const deletedCount = afipService.cleanupIdempotency();

      expect(typeof deletedCount).toBe('number');
      expect(deletedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('obtener comprobantes por estado', () => {
    it('debería obtener comprobantes pendientes', () => {
      const comprobantes = afipService.getComprobantesByEstado('PENDING');

      expect(Array.isArray(comprobantes)).toBe(true);
    });

    it('debería obtener comprobantes aprobados', () => {
      const comprobantes = afipService.getComprobantesByEstado('APPROVED');

      expect(Array.isArray(comprobantes)).toBe(true);
    });

    it('debería obtener comprobantes fallidos', () => {
      const comprobantes = afipService.getComprobantesByEstado('FAILED');

      expect(Array.isArray(comprobantes)).toBe(true);
    });
  });

  describe('validación de tiempo', () => {
    it('debería forzar validación de tiempo', async () => {
      const result = await afipService.forceTimeValidation();

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

      await expect(afipService.solicitarCAE(comprobanteValido))
        .rejects.toThrow('Falta configurar AFIP');
    });

    it('debería manejar errores de certificado inválido', async () => {
      // Mock de certificado inválido
      const { CertificateValidator } = require('../../afip/CertificateValidator');
      CertificateValidator.validateCertificate = jest.fn().mockReturnValue({
        valido: false,
        error: 'Certificado expirado'
      });

      await expect(afipService.solicitarCAE(comprobanteValido))
        .rejects.toThrow('Certificado inválido');
    });
  });
});
