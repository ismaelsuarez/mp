import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import nodemailer from 'nodemailer';

function readCsv(filePath: string) {
	const content = fs.readFileSync(filePath, 'utf8');
	const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
	if ((parsed as any).errors && (parsed as any).errors.length) {
		throw new Error(`CSV parse error: ${(parsed as any).errors[0].message}`);
	}
	return (parsed as any).data as any[];
}

function normalizeAccountMoneyRows(rows: any[]) {
	const tryGet = (row: any, candidates: string[]) => {
		for (const key of candidates) {
			if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
		}
		return '';
	};

	return rows.map((r) => {
		const date = tryGet(r, [
			'Fecha',
			'Fecha de la operación',
			'Fecha de creación',
			'date',
			'created_at'
		]);

		const operationId = tryGet(r, [
			'Número de operación',
			'Operacion',
			'Operation Id',
			'operation_id',
			'Referencia',
			'reference_id'
		]);

		const status = tryGet(r, ['Estado', 'estado', 'status']);
		const amount = tryGet(r, ['Monto', 'Importe', 'amount', 'importe']);
		const currency = tryGet(r, ['Moneda', 'currency', 'moneda']);
		const description = tryGet(r, ['Descripción', 'Concepto', 'description', 'detalle']);
		const category = tryGet(r, ['Categoría', 'category']);
		const method = tryGet(r, ['Medio de pago', 'medio_pago', 'method']);

		const counterpartyName = tryGet(r, [
			'Nombre',
			'Nombre del destinatario',
			'A nombre de',
			'counterparty_name'
		]);
		const counterpartyTaxId = tryGet(r, [
			'CUIT/CUIL/CDI',
			'CUIT',
			'cuit',
			'Tax ID',
			'tax_id'
		]);
		const counterpartyCvu = tryGet(r, ['CVU', 'cvu', 'Alias', 'alias', 'counterparty_cvu']);

		const code = tryGet(r, ['Código de identificación', 'code', 'identification_code']);

		return {
			date,
			operation_id: operationId,
			status,
			amount,
			currency,
			description,
			category,
			method,
			counterparty_name: counterpartyName,
			counterparty_tax_id: counterpartyTaxId,
			counterparty_cvu: counterpartyCvu,
			identification_code: code
		};
	});
}

async function sendEmail(subject: string, text: string, attachments: Array<{ filename: string; path: string }> = []) {
	const smtpUser = process.env.SMTP_USER;
	const smtpPass = process.env.SMTP_PASS;
	const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
	const smtpPort = Number(process.env.SMTP_PORT || '587');
	const to = process.env.EMAIL_REPORT || process.env.ADMIN_ERROR_EMAIL;
	if (!smtpUser || !smtpPass || !to) return false;
	const transporter = nodemailer.createTransport({
		host: smtpHost,
		port: smtpPort,
		secure: smtpPort === 465,
		auth: { user: smtpUser, pass: smtpPass }
	});
	await transporter.sendMail({ from: smtpUser, to, subject, text, attachments });
	return true;
}

async function main() {
	const inputPath = process.env.MP_ACCOUNT_CSV_PATH || process.argv[2];
	if (!inputPath || !fs.existsSync(inputPath)) {
		console.error('❌ Proporcione ruta al CSV del reporte del panel (MP_ACCOUNT_CSV_PATH o arg)');
		process.exit(1);
	}

	const rows = readCsv(inputPath);
	const normalized = normalizeAccountMoneyRows(rows);

	const outDir = path.resolve(process.cwd(), 'out');
	fs.mkdirSync(outDir, { recursive: true });
	const tag = dayjs().format('YYYY-MM-DD');

	const base = path.basename(inputPath).replace(/\.csv$/i, '');
	const outJson = path.join(outDir, `${base}-normalized.json`);
	const outCsv = path.join(outDir, `${base}-normalized.csv`);
	const outXlsx = path.join(outDir, `${base}-normalized.xlsx`);

	fs.writeFileSync(outJson, JSON.stringify(normalized, null, 2));
	const csv = Papa.unparse(normalized, { header: true });
	fs.writeFileSync(outCsv, csv, 'utf8');

	const workbook = new ExcelJS.Workbook();
	const sheet = workbook.addWorksheet('AccountMoney');
	const headers = Object.keys(normalized[0] || {
		date: '',
		operation_id: '',
		status: '',
		amount: '',
		currency: '',
		description: '',
		category: '',
		method: '',
		counterparty_name: '',
		counterparty_tax_id: '',
		counterparty_cvu: '',
		identification_code: ''
	});
	sheet.addRow(headers);
	for (const r of normalized) sheet.addRow(headers.map((h) => (r as any)[h]));
	sheet.addTable({
		name: 'AccountMoneyTable',
		ref: 'A1',
		headerRow: true,
		columns: headers.map((h) => ({ name: h })),
		rows: normalized.map((r) => headers.map((h) => (r as any)[h]))
	});
	await workbook.xlsx.writeFile(outXlsx);

	const sent = await sendEmail(
		`MP Account Money (panel) - ${tag}`,
		`Adjunto CSV/XLSX normalizado del reporte del panel. Fuente: ${path.basename(inputPath)}`,
		[
			{ filename: path.basename(outJson), path: outJson },
			{ filename: path.basename(outCsv), path: outCsv },
			{ filename: path.basename(outXlsx), path: outXlsx }
		]
	);
	if (sent) console.log('📧 Email enviado con CSV/XLSX normalizado');

	console.log('OK →', outJson, outCsv, outXlsx);
}

main().catch((e: any) => {
	console.error('Error:', e?.response?.data || e.message || e);
	process.exit(1);
});
