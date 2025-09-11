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
			this.watcher = fs.watch(this.directoryPath, { persistent: true }, (_event, filename) => {
				try {
					const name = String(filename || '');
					if (!name) return;
					if (!/\.fac$/i.test(name)) return;
					const full = path.join(this.directoryPath, name);
					this.readFileWithRetry(full, 10, 300).then((content) => {
						if (content == null) return;
						this.onDetected({ filename: name, fullPath: full, rawContent: content });
					}).catch(() => {});
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

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
	}
}

export function createFacWatcher(directoryPath: string, onDetected: DetectedCallback): FacFileWatcher {
	return new FacFileWatcher(directoryPath, onDetected);
}


