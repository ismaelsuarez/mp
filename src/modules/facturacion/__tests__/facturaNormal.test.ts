import { AfipHelpers } from '../../facturacion/afip/helpers';

describe('Factura común – Consolidación de totales', () => {
  it('consolida neto/iva/total y arma Iva[] por alícuota', () => {
    const items = [
      { descripcion: 'A', cantidad: 2, precioUnitario: 50, iva: 21, alicuotaIva: 21 }, // base 100, iva 21
      { descripcion: 'B', cantidad: 1, precioUnitario: 100, iva: 10.5, alicuotaIva: 10.5 }, // base 100, iva 10.5
      { descripcion: 'C', cantidad: 1, precioUnitario: 50, iva: 0, alicuotaIva: 0 }, // exento 50
    ] as any;
    const tot = AfipHelpers.consolidateTotals(items);
    expect(tot.ImpNeto).toBeCloseTo(200);
    expect(tot.ImpIVA).toBeCloseTo(31.5);
    expect(tot.ImpOpEx).toBeCloseTo(50);
    expect(Array.isArray(tot.Iva)).toBe(true);
    const ids = tot.Iva.map(x => x.Id).sort();
    expect(ids).toEqual([4,5]); // 10.5 -> 4, 21 -> 5
  });
});


