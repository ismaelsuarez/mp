"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AfipLogger = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
const dayjs_1 = __importDefault(require("dayjs"));
class AfipLogger {
    constructor() {
        const userData = electron_1.app.getPath('userData');
        this.logDir = path_1.default.join(userData, 'logs', 'afip');
        this.ensureLogDir();
    }
    ensureLogDir() {
        try {
            fs_1.default.mkdirSync(this.logDir, { recursive: true });
        }
        catch (error) {
            console.error('Error creando directorio de logs AFIP:', error);
        }
    }
    getLogFilePath() {
        const today = (0, dayjs_1.default)().format('YYYYMMDD');
        return path_1.default.join(this.logDir, `${today}.log`);
    }
    log(entry) {
        const logEntry = {
            ...entry,
            timestamp: new Date().toISOString()
        };
        const logLine = JSON.stringify(logEntry) + '\n';
        const logFile = this.getLogFilePath();
        try {
            fs_1.default.appendFileSync(logFile, logLine);
        }
        catch (error) {
            console.error('Error escribiendo log AFIP:', error);
        }
    }
    logRequest(operation, request) {
        this.log({
            operation,
            request: this.sanitizeData(request)
        });
    }
    logResponse(operation, response) {
        this.log({
            operation,
            response: this.sanitizeData(response)
        });
    }
    logError(operation, error, request) {
        this.log({
            operation,
            error: error.message,
            stack: error.stack,
            request: request ? this.sanitizeData(request) : undefined
        });
    }
    sanitizeData(data) {
        if (!data)
            return data;
        // Crear una copia para no modificar el original
        const sanitized = JSON.parse(JSON.stringify(data));
        // Remover datos sensibles si existen
        if (sanitized.cert)
            sanitized.cert = '[REDACTED]';
        if (sanitized.key)
            sanitized.key = '[REDACTED]';
        if (sanitized.token)
            sanitized.token = '[REDACTED]';
        if (sanitized.sign)
            sanitized.sign = '[REDACTED]';
        return sanitized;
    }
    getLogs(date) {
        const targetDate = date || (0, dayjs_1.default)().format('YYYYMMDD');
        const logFile = path_1.default.join(this.logDir, `${targetDate}.log`);
        try {
            if (!fs_1.default.existsSync(logFile))
                return [];
            const content = fs_1.default.readFileSync(logFile, 'utf8');
            return content
                .split('\n')
                .filter(line => line.trim())
                .map(line => JSON.parse(line));
        }
        catch (error) {
            console.error('Error leyendo logs AFIP:', error);
            return [];
        }
    }
}
exports.AfipLogger = AfipLogger;
