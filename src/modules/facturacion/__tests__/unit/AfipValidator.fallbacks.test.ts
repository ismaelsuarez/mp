import { AfipValidator } from '../../afip/AfipValidator';

function buildAfipMock(opts: {
  withSalesPoints?: boolean;
  withPointsOfSales?: boolean;
  withAliquotsTypes?: boolean;
  withAliquotTypes?: boolean;
}) {
  const eb: any = {};
  // Tipos de comprobante válidos
  eb.getVoucherTypes = jest.fn().mockResolvedValue([
    { Id: 1, Desc: 'FA A' },
    { Id: 2, Desc: 'ND A' },
    { Id: 3, Desc: 'NC A' },
    { Id: 6, Desc: 'FA B' },
    { Id: 7, Desc: 'ND B' },
    { Id: 8, Desc: 'NC B' },
    { Id: 11, Desc: 'FA C' },
    { Id: 12, Desc: 'ND C' },
    { Id: 13, Desc: 'NC C' }
  ]);
  // Conceptos, tipos doc, monedas
  eb.getConceptTypes = jest.fn().mockResolvedValue([{ Id: 1, Desc: 'Productos' }]);
  eb.getDocumentTypes = jest.fn().mockResolvedValue([{ Id: 99, Desc: 'CF' }]);
  eb.getCurrenciesTypes = jest.fn().mockResolvedValue([{ Id: 'PES', Desc: 'Pesos' }]);
  eb.getCurrencyCotization = jest.fn().mockResolvedValue({ MonId: 'USD', MonCotiz: 100 });

  if (opts.withSalesPoints) {
    eb.getSalesPoints = jest.fn().mockResolvedValue([{ Nro: 16, Desc: 'PV 16' }]);
  }
  if (opts.withPointsOfSales) {
    eb.getPointsOfSales = jest.fn().mockResolvedValue([{ Nro: 16, Desc: 'PV 16' }]);
  }
  if (opts.withAliquotsTypes) {
    eb.getAliquotsTypes = jest.fn().mockResolvedValue([]);
  }
  if (opts.withAliquotTypes) {
    eb.getAliquotTypes = jest.fn().mockResolvedValue([]);
  }

  return { ElectronicBilling: eb };
}

describe('AfipValidator - fallbacks y reglas de clase', () => {
  test('Fallback a getPointsOfSales cuando falta getSalesPoints', async () => {
    const afip = buildAfipMock({ withPointsOfSales: true });
    const validator = new AfipValidator(afip);
    const result = await validator.validateComprobante({
      cbteTipo: 11,
      concepto: 1,
      docTipo: 99,
      monId: 'PES',
      ptoVta: 16
    });
    // No debe fallar por punto de venta inválido
    expect(result.errors.find(e => e.includes('Punto de venta inválido'))).toBeUndefined();
  });

  test('Fallback a getAliquotTypes cuando falta getAliquotsTypes', async () => {
    const afip = buildAfipMock({ withSalesPoints: true, withAliquotTypes: true });
    const validator = new AfipValidator(afip);
    const info = await validator.getValidationInfo();
    expect(info.tiposIva).not.toBeNull();
  });

  // Nota: la regla MONO solo C se testea en suite separada con mock de DbService
});


