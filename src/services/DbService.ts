import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export type AfipConfig = {
	id?: number;
	cuit: string;
	pto_vta: number;
	cert_path: string;
	key_path: string;
	entorno: 'homologacion' | 'produccion';
	created_at?: string;
};

export type FacturaRecord = {
	id?: number;
	numero: number;
	pto_vta: number;
	tipo_cbte: number;
	fecha: string;
	cuit_emisor: string;
	cuit_receptor?: string | null;
	razon_social_receptor?: string | null;
	condicion_iva_receptor?: string | null;
	neto: number;
	iva: number;
	total: number;
	cae: string;
	cae_vencimiento: string;
	qr_url: string;
	pdf_path: string;
	created_at?: string;
};

export type FacturaPendiente = Omit<FacturaRecord, 'cae' | 'cae_vencimiento' | 'qr_url' | 'pdf_path'> & {
	estado: 'pendiente' | 'emitida' | 'error';
	error_msg?: string | null;
};

class DbService {
	private dbPath: string;
	private db: any | null = null;
	private enabled: boolean = false;
	private fallbackPath: string;

	constructor() {
		const userData = app.getPath('userData');
		this.dbPath = path.join(userData, 'facturas.db');
		this.fallbackPath = path.join(userData, 'facturas-fallback.json');
		this.ensureDir(path.dirname(this.dbPath));
		// Carga diferida de better-sqlite3
		let Database: any = null;
		try {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			Database = require('better-sqlite3');
			this.db = new Database(this.dbPath);
			this.enabled = true;
			this.initSchema();
		} catch (e) {
			this.enabled = false;
			// Preparar fallback JSON para no crashear la app
			if (!fs.existsSync(this.fallbackPath)) {
				try { fs.writeFileSync(this.fallbackPath, JSON.stringify({ configuracion_afip: null, facturas_afip: [], facturas_estado: [] }, null, 2)); } catch {}
			}
		}
	}

	private ensureDir(dir: string) {
		try { fs.mkdirSync(dir, { recursive: true }); } catch {}
	}

