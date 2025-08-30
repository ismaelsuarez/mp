"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearLastSentHash = clearLastSentHash;
exports.testFtp = testFtp;
exports.sendTodayDbf = sendTodayDbf;
exports.sendDbf = sendDbf;
exports.sendArbitraryFile = sendArbitraryFile;
const electron_1 = require("electron");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const electron_store_1 = __importDefault(require("electron-store"));
const dayjs_1 = __importDefault(require("dayjs"));
const basic_ftp_1 = require("basic-ftp");
const crypto_1 = __importDefault(require("crypto"));
const LogService_1 = require("./LogService");
const ErrorNotificationService_1 = require("./ErrorNotificationService");
function getEncryptionKey() {
    try {
        const keyPath = path_1.default.join(electron_1.app.getPath('userData'), 'config.key');
        if (fs_1.default.existsSync(keyPath))
            return fs_1.default.readFileSync(keyPath, 'utf8');
        return undefined;
    }
    catch {
        return undefined;
    }
}
function getConfig() {
    const store = new electron_store_1.default({ name: 'settings', encryptionKey: getEncryptionKey() });
    return store.get('config') || {};
}
function normalizeDir(dir) {
    if (!dir)
        return undefined;
    // Usar separador POSIX para rutas remotas FTP
    let d = String(dir).replace(/\\/g, '/');
    // Quitar dobles barras y trailing slash
    d = d.replace(/\/+$/, '');
    return d;
}
// Función para calcular hash MD5 de un archivo
function calculateFileHash(filePath) {
    const fileBuffer = fs_1.default.readFileSync(filePath);
    const hashSum = crypto_1.default.createHash('md5');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}
