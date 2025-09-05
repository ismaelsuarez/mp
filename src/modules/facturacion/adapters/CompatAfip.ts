import { Afip as LocalAfip } from '../../../libs/afip';
import type { Context } from '../../../libs/afip';
import fs from 'fs';
import https from 'https';
import crypto from 'crypto';
import path from 'path';

function ensureWsdlAssets() {
	try {
		const src = path.resolve(process.cwd(), 'sdk/afip.ts-main/src/soap/wsdl');
		const dest = path.resolve(__dirname, '../../../..', 'sdk/afip.ts-main/src/soap/wsdl');
		if (!fs.existsSync(dest)) {
			fs.mkdirSync(dest, { recursive: true });
		}
		const needed = [
			'wsfe.wsdl',
			'wsfe-production.wsdl',
			'wsaa.wsdl',
			'ws_sr_padron_a4.wsdl',
			'ws_sr_padron_a4-production.wsdl',
			'ws_sr_padron_a5.wsdl',
			'ws_sr_padron_a5-production.wsdl',
			'ws_sr_padron_a10.wsdl',
			'ws_sr_padron_a10-production.wsdl',
			'ws_sr_padron_a13.wsdl',
			'ws_sr_padron_a13-production.wsdl',
			'ws_sr_inscription_proof.wsdl',
			'ws_sr_inscription_proof-production.wsdl'
		];
		for (const file of needed) {
			const s = path.join(src, file);
			const d = path.join(dest, file);
			if (fs.existsSync(s) && !fs.existsSync(d)) {
				fs.copyFileSync(s, d);
			}
		}
	} catch {}
}

function readPemIfPath(input: string): string {
	try {
		if (input.includes('-----BEGIN')) return input;
		if (fs.existsSync(input)) {
			return fs.readFileSync(input, 'utf8');
		}
	} catch {}
	return input;
}

export class CompatAfip {
	private readonly inner: LocalAfip;
	constructor(opts: { CUIT: number; production: boolean; cert: string; key: string }) {
		ensureWsdlAssets();
		const certContent = readPemIfPath(opts.cert);
		const keyContent = readPemIfPath(opts.key);

		// Agente HTTPS personalizado para compatibilidad con servidores AFIP antiguos
		// - Fuerza TLS >= 1.2
		// - Reduce SECLEVEL a 1 para permitir DHE de 1024 bits
		// - Habilita SSL_OP_LEGACY_SERVER_CONNECT
		const httpsAgent = new https.Agent({
			cert: certContent,
			key: keyContent,
			secureOptions: (crypto as any).constants?.SSL_OP_LEGACY_SERVER_CONNECT,
			minVersion: 'TLSv1.2',
			// Preferir suites RSA-GCM para evitar DHE 1024 del servidor y bajar SECLEVEL
			ciphers: 'AES128-GCM-SHA256:AES256-GCM-SHA384:@SECLEVEL=1',
			// Forzar protocolo TLSv1.2 en clientes que lo soporten
			secureProtocol: 'TLSv1_2_method' as any,
		});
		const ctx: Context = {
			cuit: opts.CUIT,
			production: !!opts.production,
			cert: certContent,
			key: keyContent,
			handleTicket: false,
			// Inyectar agente HTTPS personalizado a afip.ts
			httpsAgent
		};
		this.inner = new LocalAfip(ctx);
	}

	public get ElectronicBilling() {
		const svc = (this.inner as any).electronicBillingService;
		return {
			getServerStatus: async () => {
				const res: any = await svc.getServerStatus();
				return res.FEDummyResult ?? res;
			},
			getLastVoucher: async (ptoVta: number, tipoCbte: number) => {
				const res: any = await svc.getLastVoucher(ptoVta, tipoCbte);
				return res.CbteNro ?? res;
			},
			createVoucher: async (req: any) => {
				const r: any = await svc.createInvoice(req);
				return {
					CAE: r.cae,
					CAEFchVto: r.caeFchVto,
					Observaciones: r.response?.FeDetResp?.FECAEDetResponse?.[0]?.Observaciones?.Obs ?? undefined
				};
			},
			getVoucherTypes: async () => {
				const r: any = await svc.getVoucherTypes();
				return r.ResultGet?.CbteTipo ?? r;
			},
			getConceptTypes: async () => {
				const r: any = await svc.getConceptTypes();
				return r.ResultGet?.ConceptoTipo ?? r;
			},
			getDocumentTypes: async () => {
				const r: any = await svc.getDocumentTypes();
				return r.ResultGet?.DocTipo ?? r;
			},
			getCurrenciesTypes: async () => {
				const r: any = await svc.getCurrenciesTypes();
				return r.ResultGet?.Moneda ?? r;
			},
			getSalesPoints: async () => {
				const r: any = await svc.getSalesPoints();
				return r.ResultGet?.PtoVenta ?? r;
			},
			getCurrencyQuotation: async (monId: string) => {
				const anySvc: any = svc as any;
				if (typeof anySvc.getCurrencyQuotation === 'function') {
					return anySvc.getCurrencyQuotation(monId);
				}
				if (typeof anySvc.getParamGetCotizacion === 'function') {
					return anySvc.getParamGetCotizacion({ MonId: monId });
				}
				throw new Error('getCurrencyQuotation no disponible en SDK local');
			}
		};
	}

	public get ElectronicBillingMiPyme() {
		const svc = (this.inner as any).electronicBillingMiPymeService;
		return {
			getLastVoucher: async (ptoVta: number, tipo: number) => {
				const res: any = await svc.getLastVoucherMiPyme(ptoVta, tipo);
				return res.CbteNro ?? res;
			},
			createVoucher: async (req: any & { ModoFin?: 'ADC'|'SCA' }) => {
				const r: any = await svc.createVoucherMiPyme(req);
				return {
					CAE: r.cae,
					CAEFchVto: r.caeFchVto,
					Observaciones: r.response?.FeDetResp?.FECAEDetResponse?.[0]?.Observaciones?.Obs ?? undefined
				};
			}
		};
	}

	// Proxy mínimo para Padrón 13
	public get registerScopeThirteenService() {
		const svc = (this.inner as any).registerScopeThirteenService;
		return {
			getServerStatus: async () => {
				return await svc.getServerStatus();
			},
			getTaxpayerDetails: async (identifier: number) => {
				return await svc.getTaxpayerDetails(identifier);
			},
			getTaxIDByDocument: async (documentNumber: string) => {
				return await svc.getTaxIDByDocument(documentNumber);
			}
		};
	}
}
