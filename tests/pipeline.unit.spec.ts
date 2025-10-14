import { describe, it, expect } from 'vitest';
import { parseFac, validate, buildRequest } from '../src/contingency/pipeline';
import { monthStartFromYYYYMMDD } from '@electron/modules/facturacion/afip/helpers';

describe('pipeline unit', () => {
  it('parse/validate ok', () => {
    const tmp = require('os').tmpdir();
    const p = require('path').join(tmp, `t_${Date.now()}.fac`);
    const txt = `DIAHORA:25/09/25 15:49:15 yp47\nTIPO:6\nCLIENTE:(000001)CONSUMIDOR FINAL\nTIPODOC:99\nNRODOC:\nCONDICION:CONSUMIDOR FINAL\nIVARECEPTOR:5\nITEM:\n     1  PRUEBA  0.10                   0.10\nTOTALES:\nNETO 21%  :0.08\nIVA 21%   :0.02\nTOTAL     :0.10\n`;
    require('fs').writeFileSync(p, txt, 'utf8');
    const dto = parseFac(p);
    expect(dto.totales.total).toBeCloseTo(0.1, 2);
    validate(dto); // no lanza
    const req = buildRequest(dto);
    expect(req.total).toBeCloseTo(0.1, 2);
  });

  it('monthStartFromYYYYMMDD returns first day of month', () => {
    expect(monthStartFromYYYYMMDD('20250930')).toBe('20250901');
  });
});


