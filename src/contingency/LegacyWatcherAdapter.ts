import path from 'path';
import fs from 'fs';
import { ContingencyController } from './ContingencyController';

const IGNORE_RE = /\.(part|tmp|filepart)$|(^~\$)|(^\._)/i;

export class LegacyWatcherAdapter {
	private controller: ContingencyController;
	constructor(controller: ContingencyController) { this.controller = controller; }
	bind(legacyEmitter: { on: (ev: string, fn: (...args: any[]) => void) => any }): void {
		legacyEmitter.on('fileReady', (filePath: string) => {
			try {
				if (typeof filePath !== 'string') return;
				const name = path.basename(filePath);
				if (!/\.fac$/i.test(name)) return;
				if (IGNORE_RE.test(name)) return;
				if (!fs.existsSync(filePath)) return;
				const id = this.controller.enqueueFacFromPath(filePath);
				try { console.log(`[contingency] enqueue fac.process sha=... from ${filePath} (id=${id})`); } catch {}
			} catch {}
		});
	}
}
