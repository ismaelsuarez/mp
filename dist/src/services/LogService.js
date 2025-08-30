"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogCategory = void 0;
exports.ensureLogsDir = ensureLogsDir;
exports.getTodayLogPath = getTodayLogPath;
exports.appendLogLine = appendLogLine;
exports.ensureTodayLogExists = ensureTodayLogExists;
exports.getTodayLogSummary = getTodayLogSummary;
exports.getRecentErrors = getRecentErrors;
exports.logInfo = logInfo;
exports.logSuccess = logSuccess;
exports.logWarning = logWarning;
exports.logError = logError;
exports.logCritical = logCritical;
exports.logAuth = logAuth;
exports.logFtp = logFtp;
exports.logMp = logMp;
exports.logSystem = logSystem;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const LOG_ROOT = path_1.default.join('C:\\', '2_mp', 'logs');
const LOG_RETENTION_DAYS = 7; // Mantener logs por 7 días
// Utilidades de tiempo local
function pad2(n) { return String(n).padStart(2, '0'); }
function getLocalDateStamp() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function getLocalTimeStamp() {
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
function getLocalIsoSeconds() {
    const d = new Date();
    return `${getLocalDateStamp()}T${getLocalTimeStamp()}`;
}
// Categorías de log para mejor organización
var LogCategory;
(function (LogCategory) {
    LogCategory["INFO"] = "INFO";
    LogCategory["SUCCESS"] = "SUCCESS";
    LogCategory["WARNING"] = "WARNING";
    LogCategory["ERROR"] = "ERROR";
    LogCategory["CRITICAL"] = "CRITICAL";
    LogCategory["AUTH"] = "AUTH";
    LogCategory["FTP"] = "FTP";
    LogCategory["MP"] = "MP";
    LogCategory["SYSTEM"] = "SYSTEM";
})(LogCategory || (exports.LogCategory = LogCategory = {}));
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
function ensureLogsDir() {
    try {
        if (!fs_1.default.existsSync(LOG_ROOT))
            fs_1.default.mkdirSync(LOG_ROOT, { recursive: true });
    }
    catch { }
}
function getTodayLogPath() {
    const date = getLocalDateStamp();
    return path_1.default.join(LOG_ROOT, `mp-app-${date}.log`);
}
// Función principal de logging mejorada
function appendLogLine(category, message, meta) {
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
        fs_1.default.appendFileSync(getTodayLogPath(), line, 'utf8');
        // También escribir al log de errores críticos si es necesario
        if (category === LogCategory.CRITICAL || category === LogCategory.ERROR) {
            const errorLogPath = path_1.default.join(LOG_ROOT, 'errors.log');
            const errorLine = `[${getLocalIsoSeconds()}] [${category}] ${message}\n`;
            fs_1.default.appendFileSync(errorLogPath, errorLine, 'utf8');
        }
        // Limpiar logs antiguos periódicamente (cada 10 logs)
        if (Math.random() < 0.1) { // 10% de probabilidad
            cleanOldLogs();
        }
    }
    catch (error) {
        console.error('Error writing to log:', error);
    }
}
// Función para limpiar logs antiguos
function cleanOldLogs() {
    try {
        if (!fs_1.default.existsSync(LOG_ROOT))
            return;
        const files = fs_1.default.readdirSync(LOG_ROOT);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - LOG_RETENTION_DAYS);
        for (const file of files) {
            if (file.startsWith('mp-app-') && file.endsWith('.log')) {
                const dateMatch = file.match(/mp-app-(\d{4}-\d{2}-\d{2})\.log/);
                if (dateMatch) {
                    const fileDate = new Date(dateMatch[1]);
                    if (fileDate < cutoffDate) {
                        const filePath = path_1.default.join(LOG_ROOT, file);
                        fs_1.default.unlinkSync(filePath);
                        console.log(`[LogService] Eliminado log antiguo: ${file}`);
                    }
                }
            }
        }
    }
    catch (error) {
        console.error('Error cleaning old logs:', error);
    }
}
function ensureTodayLogExists() {
    try {
        ensureLogsDir();
        const p = getTodayLogPath();
        if (!fs_1.default.existsSync(p)) {
            const header = `# ========================================
# MP Application Log - ${getLocalIsoSeconds()}
# ========================================
# Formato: [HH:MM:SS] [CATEGORÍA] Mensaje | Meta
# Categorías: INFO, SUCCESS, WARNING, ERROR, CRITICAL, AUTH, FTP, MP, SYSTEM
# ========================================

`;
            fs_1.default.writeFileSync(p, header, 'utf8');
        }
    }
    catch { }
}
// Función para obtener resumen de logs del día
function getTodayLogSummary() {
    try {
        const logPath = getTodayLogPath();
        if (!fs_1.default.existsSync(logPath))
            return { total: 0, errors: 0, warnings: 0, auth: 0, ftp: 0 };
        const content = fs_1.default.readFileSync(logPath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        const summary = { total: lines.length, errors: 0, warnings: 0, auth: 0, ftp: 0 };
        for (const line of lines) {
            if (line.includes('[ERROR]') || line.includes('[CRITICAL]'))
                summary.errors++;
            if (line.includes('[WARNING]'))
                summary.warnings++;
            if (line.includes('[AUTH]'))
                summary.auth++;
            if (line.includes('[FTP]'))
                summary.ftp++;
        }
        return summary;
    }
    catch {
        return { total: 0, errors: 0, warnings: 0, auth: 0, ftp: 0 };
    }
}
// Función para buscar errores en logs recientes
function getRecentErrors(hours = 24) {
    try {
        const errors = [];
        const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
        // Buscar en el log de errores
        const errorLogPath = path_1.default.join(LOG_ROOT, 'errors.log');
        if (fs_1.default.existsSync(errorLogPath)) {
            const content = fs_1.default.readFileSync(errorLogPath, 'utf8');
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
    }
    catch {
        return [];
    }
}
function safeJson(v) {
    try {
        // No loguear secretos comunes
        const redact = (obj) => {
            if (!obj || typeof obj !== 'object')
                return obj;
            const out = Array.isArray(obj) ? [] : {};
            for (const [k, val] of Object.entries(obj)) {
                const key = String(k).toLowerCase();
                if (key.includes('token') || key.includes('pass') || key.includes('secret') || key.includes('key')) {
                    out[k] = '********';
                }
                else if (val && typeof val === 'object') {
                    out[k] = redact(val);
                }
                else {
                    out[k] = val;
                }
            }
            return out;
        };
        const clean = redact(v);
        return JSON.stringify(clean).slice(0, 200); // Limitar longitud
    }
    catch {
        return '';
    }
}
// Funciones de conveniencia para diferentes tipos de log
function logInfo(message, meta) {
    appendLogLine(LogCategory.INFO, message, meta);
}
function logSuccess(message, meta) {
    appendLogLine(LogCategory.SUCCESS, message, meta);
}
function logWarning(message, meta) {
    appendLogLine(LogCategory.WARNING, message, meta);
}
function logError(message, meta) {
    appendLogLine(LogCategory.ERROR, message, meta);
}
function logCritical(message, meta) {
    appendLogLine(LogCategory.CRITICAL, message, meta);
}
function logAuth(message, meta) {
    appendLogLine(LogCategory.AUTH, message, meta);
}
function logFtp(message, meta) {
    appendLogLine(LogCategory.FTP, message, meta);
}
function logMp(message, meta) {
    appendLogLine(LogCategory.MP, message, meta);
}
function logSystem(message, meta) {
    appendLogLine(LogCategory.SYSTEM, message, meta);
}
