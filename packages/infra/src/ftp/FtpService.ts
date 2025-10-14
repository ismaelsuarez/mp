import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import Store from 'electron-store';
import dayjs from 'dayjs';
import { Client } from 'basic-ftp';
import crypto from 'crypto';
import { logFtp, logSuccess, logWarning } from '@infra/logger';
import { recordError } from '../../../../apps/electron/src/services/ErrorNotificationService';
import { cajaLog } from '../../../../apps/electron/src/services/CajaLogService';

function getEncryptionKey(): string | undefined {
	try {
		const keyPath = path.join(app.getPath('userData'), 'config.key');
		if (fs.existsSync(keyPath)) return fs.readFileSync(keyPath, 'utf8');
		return undefined;
	} catch {
		return undefined;
	}
}

function getConfig() {
    const store = new Store<{ config?: any }>({ name: 'settings', cwd: (()=>{ try { return app.getPath('userData'); } catch { return undefined; } })(), encryptionKey: getEncryptionKey() });
	return (store.get('config') as any) || {};
}

function setConfigPartial(partial: Record<string, unknown>) {
    const store = new Store<{ config?: any }>({ name: 'settings', cwd: (()=>{ try { return app.getPath('userData'); } catch { return undefined; } })(), encryptionKey: getEncryptionKey() });
	const current = (store.get('config') as any) || {};
	store.set('config', { ...current, ...partial });
}

function normalizeDir(dir: string | undefined): string | undefined {
    if (!dir) return undefined;
    // Usar separador POSIX para rutas remotas FTP
    let d = String(dir).replace(/\\/g, '/');
    // Quitar dobles barras y trailing slash
    d = d.replace(/\/+$/, '');
    return d;
}

// ===== SFTP (SSH) helpers =====
async function ensureSftpDir(sftp: any, dir: string | undefined) {
    if (!dir) return;
    const normalized = String(dir).replace(/\\/g, '/');
    try { await sftp.mkdir(normalized, true); } catch {}
}

async function testWhatsappSftpInternal(cfg: any) {
    let SFTPClient: any;
    try { SFTPClient = require('ssh2-sftp-client'); } catch { throw new Error('Falta dependencia ssh2-sftp-client. Ejecuta: npm i ssh2-sftp-client'); }
    const sftp = new SFTPClient();
    try {
        logFtp('WA SFTP: conectando...', { host: cfg.FTP_WHATSAPP_IP, port: cfg.FTP_WHATSAPP_PORT });
        await sftp.connect({
            host: String(cfg.FTP_WHATSAPP_IP),
            port: Number(cfg.FTP_WHATSAPP_PORT || 22),
            username: String(cfg.FTP_WHATSAPP_USER),
            password: String(cfg.FTP_WHATSAPP_PASS),
            hostHash: 'sha256',
            hostVerifier: (hash: string) => {
                try {
                    const fp = cfg.FTP_WHATSAPP_SSH_FP;
                    if (!fp) { setConfigPartial({ FTP_WHATSAPP_SSH_FP: hash }); return true; }
                    return String(fp) === String(hash);
                } catch { return true; }
            }
        } as any);
        logFtp('WA SFTP: conectado');
        const dir = normalizeDir(cfg.FTP_WHATSAPP_DIR) || '/';
        await ensureSftpDir(sftp, dir);
        logFtp('WA SFTP: ensureDir OK', { dir });
        return true;
    } catch (e: any) {
        logWarning('WA SFTP: error de prueba', { error: String(e?.message || e) });
        throw e;
    } finally { try { await sftp.end(); } catch {} }
}

