import fs from 'fs';
import path from 'path';

const LOG_ROOT = path.join('C:\\', '2_mp', 'logs');
const LOG_RETENTION_DAYS = 7; // Mantener logs por 7 días

// Utilidades de tiempo local
function pad2(n: number): string { return String(n).padStart(2, '0'); }
function getLocalDateStamp(): string {
	const d = new Date();
	return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function getLocalTimeStamp(): string {
	const d = new Date();
	return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
function getLocalIsoSeconds(): string {
	const d = new Date();
	return `${getLocalDateStamp()}T${getLocalTimeStamp()}`;
}

// Categorías de log para mejor organización
export enum LogCategory {
	INFO = 'INFO',
	SUCCESS = 'SUCCESS',
	WARNING = 'WARNING',
	ERROR = 'ERROR',
	CRITICAL = 'CRITICAL',
	AUTH = 'AUTH',
	FTP = 'FTP',
	MP = 'MP',
	SYSTEM = 'SYSTEM'
}

// Prioridades para ordenamiento
const PRIORITY = {
	[LogCategory.CRITICAL]: 1,
	[LogCategory.ERROR]: 2,
	[LogCategory.WARNING]: 3,
	[LogCategory.AUTH]: 4,
	[LogCategory.FTP]: 5,
	[LogCategory.MP]: 6,
	[LogCategory.SUCCESS]: 7,
	[LogCategory.INFO]: 8,
	[LogCategory.SYSTEM]: 9
};

export function ensureLogsDir(): void {
	try {
		if (!fs.existsSync(LOG_ROOT)) fs.mkdirSync(LOG_ROOT, { recursive: true });
	} catch {}
}

export function getTodayLogPath(): string {
	const date = getLocalDateStamp();
	return path.join(LOG_ROOT, `mp-app-${date}.log`);
}

// Función principal de logging mejorada
export function appendLogLine(category: LogCategory, message: string, meta?: unknown): void {
	try {
		ensureLogsDir();
		const time = getLocalTimeStamp(); // HH:MM:SS local
		
		// Formato mejorado: [HH:MM:SS] [CATEGORÍA] Mensaje {meta}
		let line = `[${time}] [${category.padEnd(8)}] ${message}`;
		
		if (meta) {
			const cleanMeta = safeJson(meta);
			if (cleanMeta) {
				line += ` | ${cleanMeta}`;
			}
		}
		
		line += '\n';
		
		// Escribir al log del día
		fs.appendFileSync(getTodayLogPath(), line, 'utf8');
		
		// También escribir al log de errores críticos si es necesario
		if (category === LogCategory.CRITICAL || category === LogCategory.ERROR) {
			const errorLogPath = path.join(LOG_ROOT, 'errors.log');
			const errorLine = `[${getLocalIsoSeconds()}] [${category}] ${message}\n`;
			fs.appendFileSync(errorLogPath, errorLine, 'utf8');
		}
		
		// Limpiar logs antiguos periódicamente (cada 10 logs)
		if (Math.random() < 0.1) { // 10% de probabilidad
			cleanOldLogs();
		}
		
	} catch (error) {
		console.error('Error writing to log:', error);
	}
}

// Función para limpiar logs antiguos
function cleanOldLogs(): void {
	try {
		if (!fs.existsSync(LOG_ROOT)) return;
		
		const files = fs.readdirSync(LOG_ROOT);
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - LOG_RETENTION_DAYS);
		
		for (const file of files) {
			if (file.startsWith('mp-app-') && file.endsWith('.log')) {
				const dateMatch = file.match(/mp-app-(\d{4}-\d{2}-\d{2})\.log/);
				if (dateMatch) {
					const fileDate = new Date(dateMatch[1]);
					if (fileDate < cutoffDate) {
						const filePath = path.join(LOG_ROOT, file);
						fs.unlinkSync(filePath);
						console.log(`[LogService] Eliminado log antiguo: ${file}`);
					}
				}
			}
		}
	} catch (error) {
		console.error('Error cleaning old logs:', error);
	}
}

export function ensureTodayLogExists(): void {
	try {
		ensureLogsDir();
		const p = getTodayLogPath();
		if (!fs.existsSync(p)) {
			const header = `# ========================================
# MP Application Log - ${getLocalIsoSeconds()}
# ========================================
# Formato: [HH:MM:SS] [CATEGORÍA] Mensaje | Meta
# Categorías: INFO, SUCCESS, WARNING, ERROR, CRITICAL, AUTH, FTP, MP, SYSTEM
# ========================================

`;
			fs.writeFileSync(p, header, 'utf8');
		}
	} catch {}
}

// Función para obtener resumen de logs del día
export function getTodayLogSummary(): { total: number; errors: number; warnings: number; auth: number; ftp: number } {
	try {
		const logPath = getTodayLogPath();
		if (!fs.existsSync(logPath)) return { total: 0, errors: 0, warnings: 0, auth: 0, ftp: 0 };
		
		const content = fs.readFileSync(logPath, 'utf8');
		const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
		
		const summary = { total: lines.length, errors: 0, warnings: 0, auth: 0, ftp: 0 };
		
		for (const line of lines) {
			if (line.includes('[ERROR]') || line.includes('[CRITICAL]')) summary.errors++;
			if (line.includes('[WARNING]')) summary.warnings++;
			if (line.includes('[AUTH]')) summary.auth++;
			if (line.includes('[FTP]')) summary.ftp++;
		}
		
		return summary;
	} catch {
		return { total: 0, errors: 0, warnings: 0, auth: 0, ftp: 0 };
	}
}

// Función para buscar errores en logs recientes
export function getRecentErrors(hours: number = 24): string[] {
	try {
		const errors: string[] = [];
		const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
		
		// Buscar en el log de errores
		const errorLogPath = path.join(LOG_ROOT, 'errors.log');
		if (fs.existsSync(errorLogPath)) {
			const content = fs.readFileSync(errorLogPath, 'utf8');
			const lines = content.split('\n').filter(line => line.trim());
			
			for (const line of lines) {
				const timeMatch = line.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
				if (timeMatch) {
					const logTime = new Date(timeMatch[1]);
					if (logTime >= cutoffTime) {
						errors.push(line);
					}
				}
			}
		}
		
		return errors.slice(-50); // Últimos 50 errores
	} catch {
		return [];
	}
}

function safeJson(v: unknown): string {
	try {
		// No loguear secretos comunes
		const redact = (obj: any): any => {
			if (!obj || typeof obj !== 'object') return obj;
			const out: any = Array.isArray(obj) ? [] : {};
			for (const [k, val] of Object.entries(obj)) {
				const key = String(k).toLowerCase();
				if (key.includes('token') || key.includes('pass') || key.includes('secret') || key.includes('key')) {
					out[k] = '********';
				} else if (val && typeof val === 'object') {
					out[k] = redact(val);
				} else {
					out[k] = val;
				}
			}
			return out;
		};
		
		const clean = redact(v);
		return JSON.stringify(clean).slice(0, 200); // Limitar longitud
	} catch { 
		return ''; 
	}
}

// Funciones de conveniencia para diferentes tipos de log
export function logInfo(message: string, meta?: unknown): void {
	appendLogLine(LogCategory.INFO, message, meta);
}

export function logSuccess(message: string, meta?: unknown): void {
	appendLogLine(LogCategory.SUCCESS, message, meta);
}

export function logWarning(message: string, meta?: unknown): void {
	appendLogLine(LogCategory.WARNING, message, meta);
}

export function logError(message: string, meta?: unknown): void {
	appendLogLine(LogCategory.ERROR, message, meta);
}

export function logCritical(message: string, meta?: unknown): void {
	appendLogLine(LogCategory.CRITICAL, message, meta);
}

export function logAuth(message: string, meta?: unknown): void {
	appendLogLine(LogCategory.AUTH, message, meta);
}

export function logFtp(message: string, meta?: unknown): void {
	appendLogLine(LogCategory.FTP, message, meta);
}

export function logMp(message: string, meta?: unknown): void {
	appendLogLine(LogCategory.MP, message, meta);
}

export function logSystem(message: string, meta?: unknown): void {
	appendLogLine(LogCategory.SYSTEM, message, meta);
}


