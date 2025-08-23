import fs from 'fs';
import path from 'path';
import os from 'os';
import { app, shell } from 'electron';
import dayjs from 'dayjs';
import { getDb } from './DbService';
import { getAfipService, ComprobanteInput } from './AfipService';
import { afipService } from '../modules/facturacion/afipService';
import { Comprobante } from '../modules/facturacion/types';
import { ResultadoProvincial } from '../modules/facturacion/provincia/IProvinciaService';
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

	/**
	 * Emite factura con integración provincial (AFIP + ATM/AGIP/ARBA)
	 */
	async emitirFacturaConProvincias(params: EmitirFacturaParams): Promise<{
		numero: number;
		cae: string;
		caeVencimiento: string;
		qrUrl: string;
		pdfPath: string;
		resultado: ResultadoProvincial;
	}> {
		const db = getDb();
		const startTime = Date.now();

		try {
			// Convertir params a formato Comprobante
			const comprobante: Comprobante = this.convertirAComprobante(params);

			// Solicitar CAE con procesamiento provincial
			const resultado = await afipService.solicitarCAEConProvincias(comprobante);

			if (!resultado.afip.success || !resultado.afip.cae) {
				throw new Error(resultado.afip.error || 'Error en emisión AFIP');
			}

			const numero = resultado.afip.numero!;
			const cae = resultado.afip.cae;
			const caeVencimiento = resultado.afip.caeVencimiento!;

			// Construir QR de AFIP
			const qrUrl = this.buildQrAfipUrl({
				ver: 1,
				fecha: dayjs(params.fecha, 'YYYYMMDD').format('YYYY-MM-DD'),
				cuit: Number(params.cuit_emisor),
				ptoVta: params.pto_vta,
				tipoCmp: params.tipo_cbte,
				nroCmp: numero,
				importe: params.total,
				moneda: 'PES',
				ctz: 1,
				tipoDoc: 99,
				nroDoc: 0,
				tipoCodAut: 'E',
				codAut: cae
			});

			// Generar PDF
			const pdfFileName = `factura_${numero}_${Date.now()}.pdf`;
			const pdfPath = path.join(this.getFacturasDir(), pdfFileName);

			await getFacturaGenerator().generarPdf(params.plantilla || 'factura_a', {
				emisor: {
					nombre: params.empresa?.nombre || 'Empresa',
					cuit: params.cuit_emisor,
					domicilio: params.empresa?.domicilio,
					iibb: params.empresa?.iibb,
					inicio: params.empresa?.inicio,
					logoPath: params.logoPath
				},
				receptor: {
					nombre: params.razon_social_receptor || 'Cliente',
					cuit: params.cuit_receptor || undefined,
					condicionIva: params.condicion_iva_receptor || 'CF',
					domicilio: undefined
				},
				cbte: {
					tipo: String(params.tipo_cbte),
					pto_vta: params.pto_vta,
					numero,
					fecha: params.fecha
				},
				detalle: params.detalle?.map(item => ({
					descripcion: item.descripcion,
					cantidad: item.cantidad,
					precioUnitario: item.precioUnitario,
					importe: item.cantidad * item.precioUnitario,
					alicuotaIva: item.alicuotaIva
				})) || [],
				totales: {
					neto: params.neto,
					iva: params.iva,
					total: params.total
				},
				afip: {
					cae,
					cae_vto: caeVencimiento,
					qr_url: qrUrl
				}
			});

			// Guardar en base de datos con información provincial
			const facturaRecord = {
				numero,
				pto_vta: params.pto_vta,
				tipo_cbte: params.tipo_cbte,
				fecha: params.fecha,
				cuit_emisor: params.cuit_emisor,
				cuit_receptor: params.cuit_receptor || null,
				razon_social_receptor: params.razon_social_receptor || null,
				condicion_iva_receptor: params.condicion_iva_receptor || null,
				neto: params.neto,
				iva: params.iva,
				total: params.total,
				cae,
				cae_vencimiento: caeVencimiento,
				qr_url: qrUrl,
				pdf_path: pdfPath,
				// Campos provinciales
				provincia: resultado.provincial?.jurisdiccion || null,
				provincia_estado: resultado.estado,
				provincia_servicio: resultado.provincial?.servicio || null,
				provincia_numero: resultado.provincial?.numeroComprobante || null,
				provincia_codigo: resultado.provincial?.codigo || null,
				provincia_respuesta: resultado.provincial ? JSON.stringify(resultado.provincial) : null,
				provincia_error: resultado.provincial?.error || null
			};

			db.insertFacturaEmitida(facturaRecord);

			// Log del resultado final
			console.log(`✅ Factura ${numero} emitida - Estado: ${resultado.estado} - Duración: ${Date.now() - startTime}ms`);

			return {
				numero,
				cae,
				caeVencimiento,
				qrUrl,
				pdfPath,
				resultado
			};

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			
			// Log del error
			console.error(`❌ Error emitiendo factura con provincias: ${errorMessage} - Duración: ${Date.now() - startTime}ms`);

			// Intentar guardar como pendiente si tenemos algunos datos
			try {
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
			} catch (dbError) {
				console.error('Error guardando factura pendiente:', dbError);
			}

			throw new Error(`Error en emisión con provincias: ${errorMessage}`);
		}
	}

	/**
	 * Convierte parámetros legacy a formato Comprobante
	 */
	private convertirAComprobante(params: EmitirFacturaParams): Comprobante {
		return {
			tipo: this.mapTipoComprobante(params.tipo_cbte),
			puntoVenta: params.pto_vta,
			fecha: params.fecha,
			empresa: {
				cuit: params.cuit_emisor,
				razonSocial: params.empresa?.nombre || 'Empresa',
				domicilio: params.empresa?.domicilio || '',
				condicionIva: 'RI' // Asumimos RI por defecto
			},
			cliente: params.cuit_receptor ? {
				cuit: params.cuit_receptor,
				razonSocial: params.razon_social_receptor || 'Cliente',
				condicionIva: (params.condicion_iva_receptor as any) || 'CF'
			} : undefined,
			items: params.detalle?.map(item => ({
				descripcion: item.descripcion,
				cantidad: item.cantidad,
				precioUnitario: item.precioUnitario,
				iva: item.alicuotaIva,
				alicuotaIva: item.alicuotaIva
			})) || [],
			totales: {
				neto: params.neto,
				iva: params.iva,
				total: params.total
			},
			observaciones: '',
			codigoOperacion: ''
		};
	}

	/**
	 * Mapea tipo de comprobante numérico a string
	 */
	private mapTipoComprobante(tipoCbte: number): 'A' | 'B' | 'C' | 'E' {
		switch (tipoCbte) {
			case 1: return 'A';
			case 6: return 'B';
			case 11: return 'C';
			case 19: return 'E';
			default: return 'B';
		}
	}

	/**
	 * Obtiene el directorio de facturas
	 */
	private getFacturasDir(): string {
		const facturasDirName = process.env.FACTURAS_DIR || 'facturas';
		const factDir = path.join(app.getPath('userData'), 'documentos', facturasDirName);
		if (!fs.existsSync(factDir)) {
			fs.mkdirSync(factDir, { recursive: true });
		}
		return factDir;
	}
}

let instance: FacturacionService | null = null;
export function getFacturacionService(): FacturacionService { if (!instance) instance = new FacturacionService(); return instance; }