async function sendWhatsappFilesSftpInternal(cfg: any, filePaths: string[], remoteNames?: string[]) {
    let SFTPClient: any;
    try { SFTPClient = require('ssh2-sftp-client'); } catch { 
        cajaLog.logWhatsappError('Falta dependencia ssh2-sftp-client');
        throw new Error('Falta dependencia ssh2-sftp-client. Ejecuta: npm i ssh2-sftp-client'); 
    }
    const sftp = new SFTPClient();
    try {
        logFtp('WA SFTP: conectando para envío múltiple...', { host: cfg.FTP_WHATSAPP_IP, port: cfg.FTP_WHATSAPP_PORT });
        await sftp.connect({
            host: String(cfg.FTP_WHATSAPP_IP),
            port: Number(cfg.FTP_WHATSAPP_PORT || 22),
            username: String(cfg.FTP_WHATSAPP_USER),
            password: String(cfg.FTP_WHATSAPP_PASS),
            hostHash: 'sha256',
            hostVerifier: (hash: string) => {
                try {
                    const fp = cfg.FTP_WHATSAPP_SSH_FP;
                    if (!fp) { setConfigPartial({ FTP_WHATSAPP_SSH_FP: hash }); return true; }
                    return String(fp) === String(hash);
                } catch { return true; }
            }
        } as any);
        const dir = normalizeDir(cfg.FTP_WHATSAPP_DIR) || '/';
        await ensureSftpDir(sftp, dir);
        
        for (let i = 0; i < filePaths.length; i++) {
            const local = filePaths[i];
            if (!local || !fs.existsSync(local)) continue;
            const rn = (remoteNames && remoteNames[i]) ? remoteNames[i] : path.basename(local);
            const remotePath = (dir.endsWith('/') ? dir : dir + '/') + rn;
            logFtp('WA SFTP: subiendo archivo', { local, remote: remotePath });
            await sftp.put(local, remotePath);
            logSuccess('WA SFTP: archivo enviado', { local, remote: remotePath });
            
            // Log específico para WhatsApp
            cajaLog.logWhatsappEnviado(`${cfg.FTP_WHATSAPP_IP}:${dir}/${rn}`);
        }
        return { ok: true };
    } catch (e: any) {
        const errMsg = String(e?.message || e);
        logWarning('WA SFTP: error envío múltiple', { error: errMsg });
        cajaLog.logWhatsappError(errMsg);
        throw e;
    } finally { try { await sftp.end(); } catch {} }
}

