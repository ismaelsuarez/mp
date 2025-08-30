"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validarSerial = validarSerial;
exports.guardarLicencia = guardarLicencia;
exports.cargarLicencia = cargarLicencia;
exports.recuperarSerial = recuperarSerial;
exports.licenciaExisteYValida = licenciaExisteYValida;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const config_1 = require("./config");
function computeSerial(nombreCliente, palabraSecreta) {
    const cleanName = String(nombreCliente || '').trim();
    const cleanSecret = String(palabraSecreta || '').trim();
    const data = `${cleanName}::${cleanSecret}`;
    const mac = crypto_1.default.createHmac('sha256', config_1.HMAC_MASTER_SECRET).update(data).digest('hex').toUpperCase();
    const first20 = mac.slice(0, 20);
    return first20.match(/.{1,4}/g)?.join('-') || first20;
}
function validarSerial(nombreCliente, palabraSecreta, serial) {
    const expected = computeSerial(nombreCliente, palabraSecreta).replace(/[^A-Z0-9]/g, '');
    const provided = String(serial || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return expected.length === provided.length && crypto_1.default.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}
function getUserDataPath() {
    try {
        return electron_1.app.getPath('userData');
    }
    catch {
        return path_1.default.join(process.cwd(), '.userData');
    }
}
function getLicenseFilePath() {
    const dir = getUserDataPath();
    return path_1.default.join(dir, 'licencia.dat');
}
function encryptBase64(plain) {
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv('aes-256-gcm', config_1.LICENSE_ENCRYPTION_KEY, iv);
    const enc = Buffer.concat([cipher.update(Buffer.from(plain, 'utf8')), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
}
function decryptBase64(b64) {
    const buf = Buffer.from(b64, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', config_1.LICENSE_ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(data), decipher.final()]);
    return dec.toString('utf8');
}
function guardarLicencia(nombreCliente, serial, palabraSecreta) {
    try {
        if (!nombreCliente || !serial || !palabraSecreta)
            return { ok: false, error: 'missing_fields' };
        if (!validarSerial(nombreCliente, palabraSecreta, serial))
            return { ok: false, error: 'invalid_serial' };
        const payload = { nombreCliente: String(nombreCliente).trim(), serial: serial.toUpperCase(), palabraSecreta: String(palabraSecreta).trim() };
        const json = JSON.stringify(payload);
        const b64 = encryptBase64(json);
        fs_1.default.mkdirSync(getUserDataPath(), { recursive: true });
        fs_1.default.writeFileSync(getLicenseFilePath(), b64, { mode: 0o600 });
        return { ok: true };
    }
    catch (e) {
        return { ok: false, error: String(e?.message || e) };
    }
}
function cargarLicencia() {
    try {
        const p = getLicenseFilePath();
        if (!fs_1.default.existsSync(p))
            return { ok: false, error: 'not_found' };
        const b64 = fs_1.default.readFileSync(p, 'utf8');
        const json = decryptBase64(b64);
        const data = JSON.parse(json);
        if (!data?.nombreCliente || !data?.serial || !data?.palabraSecreta)
            return { ok: false, error: 'corrupt' };
        if (!validarSerial(data.nombreCliente, data.palabraSecreta, data.serial))
            return { ok: false, error: 'invalid_serial' };
        return { ok: true, data };
    }
    catch (e) {
        return { ok: false, error: String(e?.message || e) };
    }
}
function recuperarSerial(nombreCliente, palabraSecreta) {
    try {
        const matchName = String(nombreCliente || '').trim();
        const matchSecret = String(palabraSecreta || '').trim();
        if (!matchName || !matchSecret)
            return { ok: false, error: 'missing_fields' };
        const serial = computeSerial(matchName, matchSecret);
        // Guardar/Actualizar archivo con los nuevos datos
        const save = guardarLicencia(matchName, serial, matchSecret);
        if (!save.ok)
            return { ok: false, error: save.error || 'save_failed' };
        return { ok: true, serial };
    }
    catch (e) {
        return { ok: false, error: String(e?.message || e) };
    }
}
function licenciaExisteYValida() {
    const res = cargarLicencia();
    return !!res.ok;
}
