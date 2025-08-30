"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
// src/services/AuthService.ts
const electron_store_1 = __importDefault(require("electron-store"));
const argon2_1 = __importDefault(require("argon2"));
const LogService_1 = require("./LogService");
const store = new electron_store_1.default();
const POLICY = {
    minLength: 8,
    requiresNumber: true,
    requiresUpper: true,
    maxAttempts: 5,
    lockoutMinutes: 5,
    throttleMs: 150
};
function passwordValid(pw) {
    if (pw.length < POLICY.minLength)
        return false;
    if (POLICY.requiresNumber && !/\d/.test(pw))
        return false;
    if (POLICY.requiresUpper && !/[A-Z]/.test(pw))
        return false;
    return true;
}
exports.AuthService = {
    isInitialized() {
        const a = store.get('auth') || {};
        return Boolean(a.username && a.passwordHash && a.secretPhraseHash);
    },
    policy() { return POLICY; },
    async setup(username, password, secretPhrase) {
        if (!passwordValid(password))
            throw new Error('weak_password');
        const passwordHash = await argon2_1.default.hash(password, { type: argon2_1.default.argon2id });
        const secretPhraseHash = await argon2_1.default.hash(secretPhrase, { type: argon2_1.default.argon2id });
        store.set('auth', { username, passwordHash, secretPhraseHash, failedCount: 0, lockedUntil: 0 });
        // Log de auditoría
        (0, LogService_1.logAuth)('Administrador configurado exitosamente', { username });
    },
    async login(username, password) {
        await new Promise(r => setTimeout(r, POLICY.throttleMs));
        const a = store.get('auth') || {};
        const now = Date.now();
        if (a.lockedUntil && now < a.lockedUntil) {
            (0, LogService_1.logWarning)('Intento de login bloqueado - cuenta temporalmente suspendida');
            return { ok: false, reason: 'locked', unlockAt: a.lockedUntil };
        }
        if (!a.username || !a.passwordHash)
            return { ok: false, reason: 'not_initialized' };
        const userOk = username === a.username;
        const passOk = userOk ? await argon2_1.default.verify(a.passwordHash, password) : false;
        if (!userOk || !passOk) {
            const failed = (a.failedCount ?? 0) + 1;
            const lock = failed >= POLICY.maxAttempts ? now + POLICY.lockoutMinutes * 60000 : 0;
            store.set('auth', { ...a, failedCount: lock ? 0 : failed, lockedUntil: lock || 0 });
            // Log de auditoría sin datos sensibles
            (0, LogService_1.logWarning)(`Login fallido - intento ${failed}/${POLICY.maxAttempts}${lock ? ' - CUENTA BLOQUEADA' : ''}`);
            return { ok: false, reason: lock ? 'locked' : 'invalid' };
        }
        store.set('auth', { ...a, failedCount: 0, lockedUntil: 0 });
        (0, LogService_1.logSuccess)(`Login exitoso`, { username });
        return { ok: true };
    },
    async changePassword(currentPw, newPw, newUsername, newSecretPhrase) {
        const a = store.get('auth') || {};
        if (!a.passwordHash)
            throw new Error('not_initialized');
        const ok = await argon2_1.default.verify(a.passwordHash, currentPw);
        if (!ok)
            throw new Error('invalid_current');
        if (!passwordValid(newPw))
            throw new Error('weak_password');
        const passwordHash = await argon2_1.default.hash(newPw, { type: argon2_1.default.argon2id });
        const secretPhraseHash = newSecretPhrase
            ? await argon2_1.default.hash(newSecretPhrase, { type: argon2_1.default.argon2id })
            : a.secretPhraseHash;
        store.set('auth', {
            ...a,
            username: newUsername || a.username,
            passwordHash,
            secretPhraseHash
        });
        (0, LogService_1.logAuth)(`Contraseña cambiada exitosamente${newUsername ? ` - nuevo usuario: ${newUsername}` : ''}`);
    },
    async resetBySecret(secretPhrase, newPw, newUsername) {
        const a = store.get('auth') || {};
        if (!a.secretPhraseHash)
            throw new Error('not_initialized');
        const ok = await argon2_1.default.verify(a.secretPhraseHash, secretPhrase);
        if (!ok)
            throw new Error('invalid_secret');
        if (!passwordValid(newPw))
            throw new Error('weak_password');
        const passwordHash = await argon2_1.default.hash(newPw, { type: argon2_1.default.argon2id });
        store.set('auth', { ...a, username: newUsername || a.username, passwordHash });
        (0, LogService_1.logAuth)(`Contraseña reseteada por frase secreta${newUsername ? ` - nuevo usuario: ${newUsername}` : ''}`);
    },
    async resetByOtp(newPw, newUsername) {
        const a = store.get('auth') || {};
        if (!a.passwordHash)
            throw new Error('not_initialized');
        if (!passwordValid(newPw))
            throw new Error('weak_password');
        const passwordHash = await argon2_1.default.hash(newPw, { type: argon2_1.default.argon2id });
        store.set('auth', { ...a, username: newUsername || a.username, passwordHash });
        (0, LogService_1.logAuth)(`Contraseña reseteada por OTP${newUsername ? ` - nuevo usuario: ${newUsername}` : ''}`);
    }
};
