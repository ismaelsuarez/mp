import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ContingencyController } from '../src/contingency/ContingencyController';
import { SqliteQueueStore } from '../src/services/queue/SqliteQueueStore';
import { WSHealthService } from '../src/ws/WSHealthService';
import { CircuitBreaker } from '../src/ws/CircuitBreaker';

function writeFac(dir: string, name: string, total = 0.1) {
  const txt = `DIAHORA:25/09/25 15:49:15 yp47\nTIPO:6\nCLIENTE:(000001)CONSUMIDOR FINAL\nTIPODOC:99\nNRODOC:\nCONDICION:CONSUMIDOR FINAL\nITEM:\n     1  PRUEBA  ${total.toFixed(2)}                   ${total.toFixed(2)}\nTOTALES:\nNETO 21%  :0.08\nIVA 21%   :0.02\nTOTAL     :${total.toFixed(2)}\n`;
  const p = path.join(dir, name);
  fs.writeFileSync(p, txt, 'utf8');
  return p;
}

describe('contingency e2e (simplificado)', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'fac-e2e-'));
  const cfg = {
    incoming: path.join(base, 'incoming'),
    staging: path.join(base, 'staging'),
    processing: path.join(base, 'processing'),
    done: path.join(base, 'done'),
    error: path.join(base, 'error'),
    outDir: path.join(base, 'out'),
    minStableMs: 50,
  } as const;

  beforeAll(() => { Object.values(cfg).forEach((d) => { try { fs.mkdirSync(d, { recursive: true }); } catch {} }); });
  afterAll(() => { try { fs.rmSync(base, { recursive: true, force: true }); } catch {} });

  it('lote FIFO y borrado tras RES_OK (stub de éxito)', async () => {
    process.env.AFIP_STUB_MODE = 'ok';
    const store = new SqliteQueueStore();
    const controller = new ContingencyController(store as any);
    controller.start({ ...cfg });
    writeFac(cfg.incoming, 'a.fac');
    writeFac(cfg.incoming, 'b.fac');
    writeFac(cfg.incoming, 'c.fac');
    await new Promise((r) => setTimeout(r, 2500));
    expect(fs.readdirSync(cfg.done).filter(f => f.endsWith('.fac')).length).toBe(3);
  });
});


