// Tests de AfipService.solicitarCAE: Observaciones y Fechas de Servicio

// Mocks de dependencias internas
jest.mock('../../afip/CertificateValidator', () => ({
  CertificateValidator: {
    validateCertificate: jest.fn().mockReturnValue({ valido: true, diasRestantes: 365 })
  }
}));

jest.mock('../../utils/TimeValidator', () => ({
  validateSystemTimeAndThrow: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../afip/helpers', () => ({
  AfipHelpers: {
    validateComprobante: jest.fn().mockReturnValue([]),
    buildIvaArray: jest.fn().mockReturnValue([]),
    buildQrUrl: jest.fn().mockReturnValue('qr-url'),
    mapTipoCbte: jest.fn().mockImplementation((t: any) => Number(t) || 11),
    formatNumber: jest.fn().mockImplementation((n: any) => Number(n))
  }
}));

// Idempotency y Resilience simplificados
jest.mock('../../afip/IdempotencyManager', () => ({
  IdempotencyManager: jest.fn().mockImplementation(() => ({
    checkIdempotency: jest.fn().mockResolvedValue({ isDuplicate: false, shouldProceed: true }),
    markAsApproved: jest.fn().mockResolvedValue(undefined)
  }))
}));

jest.mock('../../afip/ResilienceWrapper', () => ({
  ResilienceWrapper: jest.fn().mockImplementation(() => ({
    execute: (fn: any) => fn(),
    getStats: () => ({}),
    getCircuitBreakerState: () => ({}),
    getCircuitBreakerStats: () => ({}),
    forceCloseCircuitBreaker: () => undefined,
    forceOpenCircuitBreaker: () => undefined,
    resetStats: () => undefined,
    isReadyForHalfOpen: () => true,
    getTimeUntilNextAttempt: () => 0
  }))
}));

jest.mock('../../afip/config', () => ({
  getResilienceConfig: () => ({})
}));

// Mock AfipValidator para no depender de métodos FEParamGet* en estas pruebas
jest.mock('../../afip/AfipValidator', () => ({
  AfipValidator: jest.fn().mockImplementation(() => ({
    validateComprobante: jest.fn().mockResolvedValue({ isValid: true, errors: [], warnings: [] }),
    getValidationInfo: jest.fn().mockResolvedValue({})
  }))
}));

// Mock de instancia AFIP via AfipInstanceManager
let __afipMock: any = null;
jest.mock('../../afip/AfipInstanceManager', () => ({
  AfipInstanceManager: jest.fn().mockImplementation(() => ({
    getInstance: async () => __afipMock,
    clearCache: () => undefined
  }))
}));

// Mock de DB
jest.mock('../../../../services/DbService', () => ({
  getDb: () => ({
    getAfipConfig: () => ({
      cuit: '30708673435',
      pto_vta: 16,
      cert_path: 'X',
      key_path: 'Y',
      entorno: 'produccion'
    }),
    getEmpresaConfig: () => ({ condicion_iva: 'RI' })
  })
}));

// Import después de mocks
import { afipService } from '../../afipService';

describe('AfipService.solicitarCAE - Observaciones y Fechas de Servicio', () => {
  test('propaga Observaciones desde createVoucher', async () => {
    let receivedRequest: any = null;
    __afipMock = {
      ElectronicBilling: {
        getLastVoucher: jest.fn().mockResolvedValue(100),
        createVoucher: jest.fn().mockImplementation(async (req: any) => {
          receivedRequest = req;
          return {
            CAE: '123',
            CAEFchVto: '20251231',
            Observaciones: [{ Code: 1001, Msg: 'Obs test' }]
          };
        })
      }
    };

    const result = await afipService.solicitarCAE({
      tipo: 11,
      puntoVenta: 16,
      fecha: '20250101',
      concepto: 1,
      docTipo: 99,
      monId: 'PES',
      totales: { total: 121, neto: 100, iva: 21 },
      items: [],
      empresa: { cuit: '30708673435', razonSocial: 'Test SA' }
    } as any);

    expect(result.observaciones?.[0].Code).toBe(1001);
    expect(result.observaciones?.[0].Msg).toBe('Obs test');
    expect(receivedRequest?.CbteTipo).toBe(11);
  });

  test('incluye FchServDesde/Hasta/Vto cuando Concepto = 2 (Servicios)', async () => {
    let receivedRequest: any = null;
    __afipMock = {
      ElectronicBilling: {
        getLastVoucher: jest.fn().mockResolvedValue(200),
        createVoucher: jest.fn().mockImplementation(async (req: any) => {
          receivedRequest = req;
          return { CAE: '456', CAEFchVto: '20251231' };
        })
      }
    };

    await afipService.solicitarCAE({
      tipo: 11,
      puntoVenta: 16,
      fecha: '20250115',
      concepto: 2,
      FchServDesde: '2025-01-01',
      FchServHasta: '2025-01-31',
      FchVtoPago: '2025-02-10',
      docTipo: 99,
      monId: 'PES',
      totales: { total: 121, neto: 100, iva: 21 },
      items: [],
      empresa: { cuit: '30708673435', razonSocial: 'Test SA' }
    } as any);

    expect(receivedRequest.FchServDesde).toBe('20250101');
    expect(receivedRequest.FchServHasta).toBe('20250131');
    expect(receivedRequest.FchVtoPago).toBe('20250210');
  });
});


