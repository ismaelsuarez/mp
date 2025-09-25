export function yyyymmdd(date: Date = new Date()): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${y}${m}${d}`;
}

export interface FacturaBKnownGoodParams {
	nextNro: number;
	pv?: number;
	hoy?: string;
	receptorHint?: { docTipo: number; docNro: number; categoria?: 'RI'|'MT'|'CF'|'EX' };
}

/**
 * Construye un payload "known-good" para Factura B en HOMO (estructura FECAEReq)
 */
export function buildFacturaBKnownGoodFECAEReq({ nextNro, pv = 1, hoy = yyyymmdd() }: FacturaBKnownGoodParams) {
	return {
		FeCabReq: { CantReg: 1, PtoVta: Number(pv), CbteTipo: 6 },
		FeDetReq: [
			{
				Concepto: 1,
				DocTipo: 99,
				DocNro: 0,
				CbteDesde: Number(nextNro),
				CbteHasta: Number(nextNro),
				CbteFch: String(hoy),
				ImpTotConc: 0.0,
				ImpNeto: 100.0,
				ImpOpEx: 0.0,
				ImpTrib: 0.0,
				ImpIVA: 21.0,
				ImpTotal: 121.0,
				MonId: 'PES',
				MonCotiz: 1.0,
				Iva: { AlicIva: [{ Id: 5, BaseImp: 100.0, Importe: 21.0 }] }
			}
		]
	};
}

/**
 * Conversión a forma plana (IVoucher) compatible con SDK local
 */
export function flattenIVoucherFromFECAEReq(req: any) {
	const cab = req?.FeCabReq || {};
	const det = (req?.FeDetReq && req.FeDetReq[0]) || {};
	const ivaArr = Array.isArray(det?.Iva?.AlicIva) ? det.Iva.AlicIva : [];
	return {
		PtoVta: Number(cab.PtoVta),
		CbteTipo: Number(cab.CbteTipo),
		Concepto: Number(det.Concepto),
		DocTipo: Number(det.DocTipo),
		DocNro: Number(det.DocNro),
		CbteDesde: Number(det.CbteDesde),
		CbteHasta: Number(det.CbteHasta),
		CbteFch: String(det.CbteFch),
		ImpTotConc: Number(det.ImpTotConc),
		ImpNeto: Number(det.ImpNeto),
		ImpOpEx: Number(det.ImpOpEx),
		ImpTrib: Number(det.ImpTrib),
		ImpIVA: Number(det.ImpIVA),
		ImpTotal: Number(det.ImpTotal),
		MonId: String(det.MonId),
		MonCotiz: Number(det.MonCotiz),
		CondicionIVAReceptorId: det?.CondicionIVAReceptorId !== undefined ? Number(det.CondicionIVAReceptorId) : undefined,
		Iva: ivaArr.map((x: any) => ({ Id: Number(x.Id), BaseImp: Number(x.BaseImp), Importe: Number(x.Importe) }))
	};
}

/**
 * Valida que los montos cierren a dos decimales: total == neto + iva + trib + conc + exento
 */
export function assertMontosFECAEReq(req: any): void {
	const d = (req?.FeDetReq && req.FeDetReq[0]) || {};
	const to2 = (n: any) => Number(Number(n || 0).toFixed(2));
	const suma = to2(d.ImpNeto) + to2(d.ImpIVA) + to2(d.ImpTrib) + to2(d.ImpTotConc) + to2(d.ImpOpEx);
	if (to2(d.ImpTotal) !== to2(suma)) {
		throw new Error(`Montos no cierran: total=${to2(d.ImpTotal)} vs suma=${to2(suma)}`);
	}
}

export function assertFacturaBRequest(req: any): void {
	const cab = req?.FeCabReq || {};
	const det = (req?.FeDetReq && req.FeDetReq[0]) || {};
	const missing: string[] = [];
	if (!cab?.CantReg) missing.push('FeCabReq.CantReg');
	if (![1, 6].includes(Number(cab?.CbteTipo))) missing.push('FeCabReq.CbteTipo(esperado=6)');
	if (!cab?.PtoVta) missing.push('FeCabReq.PtoVta');
	if (Number(det?.Concepto) !== 1) missing.push('FeDetReq[0].Concepto(=1)');
	if (Number(det?.DocTipo) !== 99) missing.push('FeDetReq[0].DocTipo(=99)');
	if (det?.DocNro === undefined || det?.DocNro === null) missing.push('FeDetReq[0].DocNro(=0)');
	['CbteDesde','CbteHasta','CbteFch','MonId','MonCotiz','ImpTotConc','ImpNeto','ImpOpEx','ImpTrib','ImpIVA','ImpTotal']
		.forEach((k) => { if (det?.[k] === undefined) missing.push(`FeDetReq[0].${k}`); });
	const iva = det?.Iva?.AlicIva?.[0];
	if (!iva?.Id || iva?.BaseImp === undefined || iva?.Importe === undefined) {
		missing.push('FeDetReq[0].Iva.AlicIva[0].{Id,BaseImp,Importe}');
	}
	if (missing.length) throw new Error('AFIP HOMO: request incompleto → ' + missing.join(', '));
}

// Compat: versión plana para usos existentes (convierte el FECAEReq generado)
export function buildFacturaBKnownGood(params: FacturaBKnownGoodParams) {
	const fe = buildFacturaBKnownGoodFECAEReq(params);
	return flattenIVoucherFromFECAEReq(fe);
}

// Async: construye IVoucher incluyendo CondicionIVAReceptorId a partir del catálogo
export async function buildFacturaBKnownGoodAsync(afip: any, params: FacturaBKnownGoodParams & { receptorHint?: { docTipo: number; docNro: number; categoria?: 'RI'|'MT'|'CF'|'EX' } }) {
	const fe = buildFacturaBKnownGoodFECAEReq(params);
	const { getCondicionIvaReceptorId } = await import('./catalogs');
	const condId = await getCondicionIvaReceptorId({ afip, cbteTipo: 6, receptorHint: params.receptorHint || { docTipo: 99, docNro: 0, categoria: 'CF' } });
	(fe as any).FeDetReq[0].CondicionIVAReceptorId = condId;
	return flattenIVoucherFromFECAEReq(fe);
}

export function assertTieneCondIvaFlat(req: any): void {
	const id = req?.CondicionIVAReceptorId;
	if (typeof id !== 'number' || Number.isNaN(id)) {
		throw new Error('AFIP HOMO: falta CondicionIVAReceptorId en request (forma plana)');
	}
}

// Compat: validación plana en caso de usar forma IVoucher
export function assertMontos(req: any): void {
	const to2 = (n: any) => Number(Number(n || 0).toFixed(2));
	const suma = to2(req?.ImpNeto) + to2(req?.ImpIVA) + to2(req?.ImpTrib) + to2(req?.ImpTotConc) + to2(req?.ImpOpEx);
	if (to2(req?.ImpTotal) !== to2(suma)) {
		throw new Error(`Montos no cierran: total=${to2(req?.ImpTotal)} vs suma=${to2(suma)}`);
	}
}


