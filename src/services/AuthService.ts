import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import Store from 'electron-store';

type SettingsSchema = { config?: Record<string, unknown>; config_pass?: string };

function getEncryptionKey(): string | undefined {
    try {
        const keyPath = path.join(app.getPath('userData'), 'config.key');
        if (fs.existsSync(keyPath)) return fs.readFileSync(keyPath, 'utf8');
        return undefined;
    } catch {
        return undefined;
    }
}

const store = new Store<SettingsSchema>({ name: 'settings', encryptionKey: getEncryptionKey() });

function deriveHash(password: string, salt: string): string {
    const buf = crypto.scryptSync(password, salt, 64);
    return buf.toString('hex');
}

export function isConfigPasswordSet(): boolean {
    const v = store.get('config_pass');
    return typeof v === 'string' && v.includes(':');
}

export function verifyConfigPassword(pass: string): boolean {
    const stored = store.get('config_pass');
    if (!stored || typeof stored !== 'string') return false;
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    try {
        const cand = deriveHash(pass, salt);
        return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(cand, 'hex'));
    } catch {
        return false;
    }
}

export function setConfigPassword(oldPass: string | null, newPass: string): boolean {
    const exists = isConfigPasswordSet();
    if (exists) {
        if (!oldPass || !verifyConfigPassword(oldPass)) return false;
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = deriveHash(newPass, salt);
    store.set('config_pass', `${salt}:${hash}`);
    return true;
}


