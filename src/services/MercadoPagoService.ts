import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { recordError } from './ErrorNotificationService';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import Store from 'electron-store';

dayjs.extend(utc);
dayjs.extend(timezone);

function getEncryptionKey(): string | undefined {
	try {
		const keyPath = path.join(app.getPath('userData'), 'config.key');
		if (fs.existsSync(keyPath)) return fs.readFileSync(keyPath, 'utf8');
		return undefined;
	} catch {
		return undefined;
	}
}

function getConfigStore() {
	return new Store<{ config?: Record<string, unknown> }>({ name: 'settings', encryptionKey: getEncryptionKey() });
}

function buildClient(accessToken: string) {
	return new MercadoPagoConfig({ accessToken, options: { timeout: 30000 } });
}

function toIsoUtcRangeFromLocal(dateFrom: string, dateTo: string | undefined, tz: string) {
	const start = dayjs.tz(dateFrom, tz).startOf('day');
	const end = dayjs.tz(dateTo || dateFrom, tz).endOf('day');
	return {
		begin_date: start.utc().format('YYYY-MM-DD[T]HH:mm:ss[Z]'),
		end_date: end.utc().format('YYYY-MM-DD[T]HH:mm:ss[Z]')
	};
}

export async function searchPaymentsWithConfig() {
	const store = getConfigStore();
	const cfg: any = store.get('config') || {};
	if (!cfg.MP_ACCESS_TOKEN) throw new Error('Falta MP_ACCESS_TOKEN en configuración');

	const client = buildClient(String(cfg.MP_ACCESS_TOKEN));
	const payment = new Payment(client);

	const noDate = !!cfg.MP_NO_DATE_FILTER;
	let begin_date: string | undefined;
	let end_date: string | undefined;
    if (!noDate) {
        if (cfg.MP_DATE_FROM || cfg.MP_DATE_TO) {
            // Si el usuario define fechas manuales, se respetan
            const tz = cfg.MP_TZ || 'America/Argentina/Buenos_Aires';
            const range = toIsoUtcRangeFromLocal(cfg.MP_DATE_FROM || dayjs().format('YYYY-MM-DD'), cfg.MP_DATE_TO, tz);
            begin_date = range.begin_date;
            end_date = range.end_date;
        } else {
            // Por defecto: últimos N días incluyendo hoy (en TZ local)
            const tz = cfg.MP_TZ || 'America/Argentina/Buenos_Aires';
            const daysBack = Number(cfg.MP_DAYS_BACK || 7);
            const span = Number.isFinite(daysBack) && daysBack > 0 ? daysBack : 7;
            const todayLocal = dayjs().tz ? dayjs().tz(tz) : dayjs();
            const fromLocal = todayLocal.subtract(span - 1, 'day').startOf('day');
            const toLocal = todayLocal.endOf('day');
            begin_date = fromLocal.utc().format('YYYY-MM-DD[T]HH:mm:ss[Z]');
            end_date = toLocal.utc().format('YYYY-MM-DD[T]HH:mm:ss[Z]');
        }
    }

	const selectedRange = cfg.MP_RANGE || 'date_last_updated';
	const selectedSort = cfg.MP_SORT || 'date_created';
	const selectedCriteria = cfg.MP_CRITERIA || 'desc';
	const statusFilter = cfg.MP_STATUS;
	const pageLimit = Number(cfg.MP_LIMIT || 50);
	const pageMax = Number(cfg.MP_MAX_PAGES || 100);

	const all: any[] = [];
	let offset = 0;
	for (let page = 0; page < pageMax; page += 1) {
		const options: Record<string, any> = {
			sort: selectedSort,
			criteria: selectedCriteria,
			limit: pageLimit,
			offset
		};
		if (!noDate) {
			options.range = selectedRange;
			options.begin_date = begin_date;
			options.end_date = end_date;
		}
		if (statusFilter) options.status = statusFilter;

		try {
			const resp = await payment.search({ options });
			const results = Array.isArray((resp as any)?.results) ? (resp as any).results : [];
			all.push(...results);
			if (results.length < pageLimit) break;
			offset += pageLimit;
		} catch (e: any) {
			recordError('MP_COMM', 'Fallo al consultar pagos en Mercado Pago', { step: 'payment.search', page, offset, error: String(e?.message || e) });
			throw e;
		}
	}

	return {
		payments: all,
		range: { begin_date, end_date, range: selectedRange, noDate },
		configUsed: { limit: pageLimit, maxPages: pageMax, status: statusFilter }
	};
}

export async function testConnection() {
	const store = getConfigStore();
	const cfg: any = store.get('config') || {};
	if (!cfg.MP_ACCESS_TOKEN) return { ok: false, error: 'Falta MP_ACCESS_TOKEN' };
	try {
		const client = buildClient(String(cfg.MP_ACCESS_TOKEN));
		const payment = new Payment(client);
		const resp = await payment.search({ options: { limit: 1 } });
		const ok = Array.isArray((resp as any)?.results);
		return { ok };
	} catch (e: any) {
		return { ok: false, error: (e?.response?.data as any) || e?.message || String(e) };
	}
}
