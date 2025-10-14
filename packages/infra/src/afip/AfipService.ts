import path from 'path';
import { getDb } from '@infra/database';
import { CompatAfip } from '../../../../src/modules/facturacion/adapters/CompatAfip';

/**
 * Input para crear un comprobante electrónico AFIP
 */
export type ComprobanteInput = {
	pto_vta: number; // Punto de venta
	tipo_cbte: number; // Tipo de comprobante: 1=A, 6=B, 11=C, 3=NC A, 8=NC B, etc.
	concepto?: number; // 1=Productos, 2=Servicios, 3=Productos y Servicios
	doc_tipo?: number; // 80=CUIT, 86=CUIL, 96=DNI, 99=Consumidor Final
	mon_id?: string; // Moneda: PES, DOL, EUR
	fecha: string; // Fecha en formato YYYYMMDD
	cuit_emisor: string; // CUIT del emisor
	cuit_receptor?: string; // CUIT del receptor (opcional)
	razon_social_receptor?: string; // Razón social del receptor (opcional)
	condicion_iva_receptor?: string; // Condición IVA: RI/MT/EX/CF
	neto: number; // Importe neto
	iva: number; // Importe IVA
	total: number; // Importe total
	detalle: Array<{ 
		descripcion: string; 
		cantidad: number; 
		precioUnitario: number; 
		alicuotaIva: number 
	}>; // Detalle de items
	// Campos para servicios
	FchServDesde?: string; // Fecha servicio desde (YYYYMMDD)
	FchServHasta?: string; // Fecha servicio hasta (YYYYMMDD)
	FchVtoPago?: string;   // Fecha vencimiento pago (YYYYMMDD)
	// Comprobantes asociados (NC/ND)
	comprobantesAsociados?: Array<{ 
		Tipo: number; 
		PtoVta: number; 
		Nro: number 
	}>;
};

/**
 * Output al emitir un comprobante electrónico AFIP
 */
export type ComprobanteOutput = {
	numero: number; // Número de comprobante asignado
	cae: string; // Código de Autorización Electrónico
	cae_vencimiento: string; // Fecha de vencimiento del CAE (YYYYMMDD)
};

/**
 * Servicio para integración con AFIP WSFE
 * Migrado desde src/services/AfipService.ts
 * 
 * @infra/afip - Cliente HTTP para facturación electrónica AFIP
 */
export class AfipService {
	private afip: any | null = null; // Instancia de CompatAfip

	/**
	 * Asegura que el cliente AFIP está inicializado
	 */
	private async ensureAfip() {
		if (this.afip) return this.afip;
		const db = getDb();
		const cfg = db.getAfipConfig();
		if (!cfg) throw new Error('Falta configurar AFIP');
		const production = cfg.entorno === 'produccion';

		this.afip = new CompatAfip({
			CUIT: Number(cfg.cuit),
			production,
			cert: cfg.cert_path,
			key: cfg.key_path
		});
		return this.afip;
	}

	/**
	 * Emite un comprobante electrónico en AFIP
	 * @param input - Datos del comprobante
	 * @returns Número, CAE y vencimiento del CAE
	 */
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

	/**
	 * Mapea porcentaje de alícuota IVA a ID de AFIP
	 * @param porc - Porcentaje de IVA (10.5, 21, 27)
	 * @returns ID de alícuota para AFIP
	 */
	private mapAlicuotaId(porc: number): number {
		switch (porc) {
			case 10.5: return 4; // 10,5%
			case 21: return 5; // 21%
			case 27: return 6; // 27%
			default: return 5;
		}
	}
}

// Singleton instance
let instance: AfipService | null = null;

/**
 * Obtiene la instancia singleton del servicio AFIP
 */
export function getAfipService(): AfipService { 
	if (!instance) instance = new AfipService(); 
	return instance; 
}