async function sendWhatsappFileSftpInternal(cfg: any, localPath: string, remoteName?: string) {
    let SFTPClient: any;
    try { SFTPClient = require('ssh2-sftp-client'); } catch { 
        cajaLog.logWhatsappError('Falta dependencia ssh2-sftp-client');
        throw new Error('Falta dependencia ssh2-sftp-client. Ejecuta: npm i ssh2-sftp-client'); 
    }
    const sftp = new SFTPClient();
    try {
        logFtp('WA SFTP: conectando para envío individual...', { host: cfg.FTP_WHATSAPP_IP, port: cfg.FTP_WHATSAPP_PORT });
        await sftp.connect({
            host: String(cfg.FTP_WHATSAPP_IP),
            port: Number(cfg.FTP_WHATSAPP_PORT || 22),
            username: String(cfg.FTP_WHATSAPP_USER),
            password: String(cfg.FTP_WHATSAPP_PASS),
            hostHash: 'sha256',
            hostVerifier: (hash: string) => {
                try {
                    const fp = cfg.FTP_WHATSAPP_SSH_FP;
                    if (!fp) { setConfigPartial({ FTP_WHATSAPP_SSH_FP: hash }); return true; }
                    return String(fp) === String(hash);
                } catch { return true; }
            }
        } as any);
        const dir = normalizeDir(cfg.FTP_WHATSAPP_DIR) || '/';
        await ensureSftpDir(sftp, dir);
        const rn = String(remoteName || path.basename(localPath));
        const remotePath = (dir.endsWith('/') ? dir : dir + '/') + rn;
        logFtp('WA SFTP: subiendo archivo', { localPath, remote: remotePath });
        await sftp.put(localPath, remotePath);
        logSuccess('WA SFTP: archivo enviado', { localPath, remote: remotePath });
        
        // Log específico para WhatsApp
        cajaLog.logWhatsappEnviado(`${cfg.FTP_WHATSAPP_IP}:${dir}/${rn}`);
        
        return { remoteDir: dir || '/', remoteFile: rn };
    } catch (e: any) {
        const errMsg = String(e?.message || e);
        logWarning('WA SFTP: error envío individual', { error: errMsg });
        cajaLog.logWhatsappError(errMsg);
        throw e;
    } finally { try { await sftp.end(); } catch {} }
}
// Función para calcular hash MD5 de un archivo
function calculateFileHash(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('md5');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

// Función para obtener el hash del último archivo enviado
function getLastSentHash(): string | null {
    const store = new Store<{ config?: any; lastMpDbfHash?: string }>({ name: 'settings', encryptionKey: getEncryptionKey() });
    return (store.get('lastMpDbfHash') as string) || null;
}

// Función para guardar el hash del archivo enviado
function saveLastSentHash(hash: string): void {
    const store = new Store<{ config?: any; lastMpDbfHash?: string }>({ name: 'settings', encryptionKey: getEncryptionKey() });
    store.set('lastMpDbfHash', hash);
}

// Función para limpiar el hash guardado (forzar envío en próximo intento)
export function clearLastSentHash(): void {
    const store = new Store<{ config?: any; lastMpDbfHash?: string }>({ name: 'settings', encryptionKey: getEncryptionKey() });
    store.delete('lastMpDbfHash');
    logFtp('Hash del último archivo enviado limpiado');
}

// Función para verificar si el archivo ha cambiado
function hasFileChanged(filePath: string): boolean {
    try {
        const currentHash = calculateFileHash(filePath);
        const lastHash = getLastSentHash();
        
        // Si no hay hash anterior, considerar que ha cambiado (primer envío)
        if (!lastHash) {
            return true;
        }
        
        // Comparar hashes
        return currentHash !== lastHash;
    } catch (error) {
        // Si hay error al calcular hash, considerar que ha cambiado para seguridad
        console.warn('[FtpService] Error calculating file hash:', error);
        return true;
    }
}

export async function testFtp() {
	const cfg = getConfig();
	if (!cfg.FTP_IP || !cfg.FTP_USER || !cfg.FTP_PASS) {
		recordError('FTP_CONFIG', 'Configuración FTP incompleta', { config: { hasIp: !!cfg.FTP_IP, hasUser: !!cfg.FTP_USER, hasPass: !!cfg.FTP_PASS } });
		throw new Error('Config FTP incompleta');
	}
	const client = new Client();
	try {
        await client.access({
			host: String(cfg.FTP_IP),
			port: 21,
			user: String(cfg.FTP_USER),
			password: String(cfg.FTP_PASS),
			secure: false,
		});
        const dir = normalizeDir(cfg.FTP_DIR);
        if (dir) await client.ensureDir(dir);
		return true;
	} finally {
		client.close();
	}
}

export async function testWhatsappFtp() {
    const cfg = getConfig();
    if (!cfg.FTP_WHATSAPP_IP || !cfg.FTP_WHATSAPP_USER || !cfg.FTP_WHATSAPP_PASS) {
        recordError('FTP_WA_CONFIG', 'Configuración FTP WhatsApp incompleta', { config: { hasIp: !!cfg.FTP_WHATSAPP_IP, hasUser: !!cfg.FTP_WHATSAPP_USER, hasPass: !!cfg.FTP_WHATSAPP_PASS } });
        throw new Error('Config FTP WhatsApp incompleta');
    }
    // Si se activa SFTP o el puerto no es 21, probamos por SSH en lugar de FTP
    if (cfg.FTP_WHATSAPP_SFTP || Number(cfg.FTP_WHATSAPP_PORT || 0) !== 21) {
        logFtp('WA Test: usando SFTP (SSH)', { host: cfg.FTP_WHATSAPP_IP, port: cfg.FTP_WHATSAPP_PORT });
        return await testWhatsappSftpInternal(cfg);
    }
    logFtp('WA Test: usando FTP', { host: cfg.FTP_WHATSAPP_IP, port: cfg.FTP_WHATSAPP_PORT });
    // Intento 1: PASV clásico (useEPSV=false), luego fallback a EPSV si falla
    const attempt = async (preferEPSV: boolean) => {
        const c = new Client();
        try {
            await c.access({
                host: String(cfg.FTP_WHATSAPP_IP),
                port: Number(cfg.FTP_WHATSAPP_PORT || 21),
                user: String(cfg.FTP_WHATSAPP_USER),
                password: String(cfg.FTP_WHATSAPP_PASS),
                secure: !!cfg.FTP_WHATSAPP_SECURE,
            });
            try { (c as any).ftp.useEPSV = preferEPSV; } catch {}
            const dir = normalizeDir(cfg.FTP_WHATSAPP_DIR);
            if (dir) await c.ensureDir(dir);
            return true;
        } finally { c.close(); }
    };
    try { return await attempt(false); } catch { return await attempt(true); }
}

export async function sendTodayDbf() {
	const cfg = getConfig();
	if (!cfg.FTP_IP || !cfg.FTP_USER || !cfg.FTP_PASS) throw new Error('Config FTP incompleta');
	const tag = dayjs().format('YYYY-MM-DD');
	const documentsDir = app.getPath('documents');
	const outDir = path.join(documentsDir, 'MP-Reportes');
	// Preferir mp.dbf por requerimiento; si no existe, usar nombre configurado o el por fecha
	const preferred = 'mp.dbf';
	let fileName = preferred;
	let localPath = path.join(outDir, fileName);
	if (!fs.existsSync(localPath)) {
		fileName = cfg.FTP_FILE || `transactions-detailed-${tag}.dbf`;
		localPath = path.join(outDir, fileName);
	}
	if (!fs.existsSync(localPath)) throw new Error(`No existe archivo DBF local: ${localPath}`);

    const client = new Client();
	try {
        await client.access({
			host: String(cfg.FTP_IP),
			port: 21,
			user: String(cfg.FTP_USER),
			password: String(cfg.FTP_PASS),
			secure: false,
		});
        const dir = normalizeDir(cfg.FTP_DIR);
        if (dir) await client.ensureDir(dir);
        const remoteName = path.basename(fileName);
        await client.uploadFrom(localPath, remoteName);
        return { remoteDir: dir || '/', remoteFile: remoteName };
	} finally {
		client.close();
	}
}

export async function sendDbf(localPath: string, remoteFileName: string = 'mp.dbf', options?: { force?: boolean }) {
	const cfg = getConfig();
	if (!cfg.FTP_IP || !cfg.FTP_USER || !cfg.FTP_PASS) {
		recordError('FTP_CONFIG', 'Configuración FTP incompleta para envío', { config: { hasIp: !!cfg.FTP_IP, hasUser: !!cfg.FTP_USER, hasPass: !!cfg.FTP_PASS } });
		throw new Error('Config FTP incompleta');
	}
	if (!fs.existsSync(localPath)) {
		recordError('FTP_FILE', 'Archivo DBF no encontrado', { localPath, remoteFileName });
		throw new Error(`No existe archivo DBF local: ${localPath}`);
	}
	
	// Verificar si el archivo ha cambiado antes de enviar (a menos que se fuerce)
	const forceSend = !!(options && options.force);
	if (!forceSend) {
		const fileChanged = hasFileChanged(localPath);
		if (!fileChanged) {
			logFtp('Archivo mp.dbf sin cambios - omitiendo envío FTP');
			return { 
				remoteDir: normalizeDir(cfg.FTP_DIR) || '/', 
				remoteFile: remoteFileName.toLowerCase(),
				skipped: true,
				reason: 'sin cambios - no se envía'
			};
		}
	}
	
	logFtp('Archivo mp.dbf con cambios - enviando por FTP...');
	
    const client = new Client();
	try {
        await client.access({
			host: String(cfg.FTP_IP),
			port: 21,
			user: String(cfg.FTP_USER),
			password: String(cfg.FTP_PASS),
			secure: false,
		});
        const dir = normalizeDir(cfg.FTP_DIR);
        if (dir) await client.ensureDir(dir);
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
	} finally {
		client.close();
	}
}

// ===== FTP Mercado Pago (config separada) =====
export function getMpFtpConfig() {
  const store = new Store<{ config?: any }>({ name: 'settings', encryptionKey: getEncryptionKey() });
  const cfg: any = (store.get('config') as any) || {};
  return {
    host: cfg.MP_FTP_IP,
    port: Number(cfg.MP_FTP_PORT || 21),
    user: cfg.MP_FTP_USER,
    pass: cfg.MP_FTP_PASS,
    secure: !!cfg.MP_FTP_SECURE,
    dir: cfg.MP_FTP_DIR,
  };
}

export async function saveMpFtpConfig(partial: any) {
  const store = new Store<{ config?: any }>({ name: 'settings', encryptionKey: getEncryptionKey() });
  const current = (store.get('config') as any) || {};
  store.set('config', { ...current, ...partial });
  return true;
}

export async function testMpFtp() {
  const cfg = getMpFtpConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) {
    recordError('MP_FTP_CONFIG', 'Config MP FTP incompleta', { hasIp: !!cfg.host, hasUser: !!cfg.user, hasPass: !!cfg.pass });
    throw new Error('Config MP FTP incompleta');
  }
  const client = new Client();
  try {
    await client.access({ host: String(cfg.host), port: Number(cfg.port || 21), user: String(cfg.user), password: String(cfg.pass), secure: !!cfg.secure });
    const dir = normalizeDir(cfg.dir);
    if (dir) await client.ensureDir(dir);
    return true;
  } finally { client.close(); }
}

