import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import chokidar, { FSWatcher } from 'chokidar';
import { SqliteQueueStore, getQueueStore } from '../services/queue/SqliteQueueStore';
import { WSHealthService } from '../ws/WSHealthService';
import { CircuitBreaker } from '../ws/CircuitBreaker';

type CtrStatus = { running: boolean; paused: boolean; enqueued: number; processing: number };

type Cfg = {
  incoming: string;
  staging: string;
  processing: string;
  done: string;
  error: string;
  outDir: string;
  minStableMs: number;
  ws?: { timeoutMs: number; retryMax: number; backoffBaseMs: number; healthIntervalSec: number; failureThreshold: number; cooldownSec: number };
};

export class ContingencyController {
  private store: SqliteQueueStore;
  private watcher: FSWatcher | null = null;
  private running = false;
  private processing = false; // concurrency=1
  private wsHealth: WSHealthService;
  private circuit: CircuitBreaker;
  private cfg: Cfg;

  constructor(cfg: Cfg, store?: SqliteQueueStore) {
    this.cfg = cfg;
    this.store = store || (getQueueStore() as SqliteQueueStore);
    const ws = cfg.ws || { timeoutMs: 12000, retryMax: 6, backoffBaseMs: 1500, healthIntervalSec: 20, failureThreshold: 5, cooldownSec: 90 };
    this.wsHealth = new WSHealthService({ intervalSec: ws.healthIntervalSec, timeoutMs: ws.timeoutMs });
    this.circuit = new CircuitBreaker({ failureThreshold: ws.failureThreshold, cooldownSec: ws.cooldownSec });
  }

