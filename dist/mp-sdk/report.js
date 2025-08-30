"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dayjs_1 = __importDefault(require("dayjs"));
const utc_1 = __importDefault(require("dayjs/plugin/utc"));
const timezone_1 = __importDefault(require("dayjs/plugin/timezone"));
const papaparse_1 = __importDefault(require("papaparse"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const exceljs_1 = __importDefault(require("exceljs"));
const dbffile_1 = require("dbffile");
const MercadoPagoService_1 = require("./services/MercadoPagoService");
dayjs_1.default.extend(utc_1.default);
dayjs_1.default.extend(timezone_1.default);
async function maybeSendEmail(subject, text, attachments = []) {
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
    if (!process.env.MP_ACCESS_TOKEN) {
        console.error('❌ Falta MP_ACCESS_TOKEN en .env');
        process.exit(1);
    }
    const dateArg = process.argv[2];
    const modeArg = process.argv[3];
    const tz = process.env.MP_TZ || 'America/Argentina/Buenos_Aires';
    const windowStart = process.env.MP_WINDOW_START || '00:00';
    const windowEnd = process.env.MP_WINDOW_END || '23:59';
    const dateFromEnv = process.env.MP_DATE_FROM;
    const dateToEnv = process.env.MP_DATE_TO;
    const baseDate = dateArg ? dayjs_1.default.tz(dateArg, tz) : (0, dayjs_1.default)().tz(tz);
    if (!baseDate.isValid()) {
        console.error('Fecha inválida. Use YYYY-MM-DD o no pase argumento para hoy.');
        process.exit(1);
    }
    function computeWindowRange(d, mode) {
        const [sh, sm] = windowStart.split(':').map(Number);
        const [eh, em] = windowEnd.split(':').map(Number);
        const startLocal = d.hour(sh).minute(sm || 0).second(0).millisecond(0);
        const endLocal = d.hour(eh).minute(em || 0).second(0).millisecond(0);
        if (mode === 'partial') {
            const nowLocal = (0, dayjs_1.default)().tz(tz);
            const effectiveEnd = nowLocal.isBefore(endLocal) ? nowLocal : endLocal;
            const clippedEnd = effectiveEnd.isAfter(startLocal) ? effectiveEnd : startLocal;
            return {
                begin_date: startLocal.utc().format('YYYY-MM-DD[T]HH:mm:ss[Z]'),
                end_date: clippedEnd.utc().format('YYYY-MM-DD[T]HH:mm:ss[Z]'),
            };
        }
        return {
            begin_date: startLocal.utc().format('YYYY-MM-DD[T]HH:mm:ss[Z]'),
            end_date: endLocal.utc().format('YYYY-MM-DD[T]HH:mm:ss[Z]'),
        };
    }
    let begin_date;
    let end_date;
    const noDateFilter = /^true$/i.test(process.env.MP_NO_DATE_FILTER || 'false');
    if (!noDateFilter) {
        if (dateFromEnv || dateToEnv) {
            const fromLocal = dayjs_1.default.tz(dateFromEnv || baseDate.format('YYYY-MM-DD'), tz).hour(0).minute(0).second(0).millisecond(0);
            const toLocal = dayjs_1.default.tz(dateToEnv || dateFromEnv || baseDate.format('YYYY-MM-DD'), tz).hour(23).minute(59).second(59).millisecond(0);
            begin_date = fromLocal.utc().format('YYYY-MM-DD[T]HH:mm:ss[Z]');
            end_date = toLocal.utc().format('YYYY-MM-DD[T]HH:mm:ss[Z]');
        }
        else if (process.env.MP_BEGIN_ISO && process.env.MP_END_ISO) {
            begin_date = process.env.MP_BEGIN_ISO;
            end_date = process.env.MP_END_ISO;
        }
        else {
            const range = computeWindowRange(baseDate, modeArg === 'partial' ? 'partial' : 'final');
            begin_date = range.begin_date;
            end_date = range.end_date;
        }
    }
    const payments = await (0, MercadoPagoService_1.searchPayments)({
        begin_date,
        end_date,
        range: noDateFilter ? undefined : process.env.MP_RANGE,
        status: process.env.MP_STATUS
    });
    const txns = (0, MercadoPagoService_1.normalizePaymentsToTransactions)(payments);
    const totals = txns.reduce((acc, t) => {
        if (t.type === 'income')
            acc.incomes += t.netAmount;
        if (t.type === 'refund')
            acc.refunds += Math.abs(t.netAmount || t.amount);
        return acc;
    }, { incomes: 0, refunds: 0 });
    const balance = await (0, MercadoPagoService_1.fetchAccountBalance)();
    const outDir = path_1.default.resolve(process.cwd(), 'out');
    fs_1.default.mkdirSync(outDir, { recursive: true });
    const tag = baseDate.format('YYYY-MM-DD');
    const jsonOut = {
        range: { begin_date, end_date },
        balance_api: balance,
        totals_from_payments: {
            incomes: Number(totals.incomes.toFixed(2)),
            refunds: Number(totals.refunds.toFixed(2)),
            note: 'Para conciliación exacta (retiros, contracargos, fees), usar Reportes de Finanzas.'
        },
        transactions: txns
    };
    fs_1.default.writeFileSync(path_1.default.join(outDir, `balance-${tag}.json`), JSON.stringify(jsonOut, null, 2));
    const detailed = payments.map((p) => {
        const feeTotal = Array.isArray(p?.fee_details)
            ? p.fee_details.reduce((acc, f) => acc + Number(f?.amount || 0), 0)
            : 0;
        const td = p?.transaction_details || {};
        const payer = p?.payer || {};
        const idf = payer?.identification || {};
        const card = p?.card || {};
        const poi = p?.point_of_interaction || {};
        const order = p?.order || {};
        return {
            operation_id: p?.id,
            status: p?.status,
            status_detail: p?.status_detail,
            currency_id: p?.currency_id,
            description: p?.description,
            date_created: p?.date_created,
            date_approved: p?.date_approved,
            date_last_updated: p?.date_last_updated,
            money_release_date: p?.money_release_date,
            transaction_amount: p?.transaction_amount,
            total_paid_amount: td?.total_paid_amount,
            net_received_amount: td?.net_received_amount,
            installment_amount: td?.installment_amount,
            taxes_amount: p?.taxes_amount,
            coupon_amount: p?.coupon_amount,
            fees_total: Number(feeTotal.toFixed(2)),
            payment_method_id: p?.payment_method_id,
            payment_type_id: p?.payment_type_id,
            installments: p?.installments,
            card_last_four_digits: card?.last_four_digits,
            cardholder_name: card?.cardholder?.name,
            issuer_id: card?.issuer_id,
            external_reference: p?.external_reference,
            collector_id: p?.collector_id,
            store_id: p?.store_id,
            pos_id: p?.pos_id,
            order_id: order?.id,
            point_of_interaction_type: poi?.type,
            payer_id: payer?.id,
            payer_email: payer?.email,
            payer_first_name: payer?.first_name,
            payer_last_name: payer?.last_name,
            payer_doc_type: idf?.type,
            payer_doc_number: idf?.number,
            refunds_count: Array.isArray(p?.refunds) ? p.refunds.length : 0
        };
    });
    const csv = papaparse_1.default.unparse(detailed, { header: true });
    fs_1.default.writeFileSync(path_1.default.join(outDir, `transactions-${tag}.csv`), csv, 'utf8');
    const flatten = (obj, prefix = '', acc = {}) => {
        if (obj === null || obj === undefined)
            return acc;
        if (Array.isArray(obj)) {
            const isPrimitiveArray = obj.every((v) => v === null || ['string', 'number', 'boolean'].includes(typeof v));
            acc[prefix.replace(/\.$/, '')] = isPrimitiveArray ? obj.join('|') : JSON.stringify(obj);
            return acc;
        }
        if (typeof obj === 'object') {
            for (const [k, v] of Object.entries(obj)) {
                const next = prefix ? `${prefix}.${k}` : k;
                if (v && typeof v === 'object')
                    flatten(v, next, acc);
                else
                    acc[next] = v;
            }
            return acc;
        }
        acc[prefix.replace(/\.$/, '')] = obj;
        return acc;
    };
    const flattenedRows = payments.map((p) => flatten(p));
    const allKeys = new Set();
    for (const row of flattenedRows) {
        Object.keys(row).forEach((k) => allKeys.add(k));
    }
    const headers = Array.from(allKeys);
    const normalizedRows = flattenedRows.map((r) => {
        const out = {};
        for (const h of headers)
            out[h] = r[h] ?? '';
        return out;
    });
    const csvFull = papaparse_1.default.unparse({ fields: headers, data: normalizedRows });
    fs_1.default.writeFileSync(path_1.default.join(outDir, `transactions-full-${tag}.csv`), csvFull, 'utf8');
    const xlsxPath = path_1.default.join(outDir, `transactions-full-${tag}.xlsx`);
    const workbook = new exceljs_1.default.Workbook();
    const worksheet = workbook.addWorksheet('Transactions');
    worksheet.addRow(headers);
    for (const row of normalizedRows) {
        worksheet.addRow(headers.map((h) => row[h]));
    }
    worksheet.addTable({
        name: 'TransactionsTable',
        ref: 'A1',
        headerRow: true,
        columns: headers.map((h) => ({ name: h })),
        rows: normalizedRows.map((r) => headers.map((h) => r[h]))
    });
    await workbook.xlsx.writeFile(xlsxPath);
    const dbfPath = path_1.default.join(outDir, `transactions-detailed-${tag}.dbf`);
    try {
        if (fs_1.default.existsSync(dbfPath))
            fs_1.default.unlinkSync(dbfPath);
    }
    catch { }
    const fields = [
        { name: 'OP_ID', type: 'C', size: 20 },
        { name: 'DT_CRT', type: 'C', size: 25 },
        { name: 'DT_APR', type: 'C', size: 25 },
        { name: 'STATUS', type: 'C', size: 20 },
        { name: 'ST_DET', type: 'C', size: 40 },
        { name: 'CURR', type: 'C', size: 5 },
        { name: 'AMOUNT', type: 'N', size: 15, decs: 2 },
        { name: 'NET', type: 'N', size: 15, decs: 2 },
        { name: 'FEES', type: 'N', size: 15, decs: 2 },
        { name: 'PM_ID', type: 'C', size: 20 },
        { name: 'PT_ID', type: 'C', size: 20 },
        { name: 'INST', type: 'N', size: 5, decs: 0 },
        { name: 'EMAIL', type: 'C', size: 80 },
        { name: 'FNAME', type: 'C', size: 40 },
        { name: 'LNAME', type: 'C', size: 40 },
        { name: 'DOC_T', type: 'C', size: 6 },
        { name: 'DOC_N', type: 'C', size: 20 },
        { name: 'EXTREF', type: 'C', size: 60 },
        { name: 'STORE', type: 'C', size: 20 },
        { name: 'POS', type: 'C', size: 20 },
        { name: 'ORDER', type: 'C', size: 20 },
        { name: 'LAST4', type: 'C', size: 4 },
        { name: 'HOLDER', type: 'C', size: 80 },
    ];
    const dbf = await dbffile_1.DBFFile.create(dbfPath, fields);
    const toRecord = (r) => ({
        OP_ID: String(r.operation_id ?? ''),
        DT_CRT: String(r.date_created ?? ''),
        DT_APR: String(r.date_approved ?? ''),
        STATUS: String(r.status ?? ''),
        ST_DET: String(r.status_detail ?? ''),
        CURR: String(r.currency_id ?? ''),
        AMOUNT: Number(r.transaction_amount ?? 0),
        NET: Number(r.net_received_amount ?? 0),
        FEES: Number(r.fees_total ?? 0),
        PM_ID: String(r.payment_method_id ?? ''),
        PT_ID: String(r.payment_type_id ?? ''),
        INST: Number(r.installments ?? 0),
        EMAIL: String(r.payer_email ?? ''),
        FNAME: String(r.payer_first_name ?? ''),
        LNAME: String(r.payer_last_name ?? ''),
        DOC_T: String(r.payer_doc_type ?? ''),
        DOC_N: String(r.payer_doc_number ?? ''),
        EXTREF: String(r.external_reference ?? ''),
        STORE: String(r.store_id ?? ''),
        POS: String(r.pos_id ?? ''),
        ORDER: String(r.order_id ?? ''),
        LAST4: String(r.card_last_four_digits ?? ''),
        HOLDER: String(r.cardholder_name ?? ''),
    });
    const batchSize = 1000;
    for (let i = 0; i < detailed.length; i += batchSize) {
        const chunk = detailed.slice(i, i + batchSize).map(toRecord);
        await dbf.appendRecords(chunk);
    }
    const lines = [
        `📅 Rango: ${begin_date || 'SIN_FILTRO'} → ${end_date || 'SIN_FILTRO'}`,
        `💰 Ingresos (netos aprox. de payments): ${jsonOut.totals_from_payments.incomes.toFixed(2)}`,
        `↩️ Devoluciones: ${jsonOut.totals_from_payments.refunds.toFixed(2)}`,
        `🧾 Transacciones: ${txns.length}`,
        `📦 Archivos: balance-${tag}.json, transactions-${tag}.csv`
    ];
    const attachments = [
        { filename: `balance-${tag}.json`, path: path_1.default.join(outDir, `balance-${tag}.json`) },
        { filename: `transactions-${tag}.csv`, path: path_1.default.join(outDir, `transactions-${tag}.csv`) },
        { filename: `transactions-full-${tag}.csv`, path: path_1.default.join(outDir, `transactions-full-${tag}.csv`) },
        { filename: `transactions-full-${tag}.xlsx`, path: xlsxPath },
        { filename: `transactions-detailed-${tag}.dbf`, path: dbfPath }
    ];
    const sent = await maybeSendEmail(`MP SDK Payments Report - ${tag}`, lines.join('\n'), attachments);
    if (sent)
        console.log('📧 Email enviado a', process.env.EMAIL_REPORT || process.env.ADMIN_ERROR_EMAIL);
    console.log(`🧾 Transacciones (payments): ${txns.length}`);
    console.log(`OK → out/balance-${tag}.json, out/transactions-${tag}.csv`);
}
main().catch((e) => {
    console.error('Error:', e?.response?.data || e.message || e);
    process.exit(1);
});
