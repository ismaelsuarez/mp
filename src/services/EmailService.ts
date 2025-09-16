import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import Store from 'electron-store';

function getEncryptionKey(): string | undefined {
	try {
		const keyPath = path.join(app.getPath('userData'), 'config.key');
		if (fs.existsSync(keyPath)) return fs.readFileSync(keyPath, 'utf8');
		return undefined;
	} catch { return undefined; }
}

function getConfig() {
	const store = new Store<{ config?: any }>({ name: 'settings', encryptionKey: getEncryptionKey() });
	return (store.get('config') as any) || {};
}

export async function sendReportEmail(subject: string, text: string, attachments: Array<{ filename: string; path: string }>) {
	const cfg = getConfig();
	const to = cfg.EMAIL_REPORT || cfg.ADMIN_ERROR_EMAIL;
	if (!to || !cfg.SMTP_USER || !cfg.SMTP_PASS) return false;

	const transporter = nodemailer.createTransport({
		host: cfg.SMTP_HOST || 'smtp.gmail.com',
		port: Number(cfg.SMTP_PORT || 587),
		secure: Number(cfg.SMTP_PORT || 587) === 465,
		auth: { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS }
	});
	await transporter.sendMail({ from: cfg.SMTP_USER, to, subject, text, attachments });
	return true;
}

/**
 * Enviar recibo por email (HTML + adjunto PDF)
 * - subject por defecto: "Recibo de pago"
 * - Usa configuración SMTP estándar desde settings (no loguea contraseña)
 * - Validación simple de email
 *
 * Extensible para otros comprobantes (Remito/Factura/NC) reusando esta función
 * y cambiando asunto/plantilla/attachments según corresponda.
 */
export async function sendReceiptEmail(to: string, pdfPath: string, options?: { subject?: string }) {
  const cfg = getConfig();
  if (!to || !/.+@.+\..+/.test(to)) return false;
  if (!cfg.SMTP_USER || !cfg.SMTP_PASS) return false;

  const transporter = nodemailer.createTransport({
    host: cfg.SMTP_HOST || 'smtp.gmail.com',
    port: Number(cfg.SMTP_PORT || 587),
    secure: Number(cfg.SMTP_PORT || 587) === 465,
    auth: { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS }
  });

  // Cargar plantilla HTML básica
  let html = 'Estimado cliente,<br>Adjuntamos el recibo correspondiente a su pago.<br><br>Saludos cordiales,<br>Su Empresa';
  try {
    const base = app.getAppPath();
    const tpl = path.join(base, 'templates', 'email', 'recibo.html');
    if (fs.existsSync(tpl)) {
      html = fs.readFileSync(tpl, 'utf8');
    }
  } catch {}

  const subject = options?.subject || 'Recibo de pago';
  const fromAddr = cfg.SMTP_FROM || cfg.SMTP_USER;

  await transporter.sendMail({
    from: fromAddr,
    to,
    subject,
    html,
    attachments: [{ filename: path.basename(pdfPath), path: pdfPath }]
  });
  return true;
}