  start(): void {
    if (this.running) return;
    const ensure = (d: string) => { try { fs.mkdirSync(d, { recursive: true }); } catch {} };
    const cfg = this.cfg;
    ensure(cfg.incoming); ensure(cfg.staging); ensure(cfg.processing); ensure(cfg.done); ensure(cfg.error); ensure(cfg.outDir);
    // Watcher de incoming
    this.watcher = chokidar.watch(cfg.incoming, { persistent: true, ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: cfg.minStableMs, pollInterval: 100 } });
    this.watcher.on('add', async (filePath: string) => {
      try { await this.handleIncoming(filePath, cfg); } catch { /* noop */ }
    });
    this.running = true;
    // Suscripción a salud WS
    this.wsHealth.on('down', () => { try { this.pause(); console.warn('[contingency] WS DOWN → pausa'); } catch {} });
    this.wsHealth.on('up', () => { try { this.resume(); console.info('[contingency] WS UP → resume'); } catch {} });
    this.wsHealth.on('degraded', () => { try { console.warn('[contingency] WS DEGRADED'); } catch {} });
    this.wsHealth.start();
    // Loop de consumo (concurrency=1)
    const tick = async () => {
      if (!this.running) return;
      if (this.processing) return setTimeout(tick, 200);
      if (!this.circuit.shouldPop()) return setTimeout(tick, 1000);
      const job = this.store.getNext(['fac.process']);
      if (!job) return setTimeout(tick, 300);
      this.processing = true;
      try {
        await this.processJob(job.id, job.payload, cfg);
        this.store.ack(job.id);
        this.circuit.recordSuccess();
      } catch (e: any) {
        const reason = String(e?.message || e);
        // Backoff exponencial aproximado + jitter
        const base = (this.cfg.ws?.backoffBaseMs || 1500);
        const factor = (this.circuit as any)['failures'] ? Math.min(6, 1 + Number((this.circuit as any)['failures'])) : 1;
        const jitter = Math.floor(Math.random() * 300);
        const backoff = base * factor + jitter + (this.wsHealth.last?.status === 'degraded' ? 1000 : 0);
        this.store.nack(job.id, reason, backoff);
        if (/timeout|ENOTFOUND|ECONN|EAI_AGAIN|network/i.test(reason)) {
          this.circuit.recordFailure();
        }
      } finally {
        this.processing = false;
        setTimeout(tick, 50);
      }
    };
    setTimeout(tick, 300);
  }

  pause(): void { this.store.pause(); }
  resume(): void { this.store.resume(); }
  status(): CtrStatus { const s = this.store.getStats(); return { running: this.running, paused: s.paused, enqueued: s.enqueued, processing: s.processing }; }

  enqueueFacFromPath(filePath: string, cfg?: { staging?: string }): number {
    const payload = { filePath, staging: cfg?.staging };
    const sha = this.sha256OfFileSafe(filePath);
    return this.store.enqueue({ type: 'fac.process', payload, sha256: sha });
  }

  private async handleIncoming(filePath: string, cfg: any) {
    // Mover a staging atómicamente
    const base = path.basename(filePath);
    const dst = path.join(cfg.staging, base);
    try { fs.renameSync(filePath, dst); } catch { /* cross-device fallback */ fs.copyFileSync(filePath, dst); try { fs.unlinkSync(filePath); } catch {} }
    const sha = this.sha256OfFileSafe(dst);
    this.store.enqueue({ type: 'fac.process', payload: { filePath: dst }, sha256: sha });
  }

  private async processJob(id: number, payload: any, cfg: any) {
    const src = String(payload?.filePath || '');
    if (!src || !fs.existsSync(src)) throw new Error('FAC missing');
    const name = path.basename(src);
    const lockPath = path.join(cfg.processing, name);
    // Lock (mover a processing)
    try { fs.renameSync(src, lockPath); } catch { fs.copyFileSync(src, lockPath); try { fs.unlinkSync(src); } catch {} }
    try {
      const { parseFac, validate, buildRequest, generatePdf, generateRes } = require('./pipeline');
      const { RealAFIPBridge, AFIPError } = require('../afip/AFIPBridge');
      // PARSED
      const dto = parseFac(lockPath);
      // VALIDATED
      validate(dto);
      // WAIT_WS/SENDING_WS
      const bridge = new RealAFIPBridge();
      let caeResp: any;
      try {
        const req = buildRequest(dto);
        caeResp = await bridge.solicitarCAE(req);
      } catch (err: any) {
        if (err && err.name === 'AFIPError' && err.kind === 'transient') {
          throw err; // transient → nack arriba
        }
        await generateRes(dto, undefined, String(err?.message || err));
        const errPath = path.join(cfg.error, name);
        try { fs.renameSync(lockPath, errPath); } catch { fs.copyFileSync(lockPath, errPath); try { fs.unlinkSync(lockPath); } catch {} }
        throw new Error('PERMANENT_ERROR');
      }
      // CAE_OK → PDF_OK
      try { await generatePdf(dto, { cae: String(caeResp.cae), vencimiento: String(caeResp.vencimiento) }); } catch { throw new Error('PDF_FAIL'); }
      // RES_OK
      try { await generateRes(dto, { cae: String(caeResp.cae), vencimiento: String(caeResp.vencimiento) }); } catch { throw new Error('RES_FAIL'); }
      // DONE
      const donePath = path.join(cfg.done, name);
      try { fs.renameSync(lockPath, donePath); } catch { fs.copyFileSync(lockPath, donePath); try { fs.unlinkSync(lockPath); } catch {} }
    } catch (e) {
      const err = e as any;
      const msg = String(err?.message || err);
      if (msg === 'PERMANENT_ERROR') throw e;
      if (/AFIPError/.test(String(err?.name)) && /transient/.test(String(err?.kind))) {
        // Dejar el archivo en processing para el reintento
        throw e;
      }
      const errPath = path.join(cfg.error, name);
      try { fs.renameSync(lockPath, errPath); } catch { fs.copyFileSync(lockPath, errPath); try { fs.unlinkSync(lockPath); } catch {} }
      throw e;
    }
  }

  private sha256OfFileSafe(p: string): string {
    try { const buf = fs.readFileSync(p); return crypto.createHash('sha256').update(buf).digest('hex'); } catch { return ''; }
  }
}

export function createContingencyController(cfg: any): ContingencyController { return new ContingencyController(cfg); }


