import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import chokidar from 'chokidar';
import { createContingencyController, ContingencyController } from '../../contingency/ContingencyController';
import { LegacyWatcherAdapter } from '../../contingency/LegacyWatcherAdapter';

let controller: ContingencyController | null = null;
let legacyWatcher: any = null;

// 🔑 Obtener configuración desde la instancia GLOBAL de store (no crear una nueva!)
function getWatcherConfig(): { enabled: boolean; dir: string } {
	try {
		// Importar la instancia global de store desde main.ts
		const { getGlobalStore } = require('../store');
		const store = getGlobalStore();
		const cfg: any = store.get('config') || {};
		// Por defecto: enabled=true, dir=C:\tmp
		const enabled = cfg.FACT_FAC_WATCH !== false;
		const dir = String(cfg.FACT_FAC_DIR || 'C:\\tmp').trim();
		console.log('[contingency] getWatcherConfig', { enabled, dir, raw_FACT_FAC_WATCH: cfg.FACT_FAC_WATCH });
		return { enabled, dir };
	} catch (e: any) {
		console.warn('[contingency] Failed to read config, using defaults:', e?.message);
		return { enabled: true, dir: 'C:\\tmp' };
	}
}

function readEnv(name: string, def?: string): string | undefined {
	const v = process.env[name];
	return (v && v.length) ? v : def;
}

export function bootstrapContingency(): void {
	try {
		const userData = app.getPath('userData');
		const { enabled, dir } = getWatcherConfig();
		
		// ⚠️ Si está desactivado, no iniciar
		if (!enabled) {
			console.log('[contingency] disabled by config');
			return;
		}

		const INCOMING_DIR = dir;  // 🔑 Leer desde configuración
		const BASE_DIR = path.join(userData, 'fac');
		const STAGING_DIR = path.join(BASE_DIR, 'staging');
		const PROCESSING_DIR = path.join(BASE_DIR, 'processing');
		const DONE_DIR = path.join(BASE_DIR, 'done');
		const ERROR_DIR = path.join(BASE_DIR, 'error');
		const OUT_DIR = path.join(BASE_DIR, 'out');
		const FAC_MIN_STABLE_MS = 1500;
		const WS_TIMEOUT_MS = 12000;
		const WS_RETRY_MAX = 6;
		const WS_BACKOFF_BASE_MS = 1500;
		const WS_CIRCUIT_FAILURE_THRESHOLD = 5;
		const WS_CIRCUIT_COOLDOWN_SEC = 90;
		const WS_HEALTH_INTERVAL_SEC = 20;

		for (const d of [BASE_DIR, STAGING_DIR, PROCESSING_DIR, DONE_DIR, ERROR_DIR, OUT_DIR]) {
			try { fs.mkdirSync(d, { recursive: true }); } catch {}
		}

		controller = createContingencyController({
			incoming: INCOMING_DIR,
			staging: STAGING_DIR,
			processing: PROCESSING_DIR,
			done: DONE_DIR,
			error: ERROR_DIR,
			outDir: OUT_DIR,
			minStableMs: FAC_MIN_STABLE_MS,
			ws: {
				timeoutMs: WS_TIMEOUT_MS,
				retryMax: WS_RETRY_MAX,
				backoffBaseMs: WS_BACKOFF_BASE_MS,
				healthIntervalSec: WS_HEALTH_INTERVAL_SEC,
				failureThreshold: WS_CIRCUIT_FAILURE_THRESHOLD,
				cooldownSec: WS_CIRCUIT_COOLDOWN_SEC,
			},
		});
		controller.start();
		try { console.log(JSON.stringify({ cfg: { incoming: INCOMING_DIR, staging: STAGING_DIR, processing: PROCESSING_DIR, done: DONE_DIR, error: ERROR_DIR, out: OUT_DIR, stableMs: FAC_MIN_STABLE_MS, wsTimeout: WS_TIMEOUT_MS, wsRetryMax: WS_RETRY_MAX, wsBackoffBaseMs: WS_BACKOFF_BASE_MS, wsFailureThreshold: WS_CIRCUIT_FAILURE_THRESHOLD, wsCooldownSec: WS_CIRCUIT_COOLDOWN_SEC, wsHealthIntervalSec: WS_HEALTH_INTERVAL_SEC } })); } catch {}
		// Integrar con watcher legacy: siempre recrear para evitar estado zombi
		try {
			// Limpiar emitter anterior si existe
			try { delete (global as any).legacyFacWatcherEmitter; } catch {}
			
			// Crear wrapper chokidar usando la carpeta configurada
			const emitter = new (require('events').EventEmitter)();
			legacyWatcher = chokidar.watch(INCOMING_DIR, { persistent: true, ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: FAC_MIN_STABLE_MS, pollInterval: 100 } });
			legacyWatcher.on('add', (filePath: string) => { try { emitter.emit('fileReady', filePath); } catch {} });
			(global as any).legacyFacWatcherEmitter = emitter;
			
			// Conectar el adapter
			new LegacyWatcherAdapter(controller!).bind(emitter);
		} catch {}
		try { console.log('[contingency] started', { incoming: INCOMING_DIR, staging: STAGING_DIR, processing: PROCESSING_DIR, done: DONE_DIR, error: ERROR_DIR, outDir: OUT_DIR, minStableMs: FAC_MIN_STABLE_MS }); } catch {}
	} catch (e) {
		try { console.warn('[contingency] bootstrap failed:', (e as any)?.message || String(e)); } catch {}
	}
}

export function shutdownContingency(): void {
	try { 
		controller?.stop();  // 🔑 Stop completo (cierra watcher interno)
		legacyWatcher?.close();
		// 🔑 Limpiar el emitter global para evitar que siga procesando
		try { delete (global as any).legacyFacWatcherEmitter; } catch {}
		console.log('[contingency] shutdown complete');
	} catch (e: any) {
		console.warn('[contingency] shutdown error:', e?.message || e);
	}
	controller = null;
	legacyWatcher = null;
}

// 🔄 Reiniciar el watcher con la nueva configuración
export function restartContingency(): void {
	shutdownContingency();
	bootstrapContingency();
}

// 🔍 Obtener estado del controller
export function getContingencyStatus(): { running: boolean; dir: string | null } {
	const cfg = getWatcherConfig();
	return {
		running: controller !== null,
		dir: cfg.enabled ? cfg.dir : null
	};
}
