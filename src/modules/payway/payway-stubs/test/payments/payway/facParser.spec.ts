    import { describe, it, expect } from 'vitest';
    import { parsePaywayBlock } from '../../../src/payments/payway/facParser';

    describe('parsePaywayBlock', () => {
      it('parses single payment', () => {
        const txt = `COBRO: PAYWAY
ID_ORDEN: TEST-1
TOTAL: 100.00
MONEDA: ARS
PAGO: TARJETA=VISA; IMPORTE=100.00; CUOTAS=1; PLAN=NACIONAL`;
        const b = parsePaywayBlock(txt);
        expect(b).toBeTruthy();
        expect(b?.idOrden).toBe('TEST-1');
        expect(b?.pagos.length).toBe(1);
      });
    });