// Hash separado para MP (evitar colisión con FTP general)
function getLastMpDbfHash(): string | null {
  const store = new Store<{ config?: any; lastMpDbfHashDedicated?: string }>({ name: 'settings', encryptionKey: getEncryptionKey() });
  return (store.get('lastMpDbfHashDedicated') as string) || null;
}
function saveLastMpDbfHash(hash: string): void {
  const store = new Store<{ config?: any; lastMpDbfHashDedicated?: string }>({ name: 'settings', encryptionKey: getEncryptionKey() });
  store.set('lastMpDbfHashDedicated', hash);
}

export async function sendMpDbf(localPath?: string, remoteFileName?: string, options?: { force?: boolean }) {
  const cfg = getMpFtpConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) {
    recordError('MP_FTP_CONFIG', 'Config MP FTP incompleta para envío', { hasIp: !!cfg.host, hasUser: !!cfg.user, hasPass: !!cfg.pass });
    throw new Error('Config MP FTP incompleta');
  }
  // Local: preferir outDir de ReportService
  let lp = localPath;
  if (!lp) {
    try {
      const { getOutDir } = require('./ReportService');
      const outDir = getOutDir();
      lp = path.join(outDir, 'mp.dbf');
    } catch {}
  }
  if (!lp || !fs.existsSync(lp)) throw new Error(`No existe archivo DBF local: ${lp}`);

  const forceSend = !!(options && options.force);
  const remoteName = (remoteFileName && String(remoteFileName).trim().length > 0)
    ? String(remoteFileName).toLowerCase()
    : 'mp.dbf';
  const useDedup = !forceSend && remoteName === 'mp.dbf';
  if (useDedup) {
    const currentHash = calculateFileHash(lp);
    const lastHash = getLastMpDbfHash();
    if (lastHash && lastHash === currentHash) {
      logFtp('MP FTP: mp.dbf sin cambios - omitiendo envío');
      return { skipped: true, reason: 'sin cambios' } as any;
    }
  }

  const client = new Client();
  try {
    await client.access({ host: String(cfg.host), port: Number(cfg.port || 21), user: String(cfg.user), password: String(cfg.pass), secure: !!cfg.secure });
    const dir = normalizeDir(cfg.dir);
    if (dir) await client.ensureDir(dir);
    await client.uploadFrom(lp, remoteName);
    const h = calculateFileHash(lp);
    if (remoteName === 'mp.dbf') saveLastMpDbfHash(h);
    logSuccess('MP FTP: archivo enviado', { remote: `${dir || '/'}${remoteName}` });
    return { skipped: false, remoteDir: dir || '/', remoteFile: remoteName };
  } finally { client.close(); }
}

