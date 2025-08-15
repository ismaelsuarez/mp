import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

type LicensePayload = {
	nombreCliente: string;
	serial: string;
	palabraSecreta: string;
};

function getHmacSecret(): Buffer {
	// Ofuscación simple: piezas base64 unidas y decodificadas
	const parts = [
		'c2VndXJh', // segura
		'LV9zZWNyZXRv', // -_secreto
		'LUVsZWN0cm9u', // -Electron
		'LU1QLTIwMjU=' // -MP-2025
	];
	const joined = parts.join('');
	return Buffer.from(joined, 'base64');
}

export function generarSerial(nombreCliente: string): string {
	const cleanName = String(nombreCliente || '').trim();
	const mac = crypto.createHmac('sha256', getHmacSecret()).update(cleanName).digest('hex').toUpperCase();
	// 32 chars, agrupado para legibilidad
	const short = mac.slice(0, 32);
	return short.match(/.{1,4}/g)?.join('-') || short;
}

export function validarSerial(nombreCliente: string, serial: string): boolean {
	const expected = generarSerial(nombreCliente).replace(/[^A-Z0-9]/g, '');
	const provided = String(serial || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
	return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

function getUserDataPath(): string {
	try { return app.getPath('userData'); } catch { return path.join(process.cwd(), '.userData'); }
}

function getLicenseFilePath(): string {
	const dir = getUserDataPath();
	return path.join(dir, 'licencia.dat');
}

function deriveAesKey(): Buffer {
	// Derivar clave simétrica desde un archivo local (o fallback) para cifrar licencia
	const dir = getUserDataPath();
	const keyPath = path.join(dir, 'config.key');
	try {
		if (fs.existsSync(keyPath)) {
			const hex = fs.readFileSync(keyPath, 'utf8').trim();
			return Buffer.from(hex.slice(0, 64).padEnd(64, '0'), 'hex');
		}
		const key = crypto.randomBytes(32);
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(keyPath, key.toString('hex'), { mode: 0o600 });
		return key;
	} catch {
		return crypto.createHash('sha256').update('fallback-key').digest();
	}
}

function encryptBase64(plain: string): string {
	const key = deriveAesKey();
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
	const enc = Buffer.concat([cipher.update(Buffer.from(plain, 'utf8')), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptBase64(b64: string): string {
	const key = deriveAesKey();
	const buf = Buffer.from(b64, 'base64');
	const iv = buf.subarray(0, 12);
	const tag = buf.subarray(12, 28);
	const data = buf.subarray(28);
	const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
	decipher.setAuthTag(tag);
	const dec = Buffer.concat([decipher.update(data), decipher.final()]);
	return dec.toString('utf8');
}

export function guardarLicencia(nombreCliente: string, serial: string, palabraSecreta: string): { ok: boolean; error?: string } {
	try {
		if (!nombreCliente || !serial || !palabraSecreta) return { ok: false, error: 'missing_fields' };
		if (!validarSerial(nombreCliente, serial)) return { ok: false, error: 'invalid_serial' };
		const payload: LicensePayload = { nombreCliente: String(nombreCliente).trim(), serial: serial.toUpperCase(), palabraSecreta: String(palabraSecreta).trim() };
		const json = JSON.stringify(payload);
		const b64 = encryptBase64(json);
		fs.mkdirSync(getUserDataPath(), { recursive: true });
		fs.writeFileSync(getLicenseFilePath(), b64, { mode: 0o600 });
		return { ok: true };
	} catch (e: any) {
		return { ok: false, error: String(e?.message || e) };
	}
}

export function cargarLicencia(): { ok: boolean; data?: LicensePayload; error?: string } {
	try {
		const p = getLicenseFilePath();
		if (!fs.existsSync(p)) return { ok: false, error: 'not_found' };
		const b64 = fs.readFileSync(p, 'utf8');
		const json = decryptBase64(b64);
		const data = JSON.parse(json) as LicensePayload;
		if (!data?.nombreCliente || !data?.serial || !data?.palabraSecreta) return { ok: false, error: 'corrupt' };
		if (!validarSerial(data.nombreCliente, data.serial)) return { ok: false, error: 'invalid_serial' };
		return { ok: true, data };
	} catch (e: any) {
		return { ok: false, error: String(e?.message || e) };
	}
}

export function recuperarSerial(nombreCliente: string, palabraSecreta: string): { ok: boolean; serial?: string; error?: string } {
	try {
		const loaded = cargarLicencia();
		if (!loaded.ok || !loaded.data) return { ok: false, error: loaded.error || 'not_found' };
		const matchName = String(nombreCliente || '').trim();
		const matchSecret = String(palabraSecreta || '').trim();
		if (loaded.data.nombreCliente !== matchName) return { ok: false, error: 'mismatch' };
		if (loaded.data.palabraSecreta !== matchSecret) return { ok: false, error: 'mismatch' };
		const serial = generarSerial(matchName);
		return { ok: true, serial };
	} catch (e: any) {
		return { ok: false, error: String(e?.message || e) };
	}
}

export function licenciaExisteYValida(): boolean {
	const res = cargarLicencia();
	return !!res.ok;
}


