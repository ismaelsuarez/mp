"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchPaymentsWithConfig = searchPaymentsWithConfig;
exports.testConnection = testConnection;
const electron_1 = require("electron");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const mercadopago_1 = require("mercadopago");
const ErrorNotificationService_1 = require("./ErrorNotificationService");
const dayjs_1 = __importDefault(require("dayjs"));
const utc_1 = __importDefault(require("dayjs/plugin/utc"));
const timezone_1 = __importDefault(require("dayjs/plugin/timezone"));
const electron_store_1 = __importDefault(require("electron-store"));
dayjs_1.default.extend(utc_1.default);
dayjs_1.default.extend(timezone_1.default);
function getEncryptionKey() {
    try {
        const keyPath = path_1.default.join(electron_1.app.getPath('userData'), 'config.key');
        if (fs_1.default.existsSync(keyPath))
            return fs_1.default.readFileSync(keyPath, 'utf8');
        return undefined;
    }
    catch {
        return undefined;
    }
}
function getConfigStore() {
    return new electron_store_1.default({ name: 'settings', encryptionKey: getEncryptionKey() });
}
function buildClient(accessToken) {
    return new mercadopago_1.MercadoPagoConfig({ accessToken, options: { timeout: 30000 } });
}
function toIsoUtcRangeFromLocal(dateFrom, dateTo, tz) {
    const start = dayjs_1.default.tz(dateFrom, tz).startOf('day');
    const end = dayjs_1.default.tz(dateTo || dateFrom, tz).endOf('day');
    return {
        begin_date: start.utc().format('YYYY-MM-DD[T]HH:mm:ss[Z]'),
        end_date: end.utc().format('YYYY-MM-DD[T]HH:mm:ss[Z]')
    };
}
async function searchPaymentsWithConfig() {
    const store = getConfigStore();
    const cfg = store.get('config') || {};
    if (!cfg.MP_ACCESS_TOKEN)
        throw new Error('Falta MP_ACCESS_TOKEN en configuración');
    const client = buildClient(String(cfg.MP_ACCESS_TOKEN));
    const payment = new mercadopago_1.Payment(client);
    const noDate = !!cfg.MP_NO_DATE_FILTER;
    let begin_date;
    let end_date;
    if (!noDate) {
        if (cfg.MP_DATE_FROM || cfg.MP_DATE_TO) {
            // Si el usuario define fechas manuales, se respetan
            const tz = cfg.MP_TZ || 'America/Argentina/Buenos_Aires';
            const range = toIsoUtcRangeFromLocal(cfg.MP_DATE_FROM || (0, dayjs_1.default)().format('YYYY-MM-DD'), cfg.MP_DATE_TO, tz);
            begin_date = range.begin_date;
            end_date = range.end_date;
        }
        else {
            // Por defecto: últimos N días incluyendo hoy (en TZ local)
            const tz = cfg.MP_TZ || 'America/Argentina/Buenos_Aires';
            const daysBack = Number(cfg.MP_DAYS_BACK || 7);
            const span = Number.isFinite(daysBack) && daysBack > 0 ? daysBack : 7;
            const todayLocal = (0, dayjs_1.default)().tz ? (0, dayjs_1.default)().tz(tz) : (0, dayjs_1.default)();
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
        if (statusFilter)
            options.status = statusFilter;
        try {
            const resp = await payment.search({ options });
            const results = Array.isArray(resp?.results) ? resp.results : [];
            all.push(...results);
            if (results.length < pageLimit)
                break;
            offset += pageLimit;
        }
        catch (e) {
            (0, ErrorNotificationService_1.recordError)('MP_COMM', 'Fallo al consultar pagos en Mercado Pago', { step: 'payment.search', page, offset, error: String(e?.message || e) });
            throw e;
        }
    }
    return {
        payments: all,
        range: { begin_date, end_date, range: selectedRange, noDate },
        configUsed: { limit: pageLimit, maxPages: pageMax, status: statusFilter }
    };
}
async function testConnection() {
    const store = getConfigStore();
    const cfg = store.get('config') || {};
    if (!cfg.MP_ACCESS_TOKEN)
        return { ok: false, error: 'Falta MP_ACCESS_TOKEN' };
    try {
        const client = buildClient(String(cfg.MP_ACCESS_TOKEN));
        const payment = new mercadopago_1.Payment(client);
        const resp = await payment.search({ options: { limit: 1 } });
        const ok = Array.isArray(resp?.results);
        return { ok };
    }
    catch (e) {
        return { ok: false, error: e?.response?.data || e?.message || String(e) };
    }
}
