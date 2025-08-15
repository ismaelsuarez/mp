// src/services/OtpService.ts
import Store from 'electron-store';
import crypto from 'crypto';
import { sendReportEmail } from './EmailService';
import { logAuth, logSuccess } from './LogService';

const store = new Store<{ otp?: { code: string, expiresAt: number, masked: string } }>();

export const OtpService = {
  async createAndSend(toEmail: string) {
    const code = ('' + Math.floor(100000 + Math.random()*900000)).slice(-6);
    const expiresAt = Date.now() + 10 * 60_000; // 10 min
    const masked = toEmail.replace(/(.{2}).+(@.+)/, '$1***$2');
    store.set('otp', { code, expiresAt, masked });
    
    // Enviar email usando el EmailService existente
    await sendReportEmail(
      'Código de recuperación - Sistema MP',
      `Tu código de recuperación es: ${code}\n\nEste código vence en 10 minutos.\n\nSi no solicitaste este código, ignora este mensaje.`,
      []
    );
    
    logAuth('OTP enviado exitosamente', { email: masked });
    return { masked, ttl: 600 };
  },
  
  validate(code: string) {
    const otp = store.get('otp');
    const ok = otp && otp.code === code && Date.now() < otp.expiresAt;
    if (ok) {
      store.delete('otp');
      logSuccess('OTP validado correctamente');
    } else {
      logAuth('OTP inválido o expirado');
    }
    return Boolean(ok);
  }
};
