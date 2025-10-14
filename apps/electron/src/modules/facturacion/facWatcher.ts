import fs from 'fs';
import path from 'path';

export type FacDetectedPayload = {
	filename: string;
	fullPath: string;
	rawContent: string;
};

type DetectedCallback = (payload: FacDetectedPayload) => void;

/**
 * Watcher de archivos .fac (similar a Modo Imagen)
 * - Observa una carpeta configurable (por defecto C:\\tmp)
 * - Reacciona ante archivos con extensión .fac
 * - Lee contenido UTF-8 con reintentos si el archivo está ocupado (FTP)
 */
export class FacFileWatcher {
	private directoryPath: string;
	private watcher: fs.FSWatcher | null = null;
	private onDetected: DetectedCallback;
	private processing = new Set<string>();

	constructor(directoryPath: string, onDetected: DetectedCallback) {
		this.directoryPath = directoryPath || 'C\\tmp';
		this.onDetected = onDetected;
	}

	public setDirectory(directoryPath: string): void {
		this.directoryPath = directoryPath || 'C\\tmp';
	}

	public start(): boolean {
		this.stop();
		try {
			if (!fs.existsSync(this.directoryPath) || !fs.statSync(this.directoryPath).isDirectory()) return false;
			this.watcher = fs.watch(this.directoryPath, { persistent: true }, async (_event, filename) => {
				try {
					const name = String(filename || '');
					if (!name) return;
					if (!(/\.fac$/i.test(name) || /^retencion.*\.txt$/i.test(name))) return;
					const full = path.join(this.directoryPath, name);
					if (this.processing.has(full)) return; // evitar doble proceso
					this.processing.add(full);
					try {
						const stable = await this.waitUntilStable(full, 30, 500);
						if (!stable) { this.processing.delete(full); return; }
						const content = await this.readFileWithRetry(full, 40, 500);
						if (content == null) { this.processing.delete(full); return; }
						this.onDetected({ filename: name, fullPath: full, rawContent: content });
					} finally {
						this.processing.delete(full);
					}
				} catch {}
			});
			return true;
		} catch {
			return false;
		}
	}

	public stop(): void {
		try { this.watcher?.close(); } catch {}
		this.watcher = null;
	}

	private async readFileWithRetry(fullPath: string, attempts: number, delayMs: number): Promise<string | null> {
		for (let i = 0; i < Math.max(1, attempts); i++) {
			try {
				const buf = fs.readFileSync(fullPath);
				return buf.toString('utf8');
			} catch (e: any) {
				const code = String(e?.code || '').toUpperCase();
				if (code === 'EBUSY' || code === 'EACCES' || code === 'EPERM') {
					await this.delay(delayMs);
					continue;
				}
				return null;
			}
		}
		return null;
	}

	private async waitUntilStable(fullPath: string, checks: number, intervalMs: number): Promise<boolean> {
		let prevSize = -1;
		let sameCount = 0;
		for (let i = 0; i < Math.max(1, checks); i++) {
			try {
				const st = fs.statSync(fullPath);
				if (st.size === prevSize) {
					sameCount++;
					if (sameCount >= 2) return true; // 2 lecturas consecutivas iguales
				} else {
					prevSize = st.size;
					sameCount = 0;
				}
			} catch (e: any) {
				const code = String(e?.code || '').toUpperCase();
				if (code !== 'ENOENT' && code !== 'EBUSY' && code !== 'EACCES' && code !== 'EPERM') return false;
			}
			await this.delay(intervalMs);
		}
		return false;
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
	}
}

export function createFacWatcher(directoryPath: string, onDetected: DetectedCallback): FacFileWatcher {
	return new FacFileWatcher(directoryPath, onDetected);
}


