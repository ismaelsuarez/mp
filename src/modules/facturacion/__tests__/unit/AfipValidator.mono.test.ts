import { AfipValidator } from '../../afip/AfipValidator';

// Mock DbService para emisor Monotributo
jest.mock('../../../../services/DbService', () => ({
  getDb: () => ({
    getEmpresaConfig: () => ({ condicion_iva: 'MONO' })
  })
}));

function buildAfipMock() {
  return {
    ElectronicBilling: {
      getVoucherTypes: jest.fn().mockResolvedValue([
        { Id: 1, Desc: 'FA A' },
        { Id: 11, Desc: 'FA C' }
      ]),
      getConceptTypes: jest.fn().mockResolvedValue([{ Id: 1, Desc: 'Productos' }]),
      getDocumentTypes: jest.fn().mockResolvedValue([{ Id: 99, Desc: 'CF' }]),
      getCurrenciesTypes: jest.fn().mockResolvedValue([{ Id: 'PES', Desc: 'Pesos' }]),
      getSalesPoints: jest.fn().mockResolvedValue([{ Nro: 16 }])
    }
  };
}

describe('AfipValidator - regla emisor MONO solo C', () => {
  test('rechaza comprobante A para emisor MONO', async () => {
    const validator = new AfipValidator(buildAfipMock());
    const result = await validator.validateComprobante({
      cbteTipo: 1,
      concepto: 1,
      docTipo: 99,
      monId: 'PES',
      ptoVta: 16
    });
    expect(result.errors.some(e => e.includes('solo se permiten comprobantes clase C'))).toBe(true);
  });
});