// Alias semántico más versátil para reutilizar el canal FTP-MP desde otros flujos
export async function sendMpFtpFile(localPath: string, remoteFileName?: string, options?: { force?: boolean }) {
  return await sendMpDbf(localPath, remoteFileName, options);
}

// Enviar múltiples archivos usando configuración FTP-MP
export async function sendMpFtpFiles(filePaths: string[], remoteNames?: string[]) {
  const cfg = getMpFtpConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) {
    recordError('MP_FTP_CONFIG', 'Config MP FTP incompleta para envío múltiple', { hasIp: !!cfg.host, hasUser: !!cfg.user, hasPass: !!cfg.pass });
    throw new Error('Config MP FTP incompleta');
  }
  const client = new Client();
  try {
    await client.access({ host: String(cfg.host), port: Number(cfg.port || 21), user: String(cfg.user), password: String(cfg.pass), secure: !!cfg.secure });
    const dir = normalizeDir(cfg.dir);
    if (dir) await client.ensureDir(dir);
    const results: any[] = [];
    for (let i = 0; i < filePaths.length; i++) {
      const local = filePaths[i];
      if (!local || !fs.existsSync(local)) continue;
      const rn = (remoteNames && remoteNames[i]) ? String(remoteNames[i]) : path.basename(local);
      await client.uploadFrom(local, rn);
      logSuccess('MP FTP: archivo enviado', { local, remote: `${dir || '/'}${rn}` });
      results.push({ local, remote: `${dir || '/'}${rn}` });
    }
    return { ok: true, results };
  } finally { client.close(); }
}


