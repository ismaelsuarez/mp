"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const electron_1 = require("electron");
class DbService {
    constructor() {
        this.db = null;
        this.enabled = false;
        const userData = electron_1.app.getPath('userData');
        this.dbPath = path_1.default.join(userData, 'facturas.db');
        this.fallbackPath = path_1.default.join(userData, 'facturas-fallback.json');
        this.ensureDir(path_1.default.dirname(this.dbPath));
        // Carga diferida de better-sqlite3
        let Database = null;
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            Database = require('better-sqlite3');
            this.db = new Database(this.dbPath);
            this.enabled = true;
            this.initSchema();
        }
        catch (e) {
            this.enabled = false;
            // Preparar fallback JSON para no crashear la app
            if (!fs_1.default.existsSync(this.fallbackPath)) {
                try {
                    fs_1.default.writeFileSync(this.fallbackPath, JSON.stringify({ configuracion_afip: null, facturas_afip: [], facturas_estado: [] }, null, 2));
                }
                catch { }
            }
        }
    }
    ensureDir(dir) {
        try {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        catch { }
    }
    initSchema() {
        if (!this.enabled || !this.db)
            return;
        this.db.exec(`CREATE TABLE IF NOT EXISTS configuracion_afip (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			cuit TEXT NOT NULL,
			pto_vta INTEGER NOT NULL,
			cert_path TEXT NOT NULL,
			key_path TEXT NOT NULL,
			entorno TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS facturas_afip (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			numero INTEGER NOT NULL,
			pto_vta INTEGER NOT NULL,
			tipo_cbte INTEGER NOT NULL,
			fecha TEXT NOT NULL,
			cuit_emisor TEXT NOT NULL,
			cuit_receptor TEXT,
			razon_social_receptor TEXT,
			condicion_iva_receptor TEXT,
			neto REAL NOT NULL,
			iva REAL NOT NULL,
			total REAL NOT NULL,
			cae TEXT NOT NULL,
			cae_vencimiento TEXT NOT NULL,
			qr_url TEXT NOT NULL,
			pdf_path TEXT NOT NULL,
			provincia TEXT,
			provincia_estado TEXT,
			provincia_servicio TEXT,
			provincia_numero TEXT,
			provincia_codigo TEXT,
			provincia_respuesta TEXT,
			provincia_error TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS facturas_estado (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			numero INTEGER,
			pto_vta INTEGER,
			tipo_cbte INTEGER,
			estado TEXT NOT NULL,
			error_msg TEXT,
			payload TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS comprobantes_control (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			pto_vta INTEGER NOT NULL,
			tipo_cbte INTEGER NOT NULL,
			nro_comprobante INTEGER NOT NULL,
			estado TEXT NOT NULL CHECK (estado IN ('PENDING', 'APPROVED', 'FAILED')),
			cae TEXT,
			cae_vencimiento TEXT,
			payload TEXT,
			error_msg TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(pto_vta, tipo_cbte, nro_comprobante)
		);

		CREATE TABLE IF NOT EXISTS empresa_config (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			razon_social TEXT NOT NULL,
			cuit TEXT NOT NULL,
			domicilio TEXT,
			condicion_iva TEXT,
			logo_path TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS parametros_facturacion (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			tipo_defecto TEXT,
			pto_vta INTEGER,
			numeracion INTEGER,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);

		CREATE TABLE IF NOT EXISTS perfiles_config (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			nombre TEXT NOT NULL,
			permisos TEXT NOT NULL,
			parametros TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		);


		`);
    }
    readFallback() {
        try {
            const raw = fs_1.default.readFileSync(this.fallbackPath, 'utf8');
            return JSON.parse(raw || '{}');
        }
        catch {
            return { configuracion_afip: null, facturas_afip: [], facturas_estado: [] };
        }
    }
    writeFallback(data) {
        try {
            fs_1.default.writeFileSync(this.fallbackPath, JSON.stringify(data, null, 2));
        }
        catch { }
    }
    getAfipConfig() {
        if (this.enabled && this.db) {
            const row = this.db.prepare('SELECT * FROM configuracion_afip ORDER BY id DESC LIMIT 1').get();
            return row || null;
        }
        const data = this.readFallback();
        return data.configuracion_afip || null;
    }
    saveAfipConfig(cfg) {
        if (this.enabled && this.db) {
            this.db.prepare('DELETE FROM configuracion_afip').run();
            this.db.prepare(`INSERT INTO configuracion_afip (cuit, pto_vta, cert_path, key_path, entorno) VALUES (@cuit, @pto_vta, @cert_path, @key_path, @entorno)`).run(cfg);
            return;
        }
        const data = this.readFallback();
        data.configuracion_afip = cfg;
        this.writeFallback(data);
    }
    insertFacturaEmitida(rec) {
        if (this.enabled && this.db) {
            this.db.prepare(`INSERT INTO facturas_afip (
			numero, pto_vta, tipo_cbte, fecha, cuit_emisor, cuit_receptor, razon_social_receptor, condicion_iva_receptor, neto, iva, total, cae, cae_vencimiento, qr_url, pdf_path, provincia, provincia_estado, provincia_servicio, provincia_numero, provincia_codigo, provincia_respuesta, provincia_error
		) VALUES (
			@numero, @pto_vta, @tipo_cbte, @fecha, @cuit_emisor, @cuit_receptor, @razon_social_receptor, @condicion_iva_receptor, @neto, @iva, @total, @cae, @cae_vencimiento, @qr_url, @pdf_path, @provincia, @provincia_estado, @provincia_servicio, @provincia_numero, @provincia_codigo, @provincia_respuesta, @provincia_error
		)`).run(rec);
            return;
        }
        const data = this.readFallback();
        data.facturas_afip = data.facturas_afip || [];
        data.facturas_afip.unshift({ ...rec, id: (Date.now()) });
        this.writeFallback(data);
    }
    updateFacturaProvincial(id, provincialData) {
        if (this.enabled && this.db) {
            const setParts = Object.keys(provincialData).map(key => `${key} = @${key}`);
            const sql = `UPDATE facturas_afip SET ${setParts.join(', ')} WHERE id = @id`;
            this.db.prepare(sql).run({ ...provincialData, id });
            return;
        }
        const data = this.readFallback();
        data.facturas_afip = data.facturas_afip || [];
        const factura = data.facturas_afip.find((f) => f.id === id);
        if (factura) {
            Object.assign(factura, provincialData);
            this.writeFallback(data);
        }
    }
    insertFacturaEstadoPendiente(p) {
        if (this.enabled && this.db) {
            this.db.prepare(`INSERT INTO facturas_estado (numero, pto_vta, tipo_cbte, estado, error_msg, payload) VALUES (@numero, @pto_vta, @tipo_cbte, 'pendiente', NULL, @payload)`).run({
                numero: p.numero,
                pto_vta: p.pto_vta,
                tipo_cbte: p.tipo_cbte,
                payload: JSON.stringify(p)
            });
            return;
        }
        const data = this.readFallback();
        data.facturas_estado = data.facturas_estado || [];
        data.facturas_estado.push({ numero: p.numero, pto_vta: p.pto_vta, tipo_cbte: p.tipo_cbte, estado: 'pendiente', error_msg: null, payload: JSON.stringify(p), created_at: new Date().toISOString() });
        this.writeFallback(data);
    }
    updateFacturaEstado(numero, pto_vta, tipo_cbte, estado, error_msg) {
        if (this.enabled && this.db) {
            this.db.prepare(`INSERT INTO facturas_estado (numero, pto_vta, tipo_cbte, estado, error_msg, payload) VALUES (@numero, @pto_vta, @tipo_cbte, @estado, @error_msg, NULL)`).run({ numero, pto_vta, tipo_cbte, estado, error_msg: error_msg || null });
            return;
        }
        const data = this.readFallback();
        data.facturas_estado = data.facturas_estado || [];
        data.facturas_estado.push({ numero, pto_vta, tipo_cbte, estado, error_msg: error_msg || null, payload: null, created_at: new Date().toISOString() });
        this.writeFallback(data);
    }
    listFacturas(desde, hasta) {
        if (this.enabled && this.db) {
            if (desde && hasta) {
                return this.db.prepare('SELECT * FROM facturas_afip WHERE date(fecha) BETWEEN date(?) AND date(?) ORDER BY id DESC').all(desde, hasta);
            }
            return this.db.prepare('SELECT * FROM facturas_afip ORDER BY id DESC LIMIT 200').all();
        }
        const data = this.readFallback();
        let rows = Array.isArray(data.facturas_afip) ? data.facturas_afip : [];
        if (desde && hasta) {
            rows = rows.filter((r) => (r.fecha || '').slice(0, 10) >= desde && (r.fecha || '').slice(0, 10) <= hasta);
        }
        return rows.sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 200);
    }
    /**
     * Obtiene una factura específica por número, punto de venta y tipo de comprobante
     */
    getFactura(numero, ptoVta, tipoCbte) {
        if (this.enabled && this.db) {
            const row = this.db.prepare(`
				SELECT * FROM facturas_afip 
				WHERE numero = ? AND pto_vta = ? AND tipo_cbte = ?
			`).get(numero, ptoVta, tipoCbte);
            return row || null;
        }
        // Fallback: buscar en JSON
        const data = this.readFallback();
        const facturas = Array.isArray(data.facturas_afip) ? data.facturas_afip : [];
        const found = facturas.find((f) => f.numero === numero && f.pto_vta === ptoVta && f.tipo_cbte === tipoCbte);
        return found || null;
    }
    /**
     * Obtiene una factura por ID
     */
    getFacturaById(id) {
        if (this.enabled && this.db) {
            const row = this.db.prepare('SELECT * FROM facturas_afip WHERE id = ?').get(id);
            return row || null;
        }
        // Fallback: buscar en JSON
        const data = this.readFallback();
        const facturas = Array.isArray(data.facturas_afip) ? data.facturas_afip : [];
        const found = facturas.find((f) => f.id === id);
        return found || null;
    }
    getEmpresaConfig() {
        if (this.enabled && this.db) {
            const row = this.db.prepare('SELECT * FROM empresa_config ORDER BY id DESC LIMIT 1').get();
            return row || null;
        }
        const data = this.readFallback();
        return data.empresa_config || null;
    }
    saveEmpresaConfig(cfg) {
        if (this.enabled && this.db) {
            this.db.prepare('DELETE FROM empresa_config').run();
            this.db.prepare('INSERT INTO empresa_config (razon_social, cuit, domicilio, condicion_iva, logo_path) VALUES (@razon_social,@cuit,@domicilio,@condicion_iva,@logo_path)').run(cfg);
            return;
        }
        const data = this.readFallback();
        data.empresa_config = cfg;
        this.writeFallback(data);
    }
    getParametrosFacturacion() {
        if (this.enabled && this.db) {
            const row = this.db.prepare('SELECT * FROM parametros_facturacion ORDER BY id DESC LIMIT 1').get();
            return row || null;
        }
        const data = this.readFallback();
        return data.parametros_facturacion || null;
    }
    saveParametrosFacturacion(p) {
        if (this.enabled && this.db) {
            this.db.prepare('DELETE FROM parametros_facturacion').run();
            this.db.prepare('INSERT INTO parametros_facturacion (tipo_defecto, pto_vta, numeracion) VALUES (@tipo_defecto,@pto_vta,@numeracion)').run(p);
            return;
        }
        const data = this.readFallback();
        data.parametros_facturacion = p;
        this.writeFallback(data);
    }
    listPdfsEnDocumentos() {
        const docs = path_1.default.join(electron_1.app.getPath('documents'), 'facturas');
        try {
            fs_1.default.mkdirSync(docs, { recursive: true });
        }
        catch { }
        try {
            const files = fs_1.default.readdirSync(docs).filter(f => f.toLowerCase().endsWith('.pdf'));
            return files.map(f => ({ name: f, path: path_1.default.join(docs, f), mtime: fs_1.default.statSync(path_1.default.join(docs, f)).mtimeMs })).sort((a, b) => b.mtime - a.mtime);
        }
        catch {
            return [];
        }
    }
    // ===== Perfiles =====
    listPerfiles() {
        if (this.enabled && this.db) {
            let rows = this.db.prepare('SELECT * FROM perfiles_config ORDER BY id ASC').all();
            if (!rows || rows.length === 0) {
                // Seed perfiles base
                const seeds = [
                    { nombre: 'Administrador', permisos: { facturacion: true, caja: true, administracion: true, configuracion: true }, parametros: {} },
                    { nombre: 'Cajero', permisos: { facturacion: true, caja: true, administracion: false, configuracion: false }, parametros: {} },
                    { nombre: 'Vendedor', permisos: { facturacion: false, caja: true, administracion: false, configuracion: false, consulta: true }, parametros: {} }
                ];
                const ins = this.db.prepare('INSERT INTO perfiles_config (nombre, permisos, parametros) VALUES (@nombre, @permisos, @parametros)');
                for (const s of seeds)
                    ins.run({ nombre: s.nombre, permisos: JSON.stringify(s.permisos), parametros: JSON.stringify(s.parametros) });
                rows = this.db.prepare('SELECT * FROM perfiles_config ORDER BY id ASC').all();
            }
            return rows.map((r) => ({ id: r.id, nombre: r.nombre, permisos: JSON.parse(r.permisos || '{}'), parametros: JSON.parse(r.parametros || '{}'), created_at: r.created_at }));
        }
        const data = this.readFallback();
        if (!Array.isArray(data.perfiles) || data.perfiles.length === 0) {
            data.perfiles = [
                { id: Date.now() - 2, nombre: 'Administrador', permisos: { facturacion: true, caja: true, administracion: true, configuracion: true }, parametros: {} },
                { id: Date.now() - 1, nombre: 'Cajero', permisos: { facturacion: true, caja: true, administracion: false, configuracion: false }, parametros: {} },
                { id: Date.now(), nombre: 'Vendedor', permisos: { facturacion: false, caja: true, administracion: false, configuracion: false, consulta: true }, parametros: {} }
            ];
            this.writeFallback(data);
        }
        return data.perfiles;
    }
    getPerfil(id) {
        if (this.enabled && this.db) {
            const r = this.db.prepare('SELECT * FROM perfiles_config WHERE id=?').get(id);
            return r ? { id: r.id, nombre: r.nombre, permisos: JSON.parse(r.permisos || '{}'), parametros: JSON.parse(r.parametros || '{}'), created_at: r.created_at } : null;
        }
        const data = this.readFallback();
        const found = (Array.isArray(data.perfiles) ? data.perfiles : []).find((p) => Number(p.id) === Number(id));
        return found || null;
    }
    savePerfil(perfil) {
        if (this.enabled && this.db) {
            if (perfil.id) {
                this.db.prepare('UPDATE perfiles_config SET nombre=@nombre, permisos=@permisos, parametros=@parametros WHERE id=@id')
                    .run({ id: perfil.id, nombre: perfil.nombre, permisos: JSON.stringify(perfil.permisos || {}), parametros: JSON.stringify(perfil.parametros || {}) });
                return Number(perfil.id);
            }
            const info = this.db.prepare('INSERT INTO perfiles_config (nombre, permisos, parametros) VALUES (@nombre, @permisos, @parametros)')
                .run({ nombre: perfil.nombre, permisos: JSON.stringify(perfil.permisos || {}), parametros: JSON.stringify(perfil.parametros || {}) });
            return Number(info.lastInsertRowid || 0);
        }
        const data = this.readFallback();
        data.perfiles = Array.isArray(data.perfiles) ? data.perfiles : [];
        if (perfil.id) {
            const idx = data.perfiles.findIndex((p) => Number(p.id) === Number(perfil.id));
            if (idx >= 0)
                data.perfiles[idx] = perfil;
            else
                data.perfiles.push(perfil);
            this.writeFallback(data);
            return Number(perfil.id);
        }
        const id = Date.now();
        data.perfiles.push({ ...perfil, id });
        this.writeFallback(data);
        return id;
    }
    deletePerfil(id) {
        if (this.enabled && this.db) {
            this.db.prepare('DELETE FROM perfiles_config WHERE id=?').run(id);
            return true;
        }
        const data = this.readFallback();
        const before = (Array.isArray(data.perfiles) ? data.perfiles : []).length;
        data.perfiles = (Array.isArray(data.perfiles) ? data.perfiles : []).filter((p) => Number(p.id) !== Number(id));
        this.writeFallback(data);
        return (Array.isArray(data.perfiles) ? data.perfiles : []).length < before;
    }
    // ===== Control de Idempotencia =====
    /**
     * Busca un comprobante existente por clave única
     */
    getComprobanteControl(ptoVta, tipoCbte, nroComprobante) {
        if (this.enabled && this.db) {
            const row = this.db.prepare(`
				SELECT * FROM comprobantes_control 
				WHERE pto_vta = ? AND tipo_cbte = ? AND nro_comprobante = ?
			`).get(ptoVta, tipoCbte, nroComprobante);
            return row || null;
        }
        // Fallback: buscar en JSON
        const data = this.readFallback();
        const comprobantes = Array.isArray(data.comprobantes_control) ? data.comprobantes_control : [];
        const found = comprobantes.find((c) => c.pto_vta === ptoVta && c.tipo_cbte === tipoCbte && c.nro_comprobante === nroComprobante);
        return found || null;
    }
    /**
     * Inserta un nuevo comprobante en estado PENDING
     */
    insertComprobanteControl(comprobante) {
        if (this.enabled && this.db) {
            const info = this.db.prepare(`
				INSERT INTO comprobantes_control 
				(pto_vta, tipo_cbte, nro_comprobante, estado, payload) 
				VALUES (?, ?, ?, ?, ?)
			`).run(comprobante.pto_vta, comprobante.tipo_cbte, comprobante.nro_comprobante, comprobante.estado, comprobante.payload || null);
            return Number(info.lastInsertRowid || 0);
        }
        // Fallback: guardar en JSON
        const data = this.readFallback();
        data.comprobantes_control = Array.isArray(data.comprobantes_control) ? data.comprobantes_control : [];
        const id = Date.now();
        data.comprobantes_control.push({
            id,
            ...comprobante,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        this.writeFallback(data);
        return id;
    }
    /**
     * Actualiza el estado de un comprobante
     */
    updateComprobanteControl(ptoVta, tipoCbte, nroComprobante, updates) {
        if (this.enabled && this.db) {
            const setClause = Object.keys(updates)
                .filter(key => key !== 'id' && key !== 'created_at')
                .map(key => `${key} = ?`)
                .join(', ');
            if (setClause.length === 0)
                return false;
            const values = Object.keys(updates)
                .filter(key => key !== 'id' && key !== 'created_at')
                .map(key => updates[key]);
            values.push(new Date().toISOString()); // updated_at
            values.push(ptoVta, tipoCbte, nroComprobante);
            const result = this.db.prepare(`
				UPDATE comprobantes_control 
				SET ${setClause}, updated_at = ? 
				WHERE pto_vta = ? AND tipo_cbte = ? AND nro_comprobante = ?
			`).run(...values);
            return result.changes > 0;
        }
        // Fallback: actualizar en JSON
        const data = this.readFallback();
        data.comprobantes_control = Array.isArray(data.comprobantes_control) ? data.comprobantes_control : [];
        const idx = data.comprobantes_control.findIndex((c) => c.pto_vta === ptoVta && c.tipo_cbte === tipoCbte && c.nro_comprobante === nroComprobante);
        if (idx >= 0) {
            data.comprobantes_control[idx] = {
                ...data.comprobantes_control[idx],
                ...updates,
                updated_at: new Date().toISOString()
            };
            this.writeFallback(data);
            return true;
        }
        return false;
    }
    /**
     * Obtiene comprobantes por estado
     */
    getComprobantesByEstado(estado) {
        if (this.enabled && this.db) {
            const rows = this.db.prepare(`
				SELECT * FROM comprobantes_control 
				WHERE estado = ? 
				ORDER BY created_at DESC
			`).all(estado);
            return rows || [];
        }
        // Fallback: filtrar en JSON
        const data = this.readFallback();
        const comprobantes = Array.isArray(data.comprobantes_control) ? data.comprobantes_control : [];
        return comprobantes.filter((c) => c.estado === estado);
    }
    /**
     * Limpia comprobantes antiguos (más de 30 días)
     */
    cleanupComprobantesAntiguos() {
        if (this.enabled && this.db) {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const result = this.db.prepare(`
				DELETE FROM comprobantes_control 
				WHERE created_at < ? AND estado IN ('APPROVED', 'FAILED')
			`).run(thirtyDaysAgo.toISOString());
            return result.changes || 0;
        }
        // Fallback: limpiar en JSON
        const data = this.readFallback();
        const comprobantes = Array.isArray(data.comprobantes_control) ? data.comprobantes_control : [];
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const before = comprobantes.length;
        data.comprobantes_control = comprobantes.filter((c) => {
            if (c.estado === 'PENDING')
                return true; // Mantener pendientes
            const created = new Date(c.created_at);
            return created >= thirtyDaysAgo;
        });
        this.writeFallback(data);
        return before - data.comprobantes_control.length;
    }
}
let instance = null;
function getDb() {
    if (!instance)
        instance = new DbService();
    return instance;
}
