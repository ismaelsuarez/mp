// src/services/AuthService.ts
import Store from 'electron-store';
import argon2 from 'argon2';
import { appendLogLine } from './LogService';

type AuthState = {
  username?: string;
  passwordHash?: string;
  secretPhraseHash?: string;
  failedCount?: number;
  lockedUntil?: number;
};

const store = new Store<{ auth: AuthState }>();

const POLICY = {
  minLength: 8,
  requiresNumber: true,
  requiresUpper: true,
  maxAttempts: 5,
  lockoutMinutes: 5,
  throttleMs: 150
};

function passwordValid(pw: string) {
  if (pw.length < POLICY.minLength) return false;
  if (POLICY.requiresNumber && !/\d/.test(pw)) return false;
  if (POLICY.requiresUpper && !/[A-Z]/.test(pw)) return false;
  return true;
}

export const AuthService = {
  isInitialized(): boolean {
    const a = store.get('auth') || {};
    return Boolean(a.username && a.passwordHash && a.secretPhraseHash);
  },

  policy() { return POLICY; },

  async setup(username: string, password: string, secretPhrase: string) {
    if (!passwordValid(password)) throw new Error('weak_password');
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const secretPhraseHash = await argon2.hash(secretPhrase, { type: argon2.argon2id });
    store.set('auth', { username, passwordHash, secretPhraseHash, failedCount: 0, lockedUntil: 0 });
    
    // Log de auditoría
    appendLogLine(`AUTH: Administrador creado: ${username}`);
  },

  async login(username: string, password: string) {
    await new Promise(r => setTimeout(r, POLICY.throttleMs));
    const a = store.get('auth') || {};
    const now = Date.now();
    
    if (a.lockedUntil && now < a.lockedUntil) {
      appendLogLine(`AUTH: Intento de login bloqueado - cuenta temporalmente suspendida`);
      return { ok: false, reason: 'locked', unlockAt: a.lockedUntil };
    }
    
    if (!a.username || !a.passwordHash) return { ok: false, reason: 'not_initialized' };
    
    const userOk = username === a.username;
    const passOk = userOk ? await argon2.verify(a.passwordHash!, password) : false;

    if (!userOk || !passOk) {
      const failed = (a.failedCount ?? 0) + 1;
      const lock = failed >= POLICY.maxAttempts ? now + POLICY.lockoutMinutes * 60_000 : 0;
      store.set('auth', { ...a, failedCount: lock ? 0 : failed, lockedUntil: lock || 0 });
      
      // Log de auditoría sin datos sensibles
      appendLogLine(`AUTH: Login fallido - intento ${failed}/${POLICY.maxAttempts}${lock ? ' - CUENTA BLOQUEADA' : ''}`);
      
      return { ok: false, reason: lock ? 'locked' : 'invalid' };
    }
    
    store.set('auth', { ...a, failedCount: 0, lockedUntil: 0 });
    appendLogLine(`AUTH: Login exitoso: ${username}`);
    return { ok: true };
  },

  async changePassword(currentPw: string, newPw: string, newUsername?: string, newSecretPhrase?: string) {
    const a = store.get('auth') || {};
    if (!a.passwordHash) throw new Error('not_initialized');
    
    const ok = await argon2.verify(a.passwordHash, currentPw);
    if (!ok) throw new Error('invalid_current');
    if (!passwordValid(newPw)) throw new Error('weak_password');

    const passwordHash = await argon2.hash(newPw, { type: argon2.argon2id });
    const secretPhraseHash = newSecretPhrase
      ? await argon2.hash(newSecretPhrase, { type: argon2.argon2id })
      : a.secretPhraseHash;

    store.set('auth', {
      ...a,
      username: newUsername || a.username,
      passwordHash,
      secretPhraseHash
    });
    
    appendLogLine(`AUTH: Contraseña cambiada${newUsername ? ` - nuevo usuario: ${newUsername}` : ''}`);
  },

  async resetBySecret(secretPhrase: string, newPw: string, newUsername?: string) {
    const a = store.get('auth') || {};
    if (!a.secretPhraseHash) throw new Error('not_initialized');
    
    const ok = await argon2.verify(a.secretPhraseHash, secretPhrase);
    if (!ok) throw new Error('invalid_secret');
    if (!passwordValid(newPw)) throw new Error('weak_password');
    
    const passwordHash = await argon2.hash(newPw, { type: argon2.argon2id });
    store.set('auth', { ...a, username: newUsername || a.username, passwordHash });
    
    appendLogLine(`AUTH: Contraseña reseteada por frase secreta${newUsername ? ` - nuevo usuario: ${newUsername}` : ''}`);
  },

  async resetByOtp(newPw: string, newUsername?: string) {
    const a = store.get('auth') || {};
    if (!a.passwordHash) throw new Error('not_initialized');
    if (!passwordValid(newPw)) throw new Error('weak_password');
    
    const passwordHash = await argon2.hash(newPw, { type: argon2.argon2id });
    store.set('auth', { ...a, username: newUsername || a.username, passwordHash });
    
    appendLogLine(`AUTH: Contraseña reseteada por OTP${newUsername ? ` - nuevo usuario: ${newUsername}` : ''}`);
  }
};


