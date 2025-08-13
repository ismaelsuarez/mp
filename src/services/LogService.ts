import fs from 'fs';
import path from 'path';

const LOG_ROOT = path.join('C:\\', '2_mp', 'logs');

export function ensureLogsDir(): void {
    try {
        if (!fs.existsSync(LOG_ROOT)) fs.mkdirSync(LOG_ROOT, { recursive: true });
    } catch {}
}

export function getTodayLogPath(): string {
    const date = new Date().toISOString().slice(0, 10);
    return path.join(LOG_ROOT, `mp-app-${date}.log`);
}

export function appendLogLine(message: string, meta?: unknown): void {
    try {
        ensureLogsDir();
        const ts = new Date().toISOString();
        const line = meta ? `${ts} ${message} ${safeJson(meta)}\n` : `${ts} ${message}\n`;
        fs.appendFileSync(getTodayLogPath(), line, 'utf8');
    } catch {}
}

function safeJson(v: unknown): string {
    try {
        // No loguear secretos comunes
        const redact = (obj: any): any => {
            if (!obj || typeof obj !== 'object') return obj;
            const out: any = Array.isArray(obj) ? [] : {};
            for (const [k, val] of Object.entries(obj)) {
                const key = String(k).toLowerCase();
                if (key.includes('token') || key.includes('pass') || key.includes('secret')) {
                    out[k] = '********';
                } else if (val && typeof val === 'object') {
                    out[k] = redact(val);
                } else {
                    out[k] = val;
                }
            }
            return out;
        };
        return JSON.stringify(redact(v));
    } catch { return ''; }
}


