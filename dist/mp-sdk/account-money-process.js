"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dayjs_1 = __importDefault(require("dayjs"));
const papaparse_1 = __importDefault(require("papaparse"));
const exceljs_1 = __importDefault(require("exceljs"));
const nodemailer_1 = __importDefault(require("nodemailer"));
function readCsv(filePath) {
    const content = fs_1.default.readFileSync(filePath, 'utf8');
    const parsed = papaparse_1.default.parse(content, { header: true, skipEmptyLines: true });
    if (parsed.errors && parsed.errors.length) {
        throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
    }
    return parsed.data;
}
function normalizeAccountMoneyRows(rows) {
    const tryGet = (row, candidates) => {
        for (const key of candidates) {
            if (row[key] !== undefined && row[key] !== null && row[key] !== '')
                return row[key];
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
async function sendEmail(subject, text, attachments = []) {
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = Number(process.env.SMTP_PORT || '587');
    const to = process.env.EMAIL_REPORT || process.env.ADMIN_ERROR_EMAIL;
    if (!smtpUser || !smtpPass || !to)
        return false;
    const transporter = nodemailer_1.default.createTransport({
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
    if (!inputPath || !fs_1.default.existsSync(inputPath)) {
        console.error('❌ Proporcione ruta al CSV del reporte del panel (MP_ACCOUNT_CSV_PATH o arg)');
        process.exit(1);
    }
    const rows = readCsv(inputPath);
    const normalized = normalizeAccountMoneyRows(rows);
    const outDir = path_1.default.resolve(process.cwd(), 'out');
    fs_1.default.mkdirSync(outDir, { recursive: true });
    const tag = (0, dayjs_1.default)().format('YYYY-MM-DD');
    const base = path_1.default.basename(inputPath).replace(/\.csv$/i, '');
    const outJson = path_1.default.join(outDir, `${base}-normalized.json`);
    const outCsv = path_1.default.join(outDir, `${base}-normalized.csv`);
    const outXlsx = path_1.default.join(outDir, `${base}-normalized.xlsx`);
    fs_1.default.writeFileSync(outJson, JSON.stringify(normalized, null, 2));
    const csv = papaparse_1.default.unparse(normalized, { header: true });
    fs_1.default.writeFileSync(outCsv, csv, 'utf8');
    const workbook = new exceljs_1.default.Workbook();
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
    for (const r of normalized)
        sheet.addRow(headers.map((h) => r[h]));
    sheet.addTable({
        name: 'AccountMoneyTable',
        ref: 'A1',
        headerRow: true,
        columns: headers.map((h) => ({ name: h })),
        rows: normalized.map((r) => headers.map((h) => r[h]))
    });
    await workbook.xlsx.writeFile(outXlsx);
    const sent = await sendEmail(`MP Account Money (panel) - ${tag}`, `Adjunto CSV/XLSX normalizado del reporte del panel. Fuente: ${path_1.default.basename(inputPath)}`, [
        { filename: path_1.default.basename(outJson), path: outJson },
        { filename: path_1.default.basename(outCsv), path: outCsv },
        { filename: path_1.default.basename(outXlsx), path: outXlsx }
    ]);
    if (sent)
        console.log('📧 Email enviado con CSV/XLSX normalizado');
    console.log('OK →', outJson, outCsv, outXlsx);
}
main().catch((e) => {
    console.error('Error:', e?.response?.data || e.message || e);
    process.exit(1);
});
