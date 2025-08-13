import 'dotenv/config';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import axios from 'axios';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const mpClient = new MercadoPagoConfig({
	accessToken: process.env.MP_ACCESS_TOKEN as string,
	options: { timeout: 30000 }
});

export function getDayRangeISO(date: Date | string = new Date()) {
	const d = dayjs(date).utc();
	const start = d.startOf('day').format('YYYY-MM-DD[T]HH:mm:ss[Z]');
	const end = d.endOf('day').format('YYYY-MM-DD[T]HH:mm:ss[Z]');
	return { begin_date: start, end_date: end };
}

export async function searchPayments({ begin_date, end_date, limit, maxPages, range, status }: any) {
	const payment = new Payment(mpClient);
	const all: any[] = [];
	let offset = 0;
	const selectedRange = range || process.env.MP_RANGE || 'date_created';
	const selectedSort = process.env.MP_SORT || 'date_created';
	const selectedCriteria = process.env.MP_CRITERIA || 'desc';
	const statusFilter = status || process.env.MP_STATUS; // e.g. "approved" or "approved,refunded"
	const pageLimit = Number(limit || process.env.MP_LIMIT || 50);
	const pageMax = Number(maxPages || process.env.MP_MAX_PAGES || 50);
	for (let page = 0; page < pageMax; page += 1) {
		const options: any = {
			sort: selectedSort,
			criteria: selectedCriteria,
			limit: pageLimit,
			offset
		};
		if (begin_date && end_date) {
			options.range = selectedRange;
			options.begin_date = begin_date;
			options.end_date = end_date;
		}
		if (statusFilter) options.status = statusFilter;
		const resp = await payment.search({ options });
		const results = Array.isArray((resp as any)?.results) ? (resp as any).results : [];
		all.push(...results);
		if (results.length < pageLimit) break;
		offset += pageLimit;
	}
	return all;
}

export async function fetchAccountBalance() {
	const token = process.env.MP_ACCESS_TOKEN as string;
	const headers = { Authorization: `Bearer ${token}` };
	const userId = process.env.MP_USER_ID || 'me';

	const tryGet = async (url: string) => {
		try {
			const r = await axios.get(url, { headers, timeout: 30000 });
			return { ok: true, data: r.data };
		} catch (e: any) {
			return { ok: false, status: e?.response?.status, data: e?.response?.data || e.message };
		}
	};

	const candidates = [
		`https://api.mercadopago.com/users/${encodeURIComponent(userId)}/mercadopago_account/balance`,
		'https://api.mercadopago.com/users/me/mercadopago_account/balance',
		'https://api.mercadopago.com/v1/account/balance'
	];
	for (const url of candidates) {
		const r = await tryGet(url);
		if (r.ok) return r.data;
	}
	return null;
}

export function normalizePaymentsToTransactions(payments: any[]) {
	return payments.map((p: any) => {
		const amount = Number(p.transaction_amount || 0);
		const net = Number(p?.transaction_details?.net_received_amount ?? amount);
		const status = String(p.status || '').toLowerCase();
		let type: 'income' | 'refund' = 'income';
		if (status === 'refunded' || status === 'cancelled' || status === 'charged_back') type = 'refund';
		return {
			id: String(p.id),
			amount,
			netAmount: net,
			status,
			type,
			date: p.date_created,
			payment_method_id: p.payment_method_id,
			payment_type_id: p.payment_type_id,
			external_reference: p.external_reference || null
		};
	});
}
