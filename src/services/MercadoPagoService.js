const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);
const Store = require('electron-store');

function getEncryptionKey() {
	try {
		const keyPath = path.join(app.getPath('userData'), 'config.key');
		if (fs.existsSync(keyPath)) return fs.readFileSync(keyPath, 'utf8');
		return undefined;
	} catch {
		return undefined;
	}
}

function getConfigStore() {
	return new Store({ name: 'settings', encryptionKey: getEncryptionKey() });
}

function buildClient(accessToken) {
	return new MercadoPagoConfig({ accessToken, options: { timeout: 30000 } });
}

function toIsoUtcRangeFromLocal(dateFrom, dateTo, tz) {
	// dateFrom/dateTo are YYYY-MM-DD in local TZ
	const start = dayjs.tz ? dayjs.tz(dateFrom, tz).startOf('day') : dayjs(dateFrom).utc().startOf('day');
	const end = dayjs.tz ? dayjs.tz(dateTo || dateFrom, tz).endOf('day') : dayjs(dateTo || dateFrom).utc().endOf('day');
	return {
		begin_date: start.utc().format('YYYY-MM-DD[T]HH:mm:ss[Z]'),
		end_date: end.utc().format('YYYY-MM-DD[T]HH:mm:ss[Z]')
	};
}

async function searchPaymentsWithConfig() {
	const store = getConfigStore();
	const cfg = store.get('config') || {};
	if (!cfg.MP_ACCESS_TOKEN) throw new Error('Falta MP_ACCESS_TOKEN en configuración');

	const client = buildClient(cfg.MP_ACCESS_TOKEN);
	const payment = new Payment(client);

	const noDate = !!cfg.MP_NO_DATE_FILTER;
	let begin_date;
	let end_date;
	if (!noDate) {
		if (cfg.MP_DATE_FROM || cfg.MP_DATE_TO) {
			const tz = cfg.MP_TZ || 'America/Argentina/Buenos_Aires';
			const range = toIsoUtcRangeFromLocal(cfg.MP_DATE_FROM || dayjs().format('YYYY-MM-DD'), cfg.MP_DATE_TO, tz);
			begin_date = range.begin_date;
			end_date = range.end_date;
		} else {
			// Día actual completo por defecto (00:00–23:59 local)
			const tz = cfg.MP_TZ || 'America/Argentina/Buenos_Aires';
			const range = toIsoUtcRangeFromLocal(dayjs().format('YYYY-MM-DD'), undefined, tz);
			begin_date = range.begin_date;
			end_date = range.end_date;
		}
	}

	const selectedRange = cfg.MP_RANGE || 'date_last_updated';
	const selectedSort = cfg.MP_SORT || 'date_created';
	const selectedCriteria = cfg.MP_CRITERIA || 'desc';
	const statusFilter = cfg.MP_STATUS;
	const pageLimit = Number(cfg.MP_LIMIT || 50);
	const pageMax = Number(cfg.MP_MAX_PAGES || 100);

	const all = [];
	let offset = 0;
	for (let page = 0; page < pageMax; page += 1) {
		const options = {
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

		const resp = await payment.search({ options });
		const results = Array.isArray(resp?.results) ? resp.results : [];
		all.push(...results);
		if (results.length < pageLimit) break;
		offset += pageLimit;
	}

	return {
		payments: all,
		range: { begin_date, end_date, range: selectedRange, noDate },
		configUsed: { limit: pageLimit, maxPages: pageMax, status: statusFilter }
	};
}

module.exports = {
	searchPaymentsWithConfig
};


