import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import chokidar, { FSWatcher } from 'chokidar';
import { SqliteQueueStore, getQueueStore } from '../services/queue/SqliteQueueStore';
import { WSHealthService } from '../ws/WSHealthService';
import { CircuitBreaker } from '../ws/CircuitBreaker';
import { cajaLog } from '../services/CajaLogService';

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
  private paused = false;  // 🔑 Control temporal de pausa (NO persistente)
  private pausedByUser = false;  // 🔑 Pausa manual del usuario (NO auto-resume)
  private processing = false; // concurrency=1
  private wsHealth: WSHealthService;
  private circuit: CircuitBreaker;
  private cfg: Cfg;
  // Fallback inline (mutex global + cola simple)
  private inlineBusy = false;
  private inlineQueue: string[] = [];

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
      // 🔍 Filtrar: solo procesar archivos .fac
      const base = path.basename(filePath);
      if (!/\.fac$/i.test(base)) {
        try { console.warn('[fac.skip.not-fac]', { filePath, base }); } catch {}
        return;
      }
      // ⏸️ Si está pausado por el usuario, NO procesar
      if (this.paused) {
        try { console.warn('[fac.skip.paused]', { filePath, pausedByUser: this.pausedByUser }); } catch {}
        return;
      }
      try { const sz = fs.statSync(filePath).size; console.warn('[fac.detected]', { filePath, size: sz }); } catch {}
      try { await this.handleIncoming(filePath, cfg); } catch (e: any) { try { console.warn('[queue.enqueue.fail]', { filePath, reason: String(e?.message || e) }); } catch {} }
    });
    this.running = true;
    // Suscripción a salud WS
    this.wsHealth.on('down', () => { try { this.pauseAuto(); console.warn('[contingency] WS DOWN → auto-pausa'); } catch {} });
    this.wsHealth.on('up', () => { try { this.resumeAuto(); console.info('[contingency] WS UP → auto-resume'); } catch {} });
    this.wsHealth.on('degraded', () => { try { console.warn('[contingency] WS DEGRADED'); } catch {} });
    this.wsHealth.start();
    // Escaneo inicial: encolar .fac ya presentes (evita perder archivos previos al arranque)
    this.scanPendingFacs();
    // Rehidratación: mover PROCESSING>120s a RETRY al bootstrap
    try {
      const db = (require('../services/queue/QueueDB') as any).getQueueDB().driver;
      const now = Date.now();
      const stale = db.prepare("SELECT id FROM queue_jobs WHERE state='PROCESSING' AND (? - updated_at) > ?").all(now, 120000);
      for (const r of stale) {
        db.prepare("UPDATE queue_jobs SET state='RETRY', available_at=?, updated_at=? WHERE id=?").run(now, now, r.id);
        try { console.warn('[contingency] rehydrate job → RETRY', { id: r.id }); } catch {}
      }
    } catch {}

    // Loop de consumo (concurrency=1)
    const tick = async () => {
      if (!this.running) return;
      if (this.processing) return setTimeout(tick, 200);
      // ⏸️ Si está pausado, NO consumir cola
      if (this.paused) {
        return setTimeout(tick, 500);
      }
      if (!this.circuit.shouldPop()) {
        try { console.warn('[contingency] circuit=DOWN; queue=PAUSED'); } catch {}
        return setTimeout(tick, 1000);
      }
      const job = this.store.getNext(['fac.process']);
      if (!job) return setTimeout(tick, 300);
      try { console.warn('[queue.pop]', { id: job.id, filePath: String(job?.payload?.filePath || '') }); } catch {}
      this.processing = true;
      try {
        await this.processJob(job.id, job.payload, cfg);
        this.store.ack(job.id);
        try { console.warn('[queue.ack]', { id: job.id }); } catch {}
        this.circuit.recordSuccess();
      } catch (e: any) {
        const reason = String(e?.message || e);
        // Si el proceso indicó skip (archivo faltante o ya movido), ACK para evitar loop
        if (/^SKIP|^FAC missing|fac\.missing\.skip/i.test(reason)) {
          try { this.store.ack(job.id); console.warn('[queue.ack.skip]', { id: job.id, reason }); } catch {}
        } else {
          // Backoff exponencial aproximado + jitter
          const base = (this.cfg.ws?.backoffBaseMs || 1500);
          const factor = (this.circuit as any)['failures'] ? Math.min(6, 1 + Number((this.circuit as any)['failures'])) : 1;
          const jitter = Math.floor(Math.random() * 300);
          const backoff = base * factor + jitter + (this.wsHealth.last?.status === 'degraded' ? 1000 : 0);
          this.store.nack(job.id, reason, backoff);
          if (/timeout|ENOTFOUND|ECONN|EAI_AGAIN|network/i.test(reason)) {
            this.circuit.recordFailure();
          }
        }
      } finally {
        this.processing = false;
        setTimeout(tick, 50);
      }
    };
    setTimeout(tick, 300);
  }

  // ⏸️ Pausa MANUAL (desde UI) → NO se auto-resume
  pause(): void { 
    this.paused = true;
    this.pausedByUser = true;
    console.log('[ContingencyController] paused=true (USER)'); 
  }
  
  // ▶️ Resume MANUAL (desde UI) → limpia flag de usuario y escanea pendientes
  resume(): void { 
    this.paused = false;
    this.pausedByUser = false;
    console.log('[ContingencyController] paused=false (USER)');
    // 🔍 Escanear carpeta incoming para procesar archivos .fac pendientes
    this.scanPendingFacs();
  }
  
  // ⏸️ Pausa AUTOMÁTICA (por WS down) → SÍ se auto-resume
  private pauseAuto(): void {
    this.paused = true;
    // NO setear pausedByUser → permite auto-resume
    console.log('[ContingencyController] paused=true (AUTO)');
  }
  
  // ▶️ Resume AUTOMÁTICO (por WS up) → solo si no está pausado por usuario
  private resumeAuto(): void {
    if (!this.pausedByUser) {
      this.paused = false;
      console.log('[ContingencyController] paused=false (AUTO)');
    }
  }
  
  // 🛑 Detener completamente el controller (cerrar watcher, detener wsHealth)
  stop(): void {
    try { this.watcher?.close(); } catch {}
    try { this.wsHealth.stop(); } catch {}
    this.watcher = null;
    this.running = false;
    this.processing = false;
  }
  
  status(): CtrStatus { 
    const s = this.store.getStats(); 
    return { 
      running: this.running, 
      paused: this.paused,  // Usar estado en memoria, NO SQLite
      enqueued: s.enqueued, 
      processing: s.processing 
    }; 
  }

  enqueueFacFromPath(filePath: string, cfg?: { staging?: string }): number {
    try {
      // ⏸️ Si está pausado por el usuario, NO hacer NADA
      if (this.paused) {
        try { console.warn('[contingency] queue paused → SKIP (no inline)', { filePath, pausedByUser: this.pausedByUser }); } catch {}
        return -1;
      }
      // Normalizar siempre: mover a staging y encolar con la ruta de staging
      try { this.handleIncoming(filePath, this.cfg); console.warn('[contingency] normalize→staging via enqueueFacFromPath', { filePath }); } catch {}
      return 0;
    } catch (e) {
      try { console.warn('[contingency] enqueue failed → fallback inline', { filePath, error: String((e as any)?.message || e) }); } catch {}
      this.enqueueInlineFallback(filePath);
      return -1;
    }
  }

  private async handleIncoming(filePath: string, cfg: any) {
    // Mover a staging atómicamente
    const base = path.basename(filePath);
    const dst = path.join(cfg.staging, base);
    
    // Log: archivo detectado con tamaño
    try { 
      const sz = fs.statSync(filePath).size; 
      console.warn('[fac.stable.ok]', { filePath, size: sz }); 
      cajaLog.info(`Detectado ${base}`, `${(sz / 1024).toFixed(1)} KB`);
    } catch {}
    
    // Mover a staging
    let stagingMethod = 'rename';
    try { 
      fs.renameSync(filePath, dst); 
    } catch (errRename) { 
      // cross-device fallback: copy + delete
      stagingMethod = 'copy+delete';
      try { 
        fs.copyFileSync(filePath, dst); 
        try { fs.unlinkSync(filePath); } catch (errUnlink) { 
          stagingMethod = 'copy-only (unlink failed)';
          try { console.warn('[fac.stage.warn]', { from: filePath, to: dst, reason: 'unlink-failed', error: String(errUnlink) }); } catch {}
        }
      } catch (errCopy) {
        try { console.warn('[fac.stage.fail]', { from: filePath, to: dst, reason: 'copy-failed', error: String(errCopy) }); } catch {}
        throw errCopy; // Re-lanzar para que se maneje arriba
      }
    }
    try { console.warn('[fac.stage.ok]', { from: filePath, to: dst, method: stagingMethod }); } catch {}
    
    // Calcular hash y encolar
    const sha = this.sha256OfFileSafe(dst);
    try { console.warn('[fac.sha.ok]', { filePath: dst, sha }); } catch {}
    const id = this.store.enqueue({ type: 'fac.process', payload: { filePath: dst }, sha256: sha });
    try { console.warn('[queue.enqueue.ok]', { id, filePath: dst }); } catch {}
    
    cajaLog.process(`Encolado ${base}`, `ID: ${id} | Staging`);
  }

  private async processJob(id: number, payload: any, cfg: any) {
    const srcRaw = String(payload?.filePath || '');
    let src = srcRaw;
    if (!src || !fs.existsSync(src)) {
      // Intentar reubicar por nombre en processing/staging/done/error
      const base = path.basename(srcRaw || '');
      const locked = base ? path.join(cfg.processing, base) : '';
      const staged = base ? path.join(cfg.staging, base) : '';
      const doneP = base ? path.join(cfg.done, base) : '';
      const errP = base ? path.join(cfg.error, base) : '';
      if (locked && fs.existsSync(locked)) {
        src = locked; // ya está bloqueado en processing por un intento previo
      } else if (staged && fs.existsSync(staged)) {
        src = staged;
      } else if ((doneP && fs.existsSync(doneP)) || (errP && fs.existsSync(errP))) {
        try { console.warn('[fac.already-processed.skip]', { filePath: srcRaw, foundIn: doneP && fs.existsSync(doneP) ? 'done' : 'error' }); } catch {}
        cajaLog.warn(`${base} ya procesado`, 'Skip');
        return; // ACK arriba sin reprocesar
      } else {
        // ❌ No encontrado en ningún directorio (incoming, staging, processing, done, error)
        try { console.warn('[fac.not-found.skip]', { filePath: srcRaw, searched: [cfg.incoming, cfg.staging, cfg.processing, cfg.done, cfg.error] }); } catch {}
        cajaLog.warn(`${base} no encontrado en sistema`, 'Saltado • Posible error de staging');
        return; // ACK arriba
      }
    }
    const name = path.basename(src);
    // Evitar reprocesar si ya existe un .res del mismo basename
    try {
      const base = path.basename(name, path.extname(name)).toLowerCase();
      const candDirs = [cfg.outDir, cfg.processing, cfg.done].filter(Boolean);
      for (const d of candDirs) {
        try {
          const entries = fs.readdirSync(d);
          const found = entries.find((f) => path.basename(f, path.extname(f)).toLowerCase() === base && f.toLowerCase().endsWith('.res'));
          if (found) { 
            console.warn('[fac.duplicate.skip]', { filePath: src, res: path.join(d, found) }); 
            cajaLog.warn(`${name} duplicado`, 'Ya existe .res');
            this.store.ack(id); 
            return; 
          }
        } catch {}
      }
    } catch {}
    const lockPath = path.join(cfg.processing, name);
    // Lock (mover a processing)
    if (src !== lockPath) {
      try { fs.renameSync(src, lockPath); } catch { fs.copyFileSync(src, lockPath); try { fs.unlinkSync(src); } catch {} }
      try { console.warn('[fac.lock.ok]', { from: src, to: lockPath }); } catch {}
      cajaLog.process(`Procesando ${name}`, 'Bloqueado en processing/');
    }
    
    try {
      // Detectar TIPO rápidamente para enrutar al pipeline correcto
      const readLoose = (p: string): string => {
        try {
          const buf = fs.readFileSync(p);
          const t1 = buf.toString('utf8');
          if (/TIPO\s*:/i.test(t1)) return t1;
          return buf.toString('latin1');
        } catch { return ''; }
      };
      const raw = readLoose(lockPath);
      const m = raw.match(/\bTIPO:\s*(\S+)/i);
      const tipo = String(m?.[1] || '').toUpperCase();

      let kind: 'fact' | 'recibo' | 'remito' = 'fact';
      if (tipo.includes('REMITO')) kind = 'remito';
      else if (tipo.includes('RECIBO')) kind = 'recibo';

      // Avisar al UI que comenzamos a procesar
      try { const { BrowserWindow } = require('electron'); const win = BrowserWindow.getAllWindows()?.[0]; if (win) win.webContents.send('auto-report-notice', { info: `Procesando ${kind === 'recibo' ? 'REC' : (kind === 'remito' ? 'REM' : 'FAC')} ${name}` }); } catch {}
      cajaLog.info(`Tipo detectado: ${tipo || 'DESCONOCIDO'}`, name);

      if (kind === 'recibo') {
        const { processFacFile } = require('../modules/facturacion/facProcessor');
        const out: any = await processFacFile(lockPath);
        try { console.warn('[recibo.ok]', { out }); } catch {}
        cajaLog.success(`RECIBO ${name}`, 'Completado');
      } else if (kind === 'remito') {
        const { processRemitoFacFile } = require('../modules/facturacion/remitoProcessor');
        const out: any = await processRemitoFacFile(lockPath);
        try { console.warn('[remito.ok]', { out }); } catch {}
        cajaLog.success(`REMITO ${name}`, 'Completado');
      } else {
        // Facturas / Notas A/B
        const { processFacturaFacFile } = require('../modules/facturacion/facProcessor');
        const r: any = await processFacturaFacFile(lockPath);
        if (!r || r.ok !== true) {
          const errMsg = String((r && r.reason) || 'PERMANENT_ERROR');
          try { console.warn('[queue.process.fail]', { id, filePath: lockPath, reason: errMsg }); } catch {}
          
          // Tratar como transitorio: AFIP sin CAE/número, NTP, error de red/DNS y 'Comprobante en proceso'
          if (/AFIP\s*sin\s*CAE|AFIP_NO_CAE|AFIP_NO_NUMERO|NTP_|ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|timeout|network|en\s*proceso/i.test(errMsg)) {
            cajaLog.warn(`${name} error transitorio`, errMsg);
            throw new Error(errMsg);
          }
          
          // Error permanente
          cajaLog.error(`${name} falló`, errMsg);
          
          // Generar .res de error mínimo si el pipeline no lo hizo
          try {
            const { generateRes, parseFac } = require('./pipeline');
            const dto = parseFac(lockPath);
            await generateRes(dto, undefined, errMsg);
            try { console.warn('[res.err.ok]', { filePath: lockPath }); } catch {}
          } catch {}
          
          const errPath = path.join(cfg.error, name);
          try { fs.renameSync(lockPath, errPath); } catch { try { fs.copyFileSync(lockPath, errPath); fs.unlinkSync(lockPath); } catch {} }
          cajaLog.error(`${name} → error/`, `Movido a carpeta error`);
          throw new Error('PERMANENT_ERROR');
        }
        try { console.warn('[afip.cae.ok]', { cae: String(r.cae || ''), vto: String(r.caeVto || r.vto || '') }); } catch {}
        cajaLog.logFacturaEmitida(
          r.tipoTexto || 'FACTURA',
          r.numero || '?',
          r.cae || '?',
          r.caeVto || r.vto || '',
          r.total || 0
        );
      }
      // DONE: si el pipeline ya borró el .fac (tras enviar .res por FTP), saltar move
      if (fs.existsSync(lockPath)) {
        const donePath = path.join(cfg.done, name);
        try { fs.renameSync(lockPath, donePath); } catch { try { fs.copyFileSync(lockPath, donePath); fs.unlinkSync(lockPath); } catch {} }
        try { console.warn('[fac.done.ok]', { from: lockPath, to: donePath }); } catch {}
        cajaLog.success(`${name} → done/`, 'Procesado correctamente');
      } else {
        try { console.warn('[fac.done.ok]', { from: lockPath, to: '(deleted by pipeline after RES_OK)' }); } catch {}
        cajaLog.success(`${name} → enviado FTP`, 'Eliminado tras RES_OK');
      }
    } catch (e) {
      const err = e as any;
      const msg = String(err?.message || err);
      const name = path.basename(lockPath);
      
      if (msg === 'PERMANENT_ERROR') throw e;
      if (/AFIPError/.test(String(err?.name)) && /transient/.test(String(err?.kind))) {
        // Dejar el archivo en processing para el reintento
        cajaLog.warn(`${name} en processing/`, 'Reintento programado');
        throw e;
      }
      // Considerar también transitorio si el mensaje indica 'Comprobante en proceso', 'AFIP sin CAE' o errores de red/DNS
      if (/AFIP\s*sin\s*CAE|en\s*proceso|ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|timeout|network/i.test(msg)) {
        cajaLog.warn(`${name} error transitorio`, msg);
        throw e;
      }
      
      // Error permanente no manejado arriba
      try { console.warn('[queue.process.exception]', { id, filePath: lockPath, error: msg }); } catch {}
      const errPath = path.join(cfg.error, name);
      try { fs.renameSync(lockPath, errPath); } catch { fs.copyFileSync(lockPath, errPath); try { fs.unlinkSync(lockPath); } catch {} }
      cajaLog.error(`${name} → error/`, msg);
      throw e;
    }
  }

  private sha256OfFileSafe(p: string): string {
    try { const buf = fs.readFileSync(p); return crypto.createHash('sha256').update(buf).digest('hex'); } catch { return ''; }
  }

  // ===== Fallback inline secuencial =====
  // 🔍 Escanear carpeta incoming y encolar .fac pendientes
  private scanPendingFacs(): void {
    try {
      const cfg = this.cfg;
      const entries = fs.readdirSync(cfg.incoming)
        .filter((n) => /\.fac$/i.test(String(n || '')))
        .filter((n) => !/\.(res|err|pdf)$/i.test(String(n || '')));
      if (entries.length) {
        try { console.warn('[fac.scan.pending]', { count: entries.length }); } catch {}
        const sorted = entries.sort((a,b)=>a.localeCompare(b));
        for (const name of sorted) {
          const full = path.join(cfg.incoming, name);
          try { this.handleIncoming(full, cfg); console.warn('[fac.scan.enqueue]', { filePath: full }); } catch {}
        }
      }
    } catch {}
  }

  private enqueueInlineFallback(filePath: string): void {
    try {
      if (typeof filePath !== 'string' || !filePath.toLowerCase().endsWith('.fac')) return;
      if (!fs.existsSync(filePath)) return;
      this.inlineQueue.push(filePath);
      this.processInlineQueue();
    } catch {}
  }

  private async processInlineQueue(): Promise<void> {
    if (this.inlineBusy) return;
    this.inlineBusy = true;
    try {
      while (this.inlineQueue.length > 0) {
        const filePath = this.inlineQueue.shift() as string;
        try { await this.processInlineOne(filePath); } catch {}
      }
    } finally {
      this.inlineBusy = false;
    }
  }

  private async processInlineOne(filePath: string): Promise<void> {
    try { console.warn('[contingency][inline] start', { filePath }); } catch {}
    // Reusar pipeline existente sin mover a staging/processing/done
    const { parseFac, validate, buildRequest, generatePdf, generateRes } = require('./pipeline');
    const { RealAFIPBridge, AFIPError } = require('../afip/AFIPBridge');
    try {
      const dto = parseFac(filePath);
      try { console.warn('[inline.parse.ok]', { filePath, tipo: Number(dto?.tipo || 0) }); } catch {}
      validate(dto);
      try { console.warn('[inline.validate.ok]', { filePath }); } catch {}
      const req = buildRequest(dto);
      const bridge = new RealAFIPBridge();
      const caeResp = await bridge.solicitarCAE(req);
      try { console.warn('[inline.afip.cae.ok]', { filePath, cae: String(caeResp?.cae || ''), vto: String(caeResp?.vencimiento || '') }); } catch {}
      const pdfOut = await generatePdf(dto, { cae: String(caeResp.cae), vencimiento: String(caeResp.vencimiento) });
      try { console.warn('[inline.pdf.ok]', { filePath, pdf: pdfOut }); } catch {}
      const resOut = await generateRes(dto, { cae: String(caeResp.cae), vencimiento: String(caeResp.vencimiento) });
      try { console.warn('[inline.res.ok]', { filePath, res: resOut }); } catch {}
      // Borrar .fac SOLO después de RES_OK
      try { if (fs.existsSync(resOut) && fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
      try { console.warn('[contingency] inline RES_OK', { filePath, cae: String(caeResp.cae), vto: String(caeResp.vencimiento), resPath: resOut }); } catch {}
    } catch (err: any) {
      const isTransient = err && err.name === 'AFIPError' && err.kind === 'transient';
      if (!isTransient) {
        // Generar .res de error; no borrar .fac
        try {
          const dto = require('./pipeline').parseFac(filePath);
          await require('./pipeline').generateRes(dto, undefined, String(err?.message || err));
          try { console.warn('[inline.res.err.ok]', { filePath }); } catch {}
        } catch {}
      }
      try { console.warn('[contingency][inline] fail', { filePath, transient: !!isTransient, error: String(err?.message || err) }); } catch {}
    }
  }
}

export function createContingencyController(cfg: any): ContingencyController { return new ContingencyController(cfg); }