// Enviar un archivo arbitrario por FTP (sin hash/skip)
export async function sendArbitraryFile(localPath: string, remoteFileName?: string) {
    const cfg = getConfig();
    if (!cfg.FTP_IP || !cfg.FTP_USER || !cfg.FTP_PASS) {
        recordError('FTP_CONFIG', 'Configuración FTP incompleta para envío', { config: { hasIp: !!cfg.FTP_IP, hasUser: !!cfg.FTP_USER, hasPass: !!cfg.FTP_PASS } });
        throw new Error('Config FTP incompleta');
    }
    if (!fs.existsSync(localPath)) {
        recordError('FTP_FILE', 'Archivo local no encontrado', { localPath });
        throw new Error(`No existe archivo local: ${localPath}`);
    }

    const client = new Client();
    try {
        await client.access({
            host: String(cfg.FTP_IP),
            port: Number(cfg.FTP_PORT || 21),
            user: String(cfg.FTP_USER),
            password: String(cfg.FTP_PASS),
            secure: !!cfg.FTP_SECURE,
        });
        const dir = normalizeDir(cfg.FTP_DIR);
        if (dir) await client.ensureDir(dir);
        const remoteName = String(remoteFileName || path.basename(localPath));
        await client.uploadFrom(localPath, remoteName);
        logSuccess('Archivo enviado por FTP', { localPath, remote: `${dir || '/'}${remoteName}` });
        return { remoteDir: dir || '/', remoteFile: remoteName };
    } finally {
        client.close();
    }
}


