import path from 'path';
import { getDb } from './DbService';

export type ComprobanteInput = {
	pto_vta: number;
	tipo_cbte: number; // 1=A, 6=B, 11=C, 3=NC A, 8=NC B, etc.
	concepto?: number; // 1=Productos, 2=Servicios, 3=Productos y Servicios
	doc_tipo?: number; // 80=CUIT, 86=CUIL, 96=DNI, 99=Consumidor Final
	mon_id?: string; // PES, DOL, EUR
	fecha: string; // YYYYMMDD
	cuit_emisor: string;
	cuit_receptor?: string;
	razon_social_receptor?: string;
	condicion_iva_receptor?: string; // RI/MT/EX/CF
	neto: number;
	iva: number;
	total: number;
	detalle: Array<{ descripcion: string; cantidad: number; precioUnitario: number; alicuotaIva: number }>;
};

export type ComprobanteOutput = {
	numero: number;
	cae: string;
	cae_vencimiento: string; // YYYYMMDD
};

export class AfipService {
	private afip: any | null = null;

	private async ensureAfip() {
		if (this.afip) return this.afip;
		const db = getDb();
		const cfg = db.getAfipConfig();
		if (!cfg) throw new Error('Falta configurar AFIP');
		const production = cfg.entorno === 'produccion';
		let AfipLib: any;
		try {
			// Carga diferida para no crashear si falta el SDK
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			AfipLib = require('@afipsdk/afip.js');
		} catch (e) {
			throw new Error('SDK de AFIP no instalado. Instala el paquete correspondiente (@afipsdk/afip.js) o indica el SDK a utilizar.');
		}
		this.afip = new AfipLib({
			CUIT: Number(cfg.cuit),
			production,
			cert: cfg.cert_path,
			key: cfg.key_path
		});
		return this.afip;
	}

	async emitirComprobante(input: ComprobanteInput): Promise<ComprobanteOutput> {
		const afip = await this.ensureAfip();
		const ptoVta = input.pto_vta;
		const tipoCbte = input.tipo_cbte;

		// Obtener último número autorizado
		const last = await afip.ElectronicBilling.getLastVoucher(ptoVta, tipoCbte);
		const nuevoNumero = Number(last) + 1;

		// Construir conceptos/tributos/alícuotas basados en detalle
		const alicuotasMap = new Map<number, { Id: number; BaseImp: number; Importe: number }>();
		for (const d of input.detalle || []) {
			const base = d.cantidad * d.precioUnitario;
			const imp = (base * d.alicuotaIva) / 100;
			const key = d.alicuotaIva;
			const prev = alicuotasMap.get(key) || { Id: this.mapAlicuotaId(key), BaseImp: 0, Importe: 0 };
			prev.BaseImp += base;
			prev.Importe += imp;
			alicuotasMap.set(key, prev);
		}

		const ivaArray = Array.from(alicuotasMap.values());

		const data = {
			CantReg: 1,
			PtoVta: ptoVta,
			CbteTipo: tipoCbte,
			Concepto: input.concepto || 1,
			DocTipo: input.doc_tipo || (input.cuit_receptor ? 80 : 99),
			DocNro: input.cuit_receptor ? Number(input.cuit_receptor) : 0,
			CbteDesde: nuevoNumero,
			CbteHasta: nuevoNumero,
			CbteFch: input.fecha,
			ImpTotal: input.total,
			ImpTotConc: 0,
			ImpNeto: input.neto,
			ImpOpEx: 0,
			ImpIVA: input.iva,
			ImpTrib: 0,
			MonId: input.mon_id || 'PES',
			MonCotiz: 1,
			Iva: ivaArray
		};

		const res = await afip.ElectronicBilling.createVoucher(data);
		return { numero: nuevoNumero, cae: res.CAE, cae_vencimiento: res.CAEFchVto };
	}

	private mapAlicuotaId(porc: number): number {
		switch (porc) {
			case 10.5: return 4; // 10,5%
			case 21: return 5; // 21%
			case 27: return 6; // 27%
			default: return 5;
		}
	}
}

let instance: AfipService | null = null;
export function getAfipService(): AfipService { if (!instance) instance = new AfipService(); return instance; }


