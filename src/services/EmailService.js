const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const Store = require('electron-store');

function getEncryptionKey() {
	try {
		const keyPath = path.join(app.getPath('userData'), 'config.key');
		if (fs.existsSync(keyPath)) return fs.readFileSync(keyPath, 'utf8');
		return undefined;
	} catch { return undefined; }
}

function getConfig() {
	const store = new Store({ name: 'settings', encryptionKey: getEncryptionKey() });
	return store.get('config') || {};
}

async function sendReportEmail(subject, text, attachments) {
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

module.exports = { sendReportEmail };


