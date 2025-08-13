"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureLogsDir = ensureLogsDir;
exports.getTodayLogPath = getTodayLogPath;
exports.appendLogLine = appendLogLine;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const LOG_ROOT = path_1.default.join('C:\\', '2_mp', 'logs');
function ensureLogsDir() {
    try {
        if (!fs_1.default.existsSync(LOG_ROOT))
            fs_1.default.mkdirSync(LOG_ROOT, { recursive: true });
    }
    catch { }
}
function getTodayLogPath() {
    const date = new Date().toISOString().slice(0, 10);
    return path_1.default.join(LOG_ROOT, `mp-app-${date}.log`);
}
function appendLogLine(message, meta) {
    try {
        ensureLogsDir();
        const ts = new Date().toISOString();
        const line = meta ? `${ts} ${message} ${safeJson(meta)}\n` : `${ts} ${message}\n`;
        fs_1.default.appendFileSync(getTodayLogPath(), line, 'utf8');
    }
    catch { }
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
                if (key.includes('token') || key.includes('pass') || key.includes('secret')) {
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
        return JSON.stringify(redact(v));
    }
    catch {
        return '';
    }
}
