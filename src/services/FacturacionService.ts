import fs from 'fs';
import path from 'path';
import os from 'os';
import { app, shell } from 'electron';
import dayjs from 'dayjs';
import { getDb } from './DbService';
import { getAfipService, ComprobanteInput } from './AfipService';
import { getFacturaGenerator, PlantillaTipo } from './FacturaGenerator';

// CommonJS requires
// eslint-disable-next-line @typescript-eslint/no-var-requires
const QRCode = require('qrcode');

export type EmitirFacturaParams = ComprobanteInput & {
	logoPath?: string;
	empresa?: { nombre?: string; cuit?: string; iibb?: string; inicio?: string; domicilio?: string };
	plantilla?: PlantillaTipo; // factura_a, factura_b, nota_credito, recibo, remito
};

export class FacturacionService {
	async emitirFacturaYGenerarPdf(params: EmitirFacturaParams) {
		const db = getDb();
		// Intentar emitir
		let numero = 0; let cae = ''; let cae_venc = '';
		try {
			const out = await getAfipService().emitirComprobante(params);
			numero = out.numero; cae = out.cae; cae_venc = out.cae_vencimiento;
		} catch (e: any) {
			const fallbackNumero = Math.floor(Date.now() / 1000);
			db.insertFacturaEstadoPendiente({
				numero: fallbackNumero,
				pto_vta: params.pto_vta,
				tipo_cbte: params.tipo_cbte,
				fecha: params.fecha,
				cuit_emisor: params.cuit_emisor,
				cuit_receptor: params.cuit_receptor,
				razon_social_receptor: params.razon_social_receptor,
				condicion_iva_receptor: params.condicion_iva_receptor,
				neto: params.neto,
				iva: params.iva,
				total: params.total
			});
			throw new Error('AFIP no respondió o error de emisión: ' + String(e?.message || e));
		}

		// QR de AFIP
		const qrUrl = this.buildQrAfipUrl({
			ver: 1,
			fecha: dayjs(params.fecha, 'YYYYMMDD').format('YYYY-MM-DD'),
			cuit: Number(params.cuit_emisor),
			ptoVta: params.pto_vta,
			tipoCmp: params.tipo_cbte,
			nroCmp: numero,
			importe: Number(params.total.toFixed(2)),
			moneda: 'PES',
			ctz: 1,
			tipoDocRec: params.cuit_receptor ? 80 : 99,
			nroDocRec: params.cuit_receptor ? Number(params.cuit_receptor) : 0,
			tipoCodAut: 'E',
			codAut: Number(cae)
		});

		// Generar PDF vía plantilla
		const pdfPath = await getFacturaGenerator().generarPdf(params.plantilla || 'factura_a', {
			emisor: { nombre: params.empresa?.nombre || 'Empresa', cuit: params.empresa?.cuit || params.cuit_emisor, domicilio: params.empresa?.domicilio, iibb: params.empresa?.iibb, inicio: params.empresa?.inicio, logoPath: params.logoPath },
			receptor: { nombre: params.razon_social_receptor || 'Consumidor Final', cuit: params.cuit_receptor, condicionIva: params.condicion_iva_receptor },
			cbte: { tipo: String(params.tipo_cbte), pto_vta: params.pto_vta, numero, fecha: params.fecha },
			detalle: (params.detalle || []).map(d => ({ ...d, importe: d.cantidad * d.precioUnitario })),
			totales: { neto: params.neto, iva: params.iva, total: params.total },
			afip: { cae, cae_vto: cae_venc, qr_url: qrUrl }
		});

		// Guardar en DB
		db.insertFacturaEmitida({
			numero,
			pto_vta: params.pto_vta,
			tipo_cbte: params.tipo_cbte,
			fecha: dayjs(params.fecha, 'YYYYMMDD').format('YYYY-MM-DD'),
			cuit_emisor: params.cuit_emisor,
			cuit_receptor: params.cuit_receptor || null,
			razon_social_receptor: params.razon_social_receptor || null,
			condicion_iva_receptor: params.condicion_iva_receptor || null,
			neto: params.neto,
			iva: params.iva,
			total: params.total,
			cae,
			cae_vencimiento: cae_venc,
			qr_url: qrUrl,
			pdf_path: pdfPath
		});

		return { numero, cae, cae_vencimiento: cae_venc, qr_url: qrUrl, pdf_path: pdfPath };
	}

	private buildQrAfipUrl(data: any): string {
		const base = 'https://www.afip.gob.ar/fe/qr/?p=';
		const payload = Buffer.from(JSON.stringify(data)).toString('base64');
		return base + payload;
	}

	async abrirPdf(filePath: string) {
		try { await shell.openPath(filePath); } catch {}
	}
}

let instance: FacturacionService | null = null;
export function getFacturacionService(): FacturacionService { if (!instance) instance = new FacturacionService(); return instance; }


