import { Afip as LocalAfip } from '../../../libs/afip';
import type { Context } from '../../../libs/afip';
import fs from 'fs';
import https from 'https';
import crypto from 'crypto';
import path from 'path';
import { resolveEndpoints } from '../../../services/afip/AfipEndpoints';
import axios from 'axios';
import { parseStringPromise as parseXmlString } from 'xml2js';

function ensureWsdlAssets() {
	try {
		// Destino donde el SDK local espera encontrar los WSDL en tiempo de ejecución (dentro de dist)
		const dest = path.resolve(__dirname, '../../../..', 'sdk/afip.ts-main/src/soap/wsdl');
		// Candidatos de origen (dev, empaquetado, asar-unpacked)
		const srcCandidates = [
			path.resolve(process.cwd(), 'sdk/afip.ts-main/src/soap/wsdl'),
			path.resolve(__dirname, '../../../../sdk/afip.ts-main/src/soap/wsdl'),
			path.resolve(__dirname, '../../../../../sdk/afip.ts-main/src/soap/wsdl'),
			(process as any).resourcesPath ? path.resolve((process as any).resourcesPath, 'app', 'sdk/afip.ts-main/src/soap/wsdl') : '',
			(process as any).resourcesPath ? path.resolve((process as any).resourcesPath, 'app.asar.unpacked', 'sdk/afip.ts-main/src/soap/wsdl') : '',
			// Instalado por defecto en Windows (C:\\Program Files\\Tc-Mp\\resources\\app...)
			'C:/Program Files/Tc-Mp/resources/app/sdk/afip.ts-main/src/soap/wsdl',
			'C:/Program Files/Tc-Mp/resources/app.asar.unpacked/sdk/afip.ts-main/src/soap/wsdl',
		].filter(Boolean);
		let src = srcCandidates.find(p => {
			try { return fs.existsSync(p); } catch { return false; }
		});
		if (!src) {
			// Si no hay origen válido, salir silenciosamente (el SDK podría resolver internamente)
			return;
		}
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
    private readonly production: boolean;
    private readonly certPem: string;
    private readonly keyPem: string;
    private static prodAuditCaptured = 0;
    constructor(opts: { CUIT: number; production: boolean; cert: string; key: string }) {
		ensureWsdlAssets();
		const certContent = readPemIfPath(opts.cert);
		const keyContent = readPemIfPath(opts.key);
        this.production = !!opts.production;
        this.certPem = certContent;
        this.keyPem = keyContent;

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
			// Guardar tickets (TA-*.json) en carpeta de datos del usuario para evitar permisos en Program Files
			ticketPath: (() => {
				try {
					const base = (process as any).env?.APPDATA || (process as any).env?.LOCALAPPDATA || __dirname;
					const dir = path.resolve(String(base), 'Tc-Mp', 'afip', 'tickets');
					try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); } catch {}
					return dir;
				} catch { return undefined as any; }
			})(),
			// Inyectar agente HTTPS personalizado a afip.ts
			httpsAgent
		};
        this.inner = new LocalAfip(ctx);
	}

    private isProdAuditEnabled(): boolean {
        try {
            return !!this.production && String(process.env.AFIP_PROD_AUDIT_TAP || '') === '1';
        } catch { return false; }
    }

    private getProdAuditMax(): number {
        const n = Number(process.env.AFIP_AUDIT_SAMPLE || 3);
        return Number.isFinite(n) && n > 0 ? n : 3;
    }

    private sanitizeXmlForLog(xml: string): string {
        try {
            return String(xml)
                .replace(/<Token>[^<]*<\/Token>/gi, '<Token>[REDACTED]</Token>')
                .replace(/<Sign>[^<]*<\/Sign>/gi, '<Sign>[REDACTED]</Sign>');
        } catch { return xml; }
    }

    private writeAuditFiles(baseDir: string, files: Array<{ name: string; content: any; asXml?: boolean }>): void {
        try { fs.mkdirSync(baseDir, { recursive: true }); } catch {}
        for (const f of files) {
            try {
                const p = path.join(baseDir, f.name);
                const data = typeof f.content === 'string' ? f.content : JSON.stringify(f.content, null, 2);
                const out = f.asXml ? this.sanitizeXmlForLog(data) : data;
                fs.writeFileSync(p, out, 'utf8');
            } catch {}
        }
    }

    private buildAuditSummary(feReq: any, endpoint: string, res: any): any {
        const det = feReq?.FeCAEReq?.FeDetReq?.FECAEDetRequest?.[0] || feReq?.FeCAEReq?.FeDetReq?.[0] || {};
        const to2 = (n: any) => Number(Number(n || 0).toFixed(2));
        const mathTotal = to2(det.ImpNeto) + to2(det.ImpIVA) + to2(det.ImpTrib) + to2(det.ImpTotConc) + to2(det.ImpOpEx);
        const mathOk = to2(det.ImpTotal) === to2(mathTotal);
        let ivaSumOk = true;
        try {
            const arr = Array.isArray(det?.Iva?.AlicIva) ? det.Iva.AlicIva : [];
            const sumIva = arr.reduce((acc: number, x: any) => acc + to2(x?.Importe), 0);
            ivaSumOk = to2(sumIva) === to2(det.ImpIVA);
        } catch { ivaSumOk = true; }
        const needDates = Number(det.Concepto) === 2 || Number(det.Concepto) === 3;
        const datesOk = needDates ? !!det.FchServDesde && !!det.FchServHasta && !!det.FchVtoPago : true;
        const hasCondIva = typeof det.CondicionIVAReceptorId === 'number';
        const host = (() => { try { return new URL(endpoint).host; } catch { return ''; } })();
        const prodHostsOk = /servicios1\.afip\.gov\.ar/i.test(host);
        const resultado = res?.FeDetResp?.FECAEDetResponse?.[0]?.Resultado || res?.FeCabResp?.Resultado || null;
        const cae = res?.FeDetResp?.FECAEDetResponse?.[0]?.CAE || null;
        const caeVto = res?.FeDetResp?.FECAEDetResponse?.[0]?.CAEFchVto || null;
        const obs = (() => {
            const raw = res?.FeDetResp?.FECAEDetResponse?.[0]?.Observaciones?.Obs || [];
            return Array.isArray(raw) ? raw.map((o: any) => ({ Code: o?.Code, Msg: o?.Msg })) : [];
        })();
        const errs = (() => {
            const raw = res?.Errors?.Err || [];
            return Array.isArray(raw) ? raw.map((e: any) => ({ Code: e?.Code, Msg: e?.Msg })) : [];
        })();
        return { endpointHost: host, prodHostsOk, mathOk, ivaSumOk, datesOk, hasCondIva, resultado, cae, caeVto, obs, errs };
    }

    private async getWsfeEndpointForDebugInternal(): Promise<string | undefined> {
        try {
            const svc = (this.inner as any).electronicBillingService;
            if (!svc || typeof svc.getClient !== 'function') return undefined;
            const client = await svc.getClient();
            const endpoint = (client as any)?.endpoint || (client as any)?.getEndpoint?.();
            return typeof endpoint === 'string' ? endpoint : undefined;
        } catch {
            return undefined;
        }
    }

    private async assertWsfeEndpoint(): Promise<void> {
        const ep = await this.getWsfeEndpointForDebugInternal();
        const env = this.production ? 'prod' : 'homo';
        const expected = resolveEndpoints(env as any).wsfe;
        const expectedHost = new URL(expected).host;
        if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.info(`[AFIP:${env}] WSFE endpoint → ${ep || '(desconocido)'}`);
        }
        if (ep) {
            const host = new URL(ep).host;
            const isWsfeHost = /wswhomo\.afip\.gov\.ar|servicios1\.afip\.gov\.ar/i.test(host);
            const isWsaaHost = /wsaahomo\.afip\.gov\.ar|wsaa\.afip\.gov\.ar/i.test(host);
            if (!isWsfeHost || isWsaaHost) {
                throw new Error('MISCONFIGURED_ENDPOINT_WSAA: WSFE client apunta a WSAA. Ver configuración.');
            }
        } else {
            // Si no pudimos leer el endpoint real, al menos validamos que el esperado sea un host WSFE válido
            const isWsfeHost = /wswhomo\.afip\.gov\.ar|servicios1\.afip\.gov\.ar/i.test(expectedHost);
            if (!isWsfeHost) {
                throw new Error('MISCONFIGURED_ENDPOINT_WSFE: Host WSFE esperado no válido.');
            }
        }
    }

    public async getWsfeEndpointForDebug(): Promise<string | undefined> {
        return this.getWsfeEndpointForDebugInternal();
    }

	public get ElectronicBilling() {
		const svc = (this.inner as any).electronicBillingService;
		return {
			getServerStatus: async () => {
                await this.assertWsfeEndpoint();
                const res: any = await svc.getServerStatus();
				return res.FEDummyResult ?? res;
			},
			getLastVoucher: async (ptoVta: number, tipoCbte: number) => {
                await this.assertWsfeEndpoint();
                const res: any = await svc.getLastVoucher(ptoVta, tipoCbte);
				return res.CbteNro ?? res;
			},
			createVoucher: async (req: any) => {
				await this.assertWsfeEndpoint();
				// Ensamblar FECAEReq manualmente para garantizar inclusión de CondicionIVAReceptorId
				const det: any = {
					Concepto: req.Concepto,
					DocTipo: req.DocTipo,
					DocNro: req.DocNro,
					CbteDesde: req.CbteDesde,
					CbteHasta: req.CbteHasta,
					CbteFch: req.CbteFch,
                    FchServDesde: req.FchServDesde,
                    FchServHasta: req.FchServHasta,
                    FchVtoPago: req.FchVtoPago,
					ImpTotConc: req.ImpTotConc,
					ImpNeto: req.ImpNeto,
					ImpOpEx: req.ImpOpEx,
					ImpTrib: req.ImpTrib,
					ImpIVA: req.ImpIVA,
					ImpTotal: req.ImpTotal,
					MonId: req.MonId,
					MonCotiz: req.MonCotiz,
					CondicionIVAReceptorId: req.CondicionIVAReceptorId,
				};
				if (Array.isArray(req.Iva)) det.Iva = { AlicIva: req.Iva };
				if (Array.isArray(req.Tributos)) det.Tributos = { Tributo: req.Tributos };
				if (Array.isArray(req.CbtesAsoc)) det.CbtesAsoc = { CbteAsoc: req.CbtesAsoc };
				if (req.PeriodoAsoc && req.PeriodoAsoc.FchDesde && req.PeriodoAsoc.FchHasta) det.PeriodoAsoc = req.PeriodoAsoc;
				if (Array.isArray(req.Compradores)) det.Compradores = { Comprador: req.Compradores };
				if (Array.isArray(req.Opcionales)) det.Opcionales = { Opcional: req.Opcionales };

				const feReq = {
					FeCAEReq: {
						FeCabReq: {
							CantReg: req.CbteHasta - req.CbteDesde + 1,
							PtoVta: req.PtoVta,
							CbteTipo: req.CbteTipo,
						},
						FeDetReq: {
							FECAEDetRequest: [det]
						}
					}
				};

                const useXmlPatch = String(process.env.AFIP_XML_PATCH || '') === '1' && !this.production;
                let res: any;
                if (useXmlPatch) {
                    // WARNING: Dev-only HOMO patch – inject CondicionIVAReceptorId by building raw SOAP
                    try {
                        const auth = await (svc as any).getWsAuth();
                        const ep = resolveEndpoints(this.production ? 'prod' : 'homo').wsfe;
                        const cuit = (auth?.Auth?.Cuit) || (this as any)?.context?.cuit;
                        const condId = Number(req.CondicionIVAReceptorId);
                        if (!condId || Number.isNaN(condId)) {
                            throw new Error('AFIP_XML_PATCH: CondicionIVAReceptorId ausente');
                        }
                        const soap = `<?xml version="1.0" encoding="utf-8"?>\
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://ar.gov.afip.dif.FEV1/">\
  <soap12:Body>\
    <FECAESolicitar>\
      <Auth><Token>${auth.Auth.Token}</Token><Sign>${auth.Auth.Sign}</Sign><Cuit>${cuit}</Cuit></Auth>\
      <FeCAEReq>\
        <FeCabReq><CantReg>${req.CbteHasta - req.CbteDesde + 1}</CantReg><PtoVta>${req.PtoVta}</PtoVta><CbteTipo>${req.CbteTipo}</CbteTipo></FeCabReq>\
        <FeDetReq>\
          <FECAEDetRequest>\
            <Concepto>${req.Concepto}</Concepto><DocTipo>${req.DocTipo}</DocTipo><DocNro>${req.DocNro}</DocNro>\
            <CbteDesde>${req.CbteDesde}</CbteDesde><CbteHasta>${req.CbteHasta}</CbteHasta><CbteFch>${req.CbteFch}</CbteFch>\
            <ImpTotConc>${req.ImpTotConc}</ImpTotConc><ImpNeto>${req.ImpNeto}</ImpNeto><ImpTrib>${req.ImpTrib}</ImpTrib><ImpIVA>${req.ImpIVA}</ImpIVA><ImpTotal>${req.ImpTotal}</ImpTotal>\
            <MonId>${req.MonId}</MonId><MonCotiz>${req.MonCotiz}</MonCotiz>\
            <CondicionIVAReceptorId>${condId}</CondicionIVAReceptorId>\
            ${Array.isArray(req.Iva) ? `<Iva><AlicIva>${req.Iva.map((x: any)=>`<Id>${x.Id}</Id><BaseImp>${x.BaseImp}</BaseImp><Importe>${x.Importe}</Importe>`).join('')}</AlicIva></Iva>` : ''}\
          </FECAEDetRequest>\
        </FeDetReq>\
      </FeCAEReq>\
    </FECAESolicitar>\
  </soap12:Body>\
</soap12:Envelope>`;
                        // Trace to logs
                        try {
                            const outDir = path.resolve(process.cwd(), 'logs', 'afip', 'homo');
                            fs.mkdirSync(outDir, { recursive: true });
                            fs.writeFileSync(path.join(outDir, 'request.xml'), soap, 'utf8');
                        } catch {}
                        const httpsAgent = new https.Agent({
                            cert: this.certPem,
                            key: this.keyPem,
                            secureOptions: (crypto as any).constants?.SSL_OP_LEGACY_SERVER_CONNECT,
                            minVersion: 'TLSv1.2',
                            ciphers: 'AES128-GCM-SHA256:AES256-GCM-SHA384:@SECLEVEL=1',
                            secureProtocol: 'TLSv1_2_method' as any,
                        });
                        const resp = await axios.post(ep, soap, { headers: { 'Content-Type': 'application/soap+xml; charset=utf-8' }, httpsAgent });
                        try { fs.writeFileSync(path.join(process.cwd(), 'logs', 'afip', 'homo', 'response.xml'), String(resp.data), 'utf8'); } catch {}
                        const parsed = await parseXmlString(String(resp.data));
                        const result = parsed?.['soap:Envelope']?.['soap:Body']?.[0]?.['FECAESolicitarResponse']?.[0]?.['FECAESolicitarResult']?.[0];
                        res = result || {};
                        // Warning patch log
                        try { console.warn('[PATCH] CondicionIVAReceptorId inyectado (HOMO)'); } catch {}
                    } catch (e) {
                        // Fallback to normal path
                        const client = await (svc as any).getClient();
                        const [output] = await client.FECAESolicitarAsync(feReq);
                        res = output?.FECAESolicitarResult ?? output;
                    }
                } else {
                    const client = await (svc as any).getClient();
                    const endpoint = (client as any)?.endpoint || (client as any)?.getEndpoint?.();
                    const auditOn = this.isProdAuditEnabled() && CompatAfip.prodAuditCaptured < this.getProdAuditMax();
                    let rawReqXml: string | undefined;
                    let rawRespXml: string | undefined;
                    let resultOut: any;
                    if (auditOn) {
                        try { (client as any).on && (client as any).on('request', (xml: string) => { rawReqXml = String(xml); }); } catch {}
                    }
                    const resp = await (client as any).FECAESolicitarAsync(feReq);
                    // node-soap returns [result, rawResponse, soapHeader, rawRequest]
                    resultOut = resp?.[0];
                    rawRespXml = resp?.[1];
                    if (!rawReqXml && resp?.[3]) rawReqXml = resp?.[3];
                    res = resultOut?.FECAESolicitarResult ?? resultOut ?? {};
                    if (auditOn) {
                        try {
                            const stamp = Date.now();
                            const n = CompatAfip.prodAuditCaptured;
                            const baseDir = path.resolve(process.cwd(), 'logs', 'afip', 'prod', 'audit', `${stamp}-${String(n).padStart(3, '0')}`);
                            const reqJson = { FeCAEReq: feReq?.FeCAEReq };
                            const summary = this.buildAuditSummary({ FeCAEReq: feReq?.FeCAEReq }, String(endpoint || ''), res);
                            this.writeAuditFiles(baseDir, [
                                { name: 'request.json', content: reqJson },
                                { name: 'request.xml', content: rawReqXml || '', asXml: true },
                                { name: 'response.json', content: res },
                                { name: 'response.xml', content: rawRespXml || '', asXml: true },
                                { name: 'summary.json', content: summary },
                            ]);
                            CompatAfip.prodAuditCaptured++;
                        } catch {}
                    }
                }
				return {
					CAE: res?.FeDetResp?.FECAEDetResponse?.[0]?.CAE,
					CAEFchVto: res?.FeDetResp?.FECAEDetResponse?.[0]?.CAEFchVto,
					Observaciones: res?.FeDetResp?.FECAEDetResponse?.[0]?.Observaciones?.Obs ?? undefined,
					response: res
				};
			},
			getVoucherTypes: async () => {
                await this.assertWsfeEndpoint();
                const r: any = await svc.getVoucherTypes();
				return r.ResultGet?.CbteTipo ?? r;
			},
			getConceptTypes: async () => {
                await this.assertWsfeEndpoint();
                const r: any = await svc.getConceptTypes();
				return r.ResultGet?.ConceptoTipo ?? r;
			},
			getDocumentTypes: async () => {
                await this.assertWsfeEndpoint();
                const r: any = await svc.getDocumentTypes();
				return r.ResultGet?.DocTipo ?? r;
			},
			getCurrenciesTypes: async () => {
                await this.assertWsfeEndpoint();
                const r: any = await svc.getCurrenciesTypes();
				return r.ResultGet?.Moneda ?? r;
			},
			getSalesPoints: async () => {
                await this.assertWsfeEndpoint();
                const r: any = await svc.getSalesPoints();
				return r.ResultGet?.PtoVenta ?? r;
			},
            getCondicionIvaReceptor: async () => {
                // Intentar métodos conocidos; si no, caer a client directo
                const anySvc: any = svc as any;
                await this.assertWsfeEndpoint();
                if (typeof anySvc.getParamGetCondicionIvaReceptor === 'function') {
                    const r = await anySvc.getParamGetCondicionIvaReceptor({});
                    return r;
                }
                try {
                    const client = await (svc as any).getClient();
                    if (typeof client.FEParamGetCondicionIvaReceptorAsync === 'function') {
                        const [output] = await client.FEParamGetCondicionIvaReceptorAsync({});
                        return output?.FEParamGetCondicionIvaReceptorResult ?? output;
                    }
                } catch {}
                throw new Error('getCondicionIvaReceptor no disponible en SDK');
            },
			getCurrencyQuotation: async (monId: string) => {
				const anySvc: any = svc as any;
				if (typeof anySvc.getCurrencyQuotation === 'function') {
                    await this.assertWsfeEndpoint();
					return anySvc.getCurrencyQuotation(monId);
				}
				if (typeof anySvc.getParamGetCotizacion === 'function') {
                    await this.assertWsfeEndpoint();
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
			},
			consultarObligadoRecepcion: async (cuitReceptor: number) => {
				const r: any = await svc.consultarObligadoRecepcion(cuitReceptor);
				return r;
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
