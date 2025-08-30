"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpService = void 0;
// src/services/OtpService.ts
const electron_store_1 = __importDefault(require("electron-store"));
const EmailService_1 = require("./EmailService");
const LogService_1 = require("./LogService");
const store = new electron_store_1.default();
exports.OtpService = {
    async createAndSend(toEmail) {
        const code = ('' + Math.floor(100000 + Math.random() * 900000)).slice(-6);
        const expiresAt = Date.now() + 10 * 60000; // 10 min
        const masked = toEmail.replace(/(.{2}).+(@.+)/, '$1***$2');
        store.set('otp', { code, expiresAt, masked });
        // Enviar email usando el EmailService existente
        await (0, EmailService_1.sendReportEmail)('Código de recuperación - Sistema MP', `Tu código de recuperación es: ${code}\n\nEste código vence en 10 minutos.\n\nSi no solicitaste este código, ignora este mensaje.`, []);
        (0, LogService_1.logAuth)('OTP enviado exitosamente', { email: masked });
        return { masked, ttl: 600 };
    },
    validate(code) {
        const otp = store.get('otp');
        const ok = otp && otp.code === code && Date.now() < otp.expiresAt;
        if (ok) {
            store.delete('otp');
            (0, LogService_1.logSuccess)('OTP validado correctamente');
        }
        else {
            (0, LogService_1.logAuth)('OTP inválido o expirado');
        }
        return Boolean(ok);
    }
};