// Enviar múltiples archivos al FTP de WhatsApp
export async function sendFilesToWhatsappFtp(filePaths: string[], remoteNames?: string[]) {
    const cfg = getConfig();
    const wip = cfg.FTP_WHATSAPP_IP;
    const wuser = cfg.FTP_WHATSAPP_USER;
    const wpass = cfg.FTP_WHATSAPP_PASS;
    if (!wip || !wuser || !wpass) {
        logWarning('Config FTP WhatsApp incompleta - se omite envío', { hasIp: !!wip, hasUser: !!wuser, hasPass: !!wpass });
        return { ok: false, skipped: true, reason: 'config incompleta' } as any;
    }
    // Si está habilitado SFTP en config, usar SSH2-SFTP
    if (cfg.FTP_WHATSAPP_SFTP) {
        return await (async () => await sendWhatsappFilesSftpInternal(cfg, filePaths, remoteNames))();
    }
    const tryMode = async (preferEPSV: boolean) => {
        const c = new Client();
        try {
            await c.access({
                host: String(wip),
                port: Number(cfg.FTP_WHATSAPP_PORT || 21),
                user: String(wuser),
                password: String(wpass),
                secure: !!cfg.FTP_WHATSAPP_SECURE,
            });
            try { (c as any).ftp.useEPSV = preferEPSV; } catch {}
            const dir = normalizeDir(cfg.FTP_WHATSAPP_DIR);
            if (dir) await c.ensureDir(dir);
            for (let i = 0; i < filePaths.length; i++) {
                const local = filePaths[i];
                if (!local || !fs.existsSync(local)) continue;
                const rn = (remoteNames && remoteNames[i]) ? remoteNames[i] : path.basename(local);
                logFtp('WA FTP: subiendo archivo', { local, remote: `${dir || '/'}${rn}` });
                await c.uploadFrom(local, rn);
                logSuccess('WA FTP: archivo enviado', { local, remote: `${dir || '/'}${rn}` });
                
                // Log específico para WhatsApp
                cajaLog.logWhatsappEnviado(`${wip}:${dir || '/'}${rn}`);
            }
            return { ok: true };
        } finally { c.close(); }
    };
    try { 
        return await tryMode(false); 
    } catch (e: any) { 
        try {
            return await tryMode(true);
        } catch (e2: any) {
            cajaLog.logWhatsappError(String(e2?.message || e2));
            throw e2;
        }
    }
}

// Enviar un archivo individual al FTP de WhatsApp
export async function sendWhatsappFile(localPath: string, remoteFileName?: string) {
    const cfg = getConfig();
    const wip = cfg.FTP_WHATSAPP_IP;
    const wuser = cfg.FTP_WHATSAPP_USER;
    const wpass = cfg.FTP_WHATSAPP_PASS;
    if (!wip || !wuser || !wpass) {
        recordError('FTP_WA_CONFIG', 'Configuración FTP WhatsApp incompleta', { config: { hasIp: !!wip, hasUser: !!wuser, hasPass: !!wpass } });
        cajaLog.logWhatsappError('Config FTP incompleta');
        throw new Error('Config FTP WhatsApp incompleta');
    }
    if (!fs.existsSync(localPath)) {
        recordError('FTP_FILE', 'Archivo local no encontrado (WA)', { localPath });
        cajaLog.logWhatsappError('Archivo no encontrado');
        throw new Error(`No existe archivo local: ${localPath}`);
    }
    if (cfg.FTP_WHATSAPP_SFTP) {
        return await (async () => await sendWhatsappFileSftpInternal(cfg, localPath, remoteFileName))();
    }
    const sendWith = async (preferEPSV: boolean) => {
        const c = new Client();
        try {
            await c.access({
                host: String(wip),
                port: Number(cfg.FTP_WHATSAPP_PORT || 21),
                user: String(wuser),
                password: String(wpass),
                secure: !!cfg.FTP_WHATSAPP_SECURE,
            });
            try { (c as any).ftp.useEPSV = preferEPSV; } catch {}
            const dir = normalizeDir(cfg.FTP_WHATSAPP_DIR);
            if (dir) await c.ensureDir(dir);
            const remoteName = String(remoteFileName || path.basename(localPath));
            logFtp('WA FTP: subiendo archivo', { localPath, remote: `${dir || '/'}${remoteName}` });
            await c.uploadFrom(localPath, remoteName);
            logSuccess('WA FTP: archivo enviado', { localPath, remote: `${dir || '/'}${remoteName}` });
            
            // Log específico para WhatsApp
            cajaLog.logWhatsappEnviado(`${wip}:${dir || '/'}${remoteName}`);
            
            return { remoteDir: dir || '/', remoteFile: remoteName };
        } finally { c.close(); }
    };
    try { 
        return await sendWith(false); 
    } catch (e: any) { 
        try {
            return await sendWith(true);
        } catch (e2: any) {
            cajaLog.logWhatsappError(String(e2?.message || e2));
            throw e2;
        }
    }
}