// Función para obtener el hash del último archivo enviado
function getLastSentHash() {
    const store = new electron_store_1.default({ name: 'settings', encryptionKey: getEncryptionKey() });
    return store.get('lastMpDbfHash') || null;
}
// Función para guardar el hash del archivo enviado
function saveLastSentHash(hash) {
    const store = new electron_store_1.default({ name: 'settings', encryptionKey: getEncryptionKey() });
    store.set('lastMpDbfHash', hash);
}
// Función para limpiar el hash guardado (forzar envío en próximo intento)
function clearLastSentHash() {
    const store = new electron_store_1.default({ name: 'settings', encryptionKey: getEncryptionKey() });
    store.delete('lastMpDbfHash');
    (0, LogService_1.logFtp)('Hash del último archivo enviado limpiado');
}
// Función para verificar si el archivo ha cambiado
function hasFileChanged(filePath) {
    try {
        const currentHash = calculateFileHash(filePath);
        const lastHash = getLastSentHash();
        // Si no hay hash anterior, considerar que ha cambiado (primer envío)
        if (!lastHash) {
            return true;
        }
        // Comparar hashes
        return currentHash !== lastHash;
    }
    catch (error) {
        // Si hay error al calcular hash, considerar que ha cambiado para seguridad
        console.warn('[FtpService] Error calculating file hash:', error);
        return true;
    }
}
async function testFtp() {
    const cfg = getConfig();
    if (!cfg.FTP_IP || !cfg.FTP_USER || !cfg.FTP_PASS) {
        (0, ErrorNotificationService_1.recordError)('FTP_CONFIG', 'Configuración FTP incompleta', { config: { hasIp: !!cfg.FTP_IP, hasUser: !!cfg.FTP_USER, hasPass: !!cfg.FTP_PASS } });
        throw new Error('Config FTP incompleta');
    }
    const client = new basic_ftp_1.Client();
    try {
        await client.access({
            host: String(cfg.FTP_IP),
            port: 21,
            user: String(cfg.FTP_USER),
            password: String(cfg.FTP_PASS),
            secure: false,
        });
        const dir = normalizeDir(cfg.FTP_DIR);
        if (dir)
            await client.ensureDir(dir);
        return true;
    }
    finally {
        client.close();
    }
}
async function sendTodayDbf() {
    const cfg = getConfig();
    if (!cfg.FTP_IP || !cfg.FTP_USER || !cfg.FTP_PASS)
        throw new Error('Config FTP incompleta');
    const tag = (0, dayjs_1.default)().format('YYYY-MM-DD');
    const documentsDir = electron_1.app.getPath('documents');
    const outDir = path_1.default.join(documentsDir, 'MP-Reportes');
    // Preferir mp.dbf por requerimiento; si no existe, usar nombre configurado o el por fecha
    const preferred = 'mp.dbf';
    let fileName = preferred;
    let localPath = path_1.default.join(outDir, fileName);
    if (!fs_1.default.existsSync(localPath)) {
        fileName = cfg.FTP_FILE || `transactions-detailed-${tag}.dbf`;
        localPath = path_1.default.join(outDir, fileName);
    }
    if (!fs_1.default.existsSync(localPath))
        throw new Error(`No existe archivo DBF local: ${localPath}`);
    const client = new basic_ftp_1.Client();
    try {
        await client.access({
            host: String(cfg.FTP_IP),
            port: 21,
            user: String(cfg.FTP_USER),
            password: String(cfg.FTP_PASS),
            secure: false,
        });
        const dir = normalizeDir(cfg.FTP_DIR);
        if (dir)
            await client.ensureDir(dir);
        const remoteName = path_1.default.basename(fileName);
        await client.uploadFrom(localPath, remoteName);
        return { remoteDir: dir || '/', remoteFile: remoteName };
    }
    finally {
        client.close();
    }
}
async function sendDbf(localPath, remoteFileName = 'mp.dbf', options) {
    const cfg = getConfig();
    if (!cfg.FTP_IP || !cfg.FTP_USER || !cfg.FTP_PASS) {
        (0, ErrorNotificationService_1.recordError)('FTP_CONFIG', 'Configuración FTP incompleta para envío', { config: { hasIp: !!cfg.FTP_IP, hasUser: !!cfg.FTP_USER, hasPass: !!cfg.FTP_PASS } });
        throw new Error('Config FTP incompleta');
    }
    if (!fs_1.default.existsSync(localPath)) {
        (0, ErrorNotificationService_1.recordError)('FTP_FILE', 'Archivo DBF no encontrado', { localPath, remoteFileName });
        throw new Error(`No existe archivo DBF local: ${localPath}`);
    }
    // Verificar si el archivo ha cambiado antes de enviar (a menos que se fuerce)
    const forceSend = !!(options && options.force);
    if (!forceSend) {
        const fileChanged = hasFileChanged(localPath);
        if (!fileChanged) {
            (0, LogService_1.logFtp)('Archivo mp.dbf sin cambios - omitiendo envío FTP');
            return {
                remoteDir: normalizeDir(cfg.FTP_DIR) || '/',
                remoteFile: remoteFileName.toLowerCase(),
                skipped: true,
                reason: 'sin cambios - no se envía'
            };
        }
    }
    (0, LogService_1.logFtp)('Archivo mp.dbf con cambios - enviando por FTP...');
    const client = new basic_ftp_1.Client();
    try {
        await client.access({
            host: String(cfg.FTP_IP),
            port: 21,
            user: String(cfg.FTP_USER),
            password: String(cfg.FTP_PASS),
            secure: false,
        });
        const dir = normalizeDir(cfg.FTP_DIR);
        if (dir)
            await client.ensureDir(dir);
        const remoteName = remoteFileName.toLowerCase();
        await client.uploadFrom(localPath, remoteName);
        // Guardar el hash del archivo enviado
        const currentHash = calculateFileHash(localPath);
        saveLastSentHash(currentHash);
        return {
            remoteDir: dir || '/',
            remoteFile: remoteName,
            skipped: false,
            hash: currentHash
        };
    }
    finally {
        client.close();
    }
}
// Enviar un archivo arbitrario por FTP (sin hash/skip)
async function sendArbitraryFile(localPath, remoteFileName) {
    const cfg = getConfig();
    if (!cfg.FTP_IP || !cfg.FTP_USER || !cfg.FTP_PASS) {
        (0, ErrorNotificationService_1.recordError)('FTP_CONFIG', 'Configuración FTP incompleta para envío', { config: { hasIp: !!cfg.FTP_IP, hasUser: !!cfg.FTP_USER, hasPass: !!cfg.FTP_PASS } });
        throw new Error('Config FTP incompleta');
    }
    if (!fs_1.default.existsSync(localPath)) {
        (0, ErrorNotificationService_1.recordError)('FTP_FILE', 'Archivo local no encontrado', { localPath });
        throw new Error(`No existe archivo local: ${localPath}`);
    }
    const client = new basic_ftp_1.Client();
    try {
        await client.access({
            host: String(cfg.FTP_IP),
            port: Number(cfg.FTP_PORT || 21),
            user: String(cfg.FTP_USER),
            password: String(cfg.FTP_PASS),
            secure: !!cfg.FTP_SECURE,
        });
        const dir = normalizeDir(cfg.FTP_DIR);
        if (dir)
            await client.ensureDir(dir);
        const remoteName = String(remoteFileName || path_1.default.basename(localPath));
        await client.uploadFrom(localPath, remoteName);
        (0, LogService_1.logSuccess)('Archivo enviado por FTP', { localPath, remote: `${dir || '/'}${remoteName}` });
        return { remoteDir: dir || '/', remoteFile: remoteName };
    }
    finally {
        client.close();
    }
}
