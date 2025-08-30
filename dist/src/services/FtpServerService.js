"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startFtpServer = startFtpServer;
exports.stopFtpServer = stopFtpServer;
exports.isFtpServerRunning = isFtpServerRunning;
const LogService_1 = require("./LogService");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
let ftpServer = null;
async function startFtpServer(cfg) {
    try {
        const { host = '0.0.0.0', port = 2121, user = 'user', pass = 'pass' } = cfg || {};
        const pasvHost = cfg?.pasv_host || '';
        const pasvMin = Number.isFinite(cfg?.pasv_min) ? cfg?.pasv_min : 50000;
        const pasvMax = Number.isFinite(cfg?.pasv_max) ? cfg?.pasv_max : 50100;
        let root = cfg?.root || path_1.default.join('C:', 'tmp', 'ftp_share');
        // Normalizar ruta de Windows y asegurar absoluta
        try {
            const raw = String(root || '').trim();
            let normalized = raw.replace(/\//g, path_1.default.sep);
            if (/^[A-Za-z][\\/]/.test(normalized) && !/^[A-Za-z]:[\\/]/.test(normalized)) {
                normalized = normalized[0] + ':' + normalized.slice(1);
            }
            if (!path_1.default.isAbsolute(normalized)) {
                normalized = path_1.default.resolve(normalized);
            }
            // Crear si no existe
            fs_1.default.mkdirSync(normalized, { recursive: true });
            root = normalized;
        }
        catch (e) {
            (0, LogService_1.logError)('FTP root normalization failed', { message: e?.message || String(e) });
        }
        if (ftpServer) {
            await stopFtpServer();
        }
        // Lazy import con fallback: primero intenta "@trinket/ftp-srv", si no existe usa "ftp-srv"
        let FtpSrvCtor;
        try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore - paquete opcional
            const mod = await Promise.resolve().then(() => __importStar(require('@trinket/ftp-srv')));
            FtpSrvCtor = mod.FtpSrv || mod.default;
        }
        catch (_e) {
            const mod = await Promise.resolve().then(() => __importStar(require('ftp-srv')));
            FtpSrvCtor = mod.default || mod.FtpSrv;
        }
        const options = {
            url: `ftp://${host}:${port}`,
            pasv_min: pasvMin,
            pasv_max: pasvMax,
            anonymous: false
        };
        if (pasvHost && typeof pasvHost === 'string') {
            options.pasv_url = pasvHost; // FTP PASV URL anunciada
        }
        ftpServer = new FtpSrvCtor(options);
        ftpServer.on('login', ({ username, password }, resolve, reject) => {
            try {
                if (String(username) === String(user) && String(password) === String(pass)) {
                    (0, LogService_1.logInfo)('FTP login OK', { username });
                    return resolve({ root });
                }
                // No exponer la contraseña; mostrar usuario (y IP si está disponible por otros logs)
                try {
                    console.warn('[ftp] login reject user=', username);
                }
                catch { }
                (0, LogService_1.logError)('FTP login reject', { username });
                return reject(new Error('Invalid credentials'));
            }
            catch (e) {
                (0, LogService_1.logError)('FTP login error', { message: e?.message || String(e) });
                return reject(new Error('Login error'));
            }
        });
        ftpServer.on('client-error', (_client, ctx, err) => {
            (0, LogService_1.logError)('FTP client error', { ctx, message: String(err?.message || err) });
        });
        ftpServer.on('server-error', (err) => {
            (0, LogService_1.logError)('FTP server error', { message: String(err?.message || err) });
        });
        ftpServer.on('connection', () => (0, LogService_1.logInfo)('FTP connection'));
        await ftpServer.listen();
        (0, LogService_1.logInfo)('FTP server started', { host, port, root, pasvHost: pasvHost || undefined, pasvRange: `${pasvMin}-${pasvMax}` });
        return true;
    }
    catch (e) {
        (0, LogService_1.logError)('Failed to start FTP server', { message: e?.message || String(e) });
        ftpServer = null;
        return false;
    }
}
async function stopFtpServer() {
    try {
        if (ftpServer && typeof ftpServer.close === 'function') {
            await ftpServer.close();
            (0, LogService_1.logInfo)('FTP server stopped');
        }
    }
    catch (e) {
        (0, LogService_1.logError)('Failed to stop FTP server', { message: e?.message || String(e) });
        return false;
    }
    finally {
        ftpServer = null;
    }
    return true;
}
function isFtpServerRunning() {
    return !!ftpServer;
}
