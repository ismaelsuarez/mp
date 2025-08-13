import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import Store from 'electron-store';
import dayjs from 'dayjs';
import { Client } from 'basic-ftp';

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
	const store = new Store<{ config?: any }>({ name: 'settings', encryptionKey: getEncryptionKey() });
	return (store.get('config') as any) || {};
}

function normalizeDir(dir: string | undefined): string | undefined {
    if (!dir) return undefined;
    // Usar separador POSIX para rutas remotas FTP
    let d = String(dir).replace(/\\/g, '/');
    // Quitar dobles barras y trailing slash
    d = d.replace(/\/+$/, '');
    return d;
}

export async function testFtp() {
	const cfg = getConfig();
	if (!cfg.FTP_IP || !cfg.FTP_USER || !cfg.FTP_PASS) throw new Error('Config FTP incompleta');
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

export async function sendDbf(localPath: string, remoteFileName: string = 'mp.dbf') {
	const cfg = getConfig();
	if (!cfg.FTP_IP || !cfg.FTP_USER || !cfg.FTP_PASS) throw new Error('Config FTP incompleta');
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
        const remoteName = remoteFileName.toLowerCase();
        await client.uploadFrom(localPath, remoteName);
        return { remoteDir: dir || '/', remoteFile: remoteName };
	} finally {
		client.close();
	}
}


