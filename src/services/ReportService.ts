import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { DBFFile } from 'dbffile';
import Papa from 'papaparse';

function ensureDir(dir: string) {
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function getOutDir() {
	const base = path.join(app.getPath('documents'), 'MP-Reportes');
	ensureDir(base);
	return base;
}

function mapDetailedRow(p: any) {
	const feeTotal = Array.isArray(p?.fee_details) ? p.fee_details.reduce((acc: number, f: any) => acc + Number(f?.amount || 0), 0) : 0;
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
}

export async function generateFiles(payments: any[], tag: string, rangeInfo: any) {
	const outDir = getOutDir();
	const jsonPath = path.join(outDir, `balance-${tag}.json`);
	const csvPath = path.join(outDir, `transactions-${tag}.csv`);
	const csvFullPath = path.join(outDir, `transactions-full-${tag}.csv`);
	const xlsxPath = path.join(outDir, `transactions-full-${tag}.xlsx`);
	const dbfPath = path.join(outDir, `transactions-detailed-${tag}.dbf`);

	const detailed = payments.map(mapDetailedRow);

	const totals = detailed.reduce((acc: any, r: any) => {
		const amt = Number(r.net_received_amount ?? r.transaction_amount ?? 0) || 0;
		if (String(r.status).toLowerCase() === 'refunded') acc.refunds += Math.abs(amt);
		else acc.incomes += amt;
		return acc;
	}, { incomes: 0, refunds: 0 });

	fs.writeFileSync(jsonPath, JSON.stringify({ range: rangeInfo, totals_from_payments: totals, transactions: detailed.length }, null, 2));

	const csv = Papa.unparse(detailed, { header: true });
	fs.writeFileSync(csvPath, csv, 'utf8');

	// CSV full (aplanado)
	const flatten = (obj: any, prefix = '', acc: any = {}) => {
		if (obj === null || obj === undefined) return acc;
		if (Array.isArray(obj)) { acc[prefix.replace(/\.$/, '')] = JSON.stringify(obj); return acc; }
		if (typeof obj === 'object') {
			for (const [k, v] of Object.entries(obj)) {
				const next = prefix ? `${prefix}.${k}` : k;
				if (v && typeof v === 'object') (flatten as any)(v, next, acc); else (acc as any)[next] = v as any;
			}
			return acc;
		}
		(acc as any)[prefix.replace(/\.$/, '')] = obj; return acc;
	};
	const flattenedRows = payments.map((p) => flatten(p));
	const allKeys = new Set<string>();
	for (const row of flattenedRows) Object.keys(row).forEach((k) => allKeys.add(k));
	const headers = Array.from(allKeys);
	const normalizedRows = flattenedRows.map((r) => Object.fromEntries(headers.map((h) => [h, (r as any)[h] ?? ''])));
	const csvFull = Papa.unparse({ fields: headers, data: normalizedRows });
	fs.writeFileSync(csvFullPath, csvFull, 'utf8');

	// XLSX
	const workbook = new (ExcelJS as any).Workbook();
	const worksheet = workbook.addWorksheet('Transactions');
	worksheet.addRow(headers);
	for (const row of normalizedRows) worksheet.addRow(headers.map((h) => (row as any)[h]));
	if (headers.length > 0 && normalizedRows.length > 0) {
		worksheet.addTable({ name: 'TransactionsTable', ref: 'A1', headerRow: true, columns: headers.map((h) => ({ name: h })), rows: normalizedRows.map((r) => headers.map((h) => (r as any)[h])) });
	}
	await workbook.xlsx.writeFile(xlsxPath);

	// DBF
	try { if (fs.existsSync(dbfPath)) fs.unlinkSync(dbfPath); } catch {}
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
		{ name: 'HOLDER', type: 'C', size: 80 }
	];
	const toRecord = (r: any) => ({
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
		HOLDER: String(r.cardholder_name ?? '')
	});
	const dbf = await DBFFile.create(dbfPath, fields as any);
	const batchSize = 1000;
	for (let i = 0; i < detailed.length; i += batchSize) {
		await dbf.appendRecords(detailed.slice(i, i + batchSize).map(toRecord));
	}

	return { outDir, files: { jsonPath, csvPath, csvFullPath, xlsxPath, dbfPath }, totals };
}
