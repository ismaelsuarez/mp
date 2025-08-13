"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendReportEmail = sendReportEmail;
const electron_1 = require("electron");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const electron_store_1 = __importDefault(require("electron-store"));
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
async function sendReportEmail(subject, text, attachments) {
    const cfg = getConfig();
    const to = cfg.EMAIL_REPORT || cfg.ADMIN_ERROR_EMAIL;
    if (!to || !cfg.SMTP_USER || !cfg.SMTP_PASS)
        return false;
    const transporter = nodemailer_1.default.createTransport({
        host: cfg.SMTP_HOST || 'smtp.gmail.com',
        port: Number(cfg.SMTP_PORT || 587),
        secure: Number(cfg.SMTP_PORT || 587) === 465,
        auth: { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS }
    });
    await transporter.sendMail({ from: cfg.SMTP_USER, to, subject, text, attachments });
    return true;
}
