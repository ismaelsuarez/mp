import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import Store from 'electron-store';
import { cajaLog } from '../../apps/electron/src/services/CajaLogService';

function getEncryptionKey(): string | undefined {
	try {
		const keyPath = path.join(app.getPath('userData'), 'config.key');
		if (fs.existsSync(keyPath)) return fs.readFileSync(keyPath, 'utf8');
		return undefined;
	} catch { return undefined; }
}

function getConfig() {
    const store = new Store<{ config?: any }>({ name: 'settings', cwd: (()=>{ try { return app.getPath('userData'); } catch { return undefined; } })(), encryptionKey: getEncryptionKey() });
	return (store.get('config') as any) || {};
}

export async function sendReportEmail(subject: string, text: string, attachments: Array<{ filename: string; path: string }>) {
	const cfg = getConfig();
	const to = cfg.EMAIL_REPORT || cfg.ADMIN_ERROR_EMAIL;
	if (!to || !cfg.SMTP_USER || !cfg.SMTP_PASS) {
		cajaLog.logEmailError('Configuración SMTP incompleta');
		return false;
	}

	try {
		const transporter = nodemailer.createTransport({
			host: cfg.SMTP_HOST || 'smtp.gmail.com',
			port: Number(cfg.SMTP_PORT || 587),
			secure: Number(cfg.SMTP_PORT || 587) === 465,
			auth: { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS }
		});
		await transporter.sendMail({ from: cfg.SMTP_USER, to, subject, text, attachments });
		
		cajaLog.logEmailEnviado(to, subject);
		return true;
	} catch (err: any) {
		cajaLog.logEmailError(String(err?.message || err));
		throw err;
	}
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
export async function sendReceiptEmail(
  to: string,
  pdfPath: string,
  options?: {
    subject?: string;
    title?: string;
    intro?: string;
    bodyHtml?: string;
    signatureCompany?: string;
    signatureContact?: string;
    logoUrl?: string;
  }
) {
  const cfg = getConfig();
  if (!to || !/.+@.+\..+/.test(to)) {
    cajaLog.logEmailError('Email destinatario inválido');
    throw new Error('Email destinatario inválido');
  }
  if (!cfg.SMTP_USER || !cfg.SMTP_PASS) {
    cajaLog.logEmailError('Configuración SMTP incompleta');
    throw new Error('Configuración SMTP incompleta');
  }

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.SMTP_HOST || 'smtp.gmail.com',
      port: Number(cfg.SMTP_PORT || 587),
      secure: Number(cfg.SMTP_PORT || 587) === 465,
      auth: { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS }
    });

    // Plantilla genérica con placeholders; fallback a recibo.html
    function loadTemplate(): string {
      try {
        const base = app.getAppPath();
        const docTpl = path.join(base, 'templates', 'email', 'document.html');
        if (fs.existsSync(docTpl)) return fs.readFileSync(docTpl, 'utf8');
        const recTpl = path.join(base, 'templates', 'email', 'recibo.html');
        if (fs.existsSync(recTpl)) return fs.readFileSync(recTpl, 'utf8');
      } catch {}
      return '<h1>{{title}}</h1><p>{{intro}}</p>{{body}}<div id="signature">Saludos cordiales,<br>{{signatureCompany}}</div>';
    }

    const subject = options?.subject || 'Recibo de pago';
    const fromAddr = cfg.SMTP_FROM || cfg.SMTP_USER;
    const company = options?.signatureCompany || cfg.EMP_RAZON || 'Su Empresa';
    const contact = options?.signatureContact || '';
    const title = options?.title || subject;
    const intro = options?.intro || 'Adjuntamos el comprobante correspondiente.';
    const bodyHtml = options?.bodyHtml || '<p>Gracias por su preferencia.</p>';
    const logoUrl = options?.logoUrl || '';

    const tplHtml = loadTemplate();
    const html = tplHtml
      .replace(/{{\s*title\s*}}/g, title)
      .replace(/{{\s*intro\s*}}/g, intro)
      .replace(/{{\s*body\s*}}/g, bodyHtml)
      .replace(/{{\s*signatureCompany\s*}}/g, company)
      .replace(/{{\s*signatureContact\s*}}/g, contact)
      .replace(/{{\s*logoBlock\s*}}/g, logoUrl ? `<img alt="logo" src="${logoUrl}" style="max-height:48px;">` : '');

    await transporter.sendMail({
      from: fromAddr,
      to,
      subject,
      html,
      attachments: [{ filename: path.basename(pdfPath), path: pdfPath }]
    });
    
    cajaLog.logEmailEnviado(to, subject);
    return true;
  } catch (err: any) {
    cajaLog.logEmailError(String(err?.message || err));
    throw err;
  }
}