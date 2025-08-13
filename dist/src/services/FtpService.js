"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testFtp = testFtp;
exports.sendTodayDbf = sendTodayDbf;
exports.sendDbf = sendDbf;
const electron_1 = require("electron");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const electron_store_1 = __importDefault(require("electron-store"));
const dayjs_1 = __importDefault(require("dayjs"));
const basic_ftp_1 = require("basic-ftp");
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
async function testFtp() {
    const cfg = getConfig();
    if (!cfg.FTP_IP || !cfg.FTP_USER || !cfg.FTP_PASS)
        throw new Error('Config FTP incompleta');
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
async function sendDbf(localPath, remoteFileName = 'mp.dbf') {
    const cfg = getConfig();
    if (!cfg.FTP_IP || !cfg.FTP_USER || !cfg.FTP_PASS)
        throw new Error('Config FTP incompleta');
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
        const remoteName = remoteFileName.toLowerCase();
        await client.uploadFrom(localPath, remoteName);
        return { remoteDir: dir || '/', remoteFile: remoteName };
    }
    finally {
        client.close();
    }
}
