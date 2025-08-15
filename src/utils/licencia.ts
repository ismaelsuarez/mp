import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { HMAC_MASTER_SECRET, LICENSE_ENCRYPTION_KEY } from './config';

type LicensePayload = {
	nombreCliente: string;
	serial: string;
	palabraSecreta: string;
};

function computeSerial(nombreCliente: string, palabraSecreta: string): string {
	const cleanName = String(nombreCliente || '').trim();
	const cleanSecret = String(palabraSecreta || '').trim();
	const data = `${cleanName}::${cleanSecret}`;
	const mac = crypto.createHmac('sha256', HMAC_MASTER_SECRET).update(data).digest('hex').toUpperCase();
	const first20 = mac.slice(0, 20);
	return first20.match(/.{1,4}/g)?.join('-') || first20;
}

export function validarSerial(nombreCliente: string, palabraSecreta: string, serial: string): boolean {
	const expected = computeSerial(nombreCliente, palabraSecreta).replace(/[^A-Z0-9]/g, '');
	const provided = String(serial || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
	return expected.length === provided.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

function getUserDataPath(): string {
	try { return app.getPath('userData'); } catch { return path.join(process.cwd(), '.userData'); }
}

function getLicenseFilePath(): string {
	const dir = getUserDataPath();
	return path.join(dir, 'licencia.dat');
}

function encryptBase64(plain: string): string {
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', LICENSE_ENCRYPTION_KEY, iv);
	const enc = Buffer.concat([cipher.update(Buffer.from(plain, 'utf8')), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptBase64(b64: string): string {
	const buf = Buffer.from(b64, 'base64');
	const iv = buf.subarray(0, 12);
	const tag = buf.subarray(12, 28);
	const data = buf.subarray(28);
	const decipher = crypto.createDecipheriv('aes-256-gcm', LICENSE_ENCRYPTION_KEY, iv);
	decipher.setAuthTag(tag);
	const dec = Buffer.concat([decipher.update(data), decipher.final()]);
	return dec.toString('utf8');
}

export function guardarLicencia(nombreCliente: string, serial: string, palabraSecreta: string): { ok: boolean; error?: string } {
	try {
		if (!nombreCliente || !serial || !palabraSecreta) return { ok: false, error: 'missing_fields' };
		if (!validarSerial(nombreCliente, palabraSecreta, serial)) return { ok: false, error: 'invalid_serial' };
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
		if (!validarSerial(data.nombreCliente, data.palabraSecreta, data.serial)) return { ok: false, error: 'invalid_serial' };
		return { ok: true, data };
	} catch (e: any) {
		return { ok: false, error: String(e?.message || e) };
	}
}

export function recuperarSerial(nombreCliente: string, palabraSecreta: string): { ok: boolean; serial?: string; error?: string } {
	try {
		const matchName = String(nombreCliente || '').trim();
		const matchSecret = String(palabraSecreta || '').trim();
		if (!matchName || !matchSecret) return { ok: false, error: 'missing_fields' };
		const serial = computeSerial(matchName, matchSecret);
		// Guardar/Actualizar archivo con los nuevos datos
		const save = guardarLicencia(matchName, serial, matchSecret);
		if (!save.ok) return { ok: false, error: save.error || 'save_failed' };
		return { ok: true, serial };
	} catch (e: any) {
		return { ok: false, error: String(e?.message || e) };
	}
}

export function licenciaExisteYValida(): boolean {
	const res = cargarLicencia();
	return !!res.ok;
}