	private initSchema() {
		if (!this.enabled || !this.db) return;
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

	private readFallback(): any {
		try {
			const raw = fs.readFileSync(this.fallbackPath, 'utf8');
			return JSON.parse(raw || '{}');
		} catch { return { configuracion_afip: null, facturas_afip: [], facturas_estado: [] }; }
	}
	private writeFallback(data: any) {
		try { fs.writeFileSync(this.fallbackPath, JSON.stringify(data, null, 2)); } catch {}
	}

	getAfipConfig(): AfipConfig | null {
		if (this.enabled && this.db) {
			const row = this.db.prepare('SELECT * FROM configuracion_afip ORDER BY id DESC LIMIT 1').get();
			return row || null;
		}
		const data = this.readFallback();
		return data.configuracion_afip || null;
	}

	saveAfipConfig(cfg: AfipConfig) {
		if (this.enabled && this.db) {
			this.db.prepare('DELETE FROM configuracion_afip').run();
			this.db.prepare(`INSERT INTO configuracion_afip (cuit, pto_vta, cert_path, key_path, entorno) VALUES (@cuit, @pto_vta, @cert_path, @key_path, @entorno)`).run(cfg);
			return;
		}
		const data = this.readFallback();
		data.configuracion_afip = cfg;
		this.writeFallback(data);
	}

	insertFacturaEmitida(rec: FacturaRecord) {
		if (this.enabled && this.db) {
			this.db.prepare(`INSERT INTO facturas_afip (
			numero, pto_vta, tipo_cbte, fecha, cuit_emisor, cuit_receptor, razon_social_receptor, condicion_iva_receptor, neto, iva, total, cae, cae_vencimiento, qr_url, pdf_path
		) VALUES (
			@numero, @pto_vta, @tipo_cbte, @fecha, @cuit_emisor, @cuit_receptor, @razon_social_receptor, @condicion_iva_receptor, @neto, @iva, @total, @cae, @cae_vencimiento, @qr_url, @pdf_path
		)`).run(rec);
			return;
		}
		const data = this.readFallback();
		data.facturas_afip = data.facturas_afip || [];
		data.facturas_afip.unshift({ ...rec, id: (Date.now()) });
		this.writeFallback(data);
	}

	insertFacturaEstadoPendiente(p: Omit<FacturaPendiente, 'estado'> & { estado?: 'pendiente' }) {
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

	updateFacturaEstado(numero: number, pto_vta: number, tipo_cbte: number, estado: 'emitida' | 'error', error_msg?: string) {
		if (this.enabled && this.db) {
			this.db.prepare(`INSERT INTO facturas_estado (numero, pto_vta, tipo_cbte, estado, error_msg, payload) VALUES (@numero, @pto_vta, @tipo_cbte, @estado, @error_msg, NULL)`).run({ numero, pto_vta, tipo_cbte, estado, error_msg: error_msg || null });
			return;
		}
		const data = this.readFallback();
		data.facturas_estado = data.facturas_estado || [];
		data.facturas_estado.push({ numero, pto_vta, tipo_cbte, estado, error_msg: error_msg || null, payload: null, created_at: new Date().toISOString() });
		this.writeFallback(data);
	}

	listFacturas(desde?: string, hasta?: string) {
		if (this.enabled && this.db) {
			if (desde && hasta) {
				return this.db.prepare('SELECT * FROM facturas_afip WHERE date(fecha) BETWEEN date(?) AND date(?) ORDER BY id DESC').all(desde, hasta);
			}
			return this.db.prepare('SELECT * FROM facturas_afip ORDER BY id DESC LIMIT 200').all();
		}
		const data = this.readFallback();
		let rows = Array.isArray(data.facturas_afip) ? data.facturas_afip : [];
		if (desde && hasta) {
			rows = rows.filter((r: any) => (r.fecha || '').slice(0, 10) >= desde && (r.fecha || '').slice(0, 10) <= hasta);
		}
		return rows.sort((a: any, b: any) => (b.id || 0) - (a.id || 0)).slice(0, 200);
	}

	getEmpresaConfig() {
		if (this.enabled && this.db) {
			const row = this.db.prepare('SELECT * FROM empresa_config ORDER BY id DESC LIMIT 1').get();
			return row || null;
		}
		const data = this.readFallback();
		return data.empresa_config || null;
	}

	saveEmpresaConfig(cfg: { razon_social: string; cuit: string; domicilio?: string; condicion_iva?: string; logo_path?: string }) {
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

	saveParametrosFacturacion(p: { tipo_defecto?: string; pto_vta?: number; numeracion?: number }) {
		if (this.enabled && this.db) {
			this.db.prepare('DELETE FROM parametros_facturacion').run();
			this.db.prepare('INSERT INTO parametros_facturacion (tipo_defecto, pto_vta, numeracion) VALUES (@tipo_defecto,@pto_vta,@numeracion)').run(p);
			return;
		}
		const data = this.readFallback();
		data.parametros_facturacion = p;
		this.writeFallback(data);
	}

	listPdfsEnDocumentos(): Array<{ name: string; path: string; mtime: number }> {
		const docs = path.join(app.getPath('documents'), 'facturas');
		try { fs.mkdirSync(docs, { recursive: true }); } catch {}
		try {
			const files = fs.readdirSync(docs).filter(f => f.toLowerCase().endsWith('.pdf'));
			return files.map(f => ({ name: f, path: path.join(docs, f), mtime: fs.statSync(path.join(docs, f)).mtimeMs })).sort((a,b)=>b.mtime-a.mtime);
		} catch { return []; }
	}

	// ===== Perfiles =====
	listPerfiles(): Array<{ id: number; nombre: string; permisos: any; parametros: any; created_at?: string }> {
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
				for (const s of seeds) ins.run({ nombre: s.nombre, permisos: JSON.stringify(s.permisos), parametros: JSON.stringify(s.parametros) });
				rows = this.db.prepare('SELECT * FROM perfiles_config ORDER BY id ASC').all();
			}
			return rows.map((r: any) => ({ id: r.id, nombre: r.nombre, permisos: JSON.parse(r.permisos||'{}'), parametros: JSON.parse(r.parametros||'{}'), created_at: r.created_at }));
		}
		const data = this.readFallback();
		if (!Array.isArray((data as any).perfiles) || (data as any).perfiles.length === 0) {
			(data as any).perfiles = [
				{ id: Date.now()-2, nombre: 'Administrador', permisos: { facturacion: true, caja: true, administracion: true, configuracion: true }, parametros: {} },
				{ id: Date.now()-1, nombre: 'Cajero', permisos: { facturacion: true, caja: true, administracion: false, configuracion: false }, parametros: {} },
				{ id: Date.now(), nombre: 'Vendedor', permisos: { facturacion: false, caja: true, administracion: false, configuracion: false, consulta: true }, parametros: {} }
			];
			this.writeFallback(data);
		}
		return (data as any).perfiles;
	}

	getPerfil(id: number) {
		if (this.enabled && this.db) {
			const r = this.db.prepare('SELECT * FROM perfiles_config WHERE id=?').get(id);
			return r ? { id: r.id, nombre: r.nombre, permisos: JSON.parse(r.permisos||'{}'), parametros: JSON.parse(r.parametros||'{}'), created_at: r.created_at } : null;
		}
		const data = this.readFallback();
		const found = (Array.isArray(data.perfiles) ? data.perfiles : []).find((p: any) => Number(p.id) === Number(id));
		return found || null;
	}

	savePerfil(perfil: { id?: number; nombre: string; permisos: any; parametros: any }): number {
		if (this.enabled && this.db) {
			if (perfil.id) {
				this.db.prepare('UPDATE perfiles_config SET nombre=@nombre, permisos=@permisos, parametros=@parametros WHERE id=@id')
					.run({ id: perfil.id, nombre: perfil.nombre, permisos: JSON.stringify(perfil.permisos||{}), parametros: JSON.stringify(perfil.parametros||{}) });
				return Number(perfil.id);
			}
			const info = this.db.prepare('INSERT INTO perfiles_config (nombre, permisos, parametros) VALUES (@nombre, @permisos, @parametros)')
				.run({ nombre: perfil.nombre, permisos: JSON.stringify(perfil.permisos||{}), parametros: JSON.stringify(perfil.parametros||{}) });
			return Number(info.lastInsertRowid || 0);
		}
		const data = this.readFallback();
		data.perfiles = Array.isArray(data.perfiles) ? data.perfiles : [];
		if (perfil.id) {
			const idx = data.perfiles.findIndex((p: any) => Number(p.id) === Number(perfil.id));
			if (idx >= 0) data.perfiles[idx] = perfil; else data.perfiles.push(perfil);
			this.writeFallback(data);
			return Number(perfil.id);
		}
		const id = Date.now();
		data.perfiles.push({ ...perfil, id });
		this.writeFallback(data);
		return id;
	}

	deletePerfil(id: number): boolean {
		if (this.enabled && this.db) {
			this.db.prepare('DELETE FROM perfiles_config WHERE id=?').run(id);
			return true;
		}
		const data = this.readFallback();
		const before = (Array.isArray(data.perfiles) ? data.perfiles : []).length;
		data.perfiles = (Array.isArray(data.perfiles) ? data.perfiles : []).filter((p: any) => Number(p.id) !== Number(id));
		this.writeFallback(data);
		return (Array.isArray(data.perfiles) ? data.perfiles : []).length < before;
	}
}

let instance: DbService | null = null;
export function getDb(): DbService {
	if (!instance) instance = new DbService();
	return instance;
}


