import fs from 'fs';
import path from 'path';

export interface ReceptorHint {
	docTipo: number;
	docNro: number;
	categoria?: 'RI' | 'MT' | 'CF' | 'EX';
}

function getCachePath(): string {
	try {
		const base = process.env.APPDATA || process.env.LOCALAPPDATA || process.cwd();
		const dir = path.resolve(String(base), 'Tc-Mp', 'afip', 'homo');
		try { fs.mkdirSync(dir, { recursive: true }); } catch {}
		return path.join(dir, 'condIvaReceptor.json');
	} catch {
		return path.resolve(process.cwd(), 'condIvaReceptor.json');
	}
}

function loadCache(): any | null {
	try {
		const p = getCachePath();
		if (!fs.existsSync(p)) return null;
		const raw = fs.readFileSync(p, 'utf8');
		return JSON.parse(raw);
	} catch { return null; }
}

function saveCache(data: any): void {
	try {
		fs.writeFileSync(getCachePath(), JSON.stringify({ savedAt: Date.now(), data }, null, 2), 'utf8');
	} catch {}
}

export async function getCondicionIvaReceptorId({ afip, cbteTipo, receptorHint }: { afip: any; cbteTipo: number; receptorHint: ReceptorHint }): Promise<number> {
	// Cache 24h
	const cache = loadCache();
	const now = Date.now();
	let lista: any[] | null = null;
	if (cache && cache.savedAt && Array.isArray(cache.data) && (now - cache.savedAt) < 24 * 60 * 60 * 1000) {
		lista = cache.data;
	}
	if (!lista) {
		const raw = await afip.ElectronicBilling.getCondicionIvaReceptor();
		// Normalizar posibles formas (AFIP suele usar ResultGet.Item)
		const items = Array.isArray(raw)
			? raw
			: Array.isArray(raw?.Item)
				? raw.Item
				: Array.isArray(raw?.ResultGet?.Item)
					? raw.ResultGet.Item
					: Array.isArray(raw?.FEParamGetCondicionIvaReceptorResult?.ResultGet?.Item)
						? raw.FEParamGetCondicionIvaReceptorResult.ResultGet.Item
						: [];
		lista = items;
		saveCache(lista);
	}

	// Regla de selección por categoría
	const categoria = receptorHint?.categoria || ((receptorHint?.docTipo === 99 && Number(receptorHint?.docNro || 0) === 0) ? 'CF' : undefined);
	const pick = (needle: RegExp) => {
		const item = (lista || []).find((x: any) => needle.test(String(x?.Desc || x?.desc || '')));
		return item ? Number(item?.Id || item?.id) : undefined;
	};

	let id: number | undefined;
	if (categoria === 'CF') id = pick(/consumidor\s*final/i);
	else if (categoria === 'RI') id = pick(/(inscripto|responsable\s+inscripto)/i);
	else if (categoria === 'MT') id = pick(/(monotribut)/i);
	else if (categoria === 'EX') id = pick(/exento/i);

	if (!id) {
		throw new Error('COND_IVA_RECEPTOR_ID_NOT_FOUND');
	}
	return id;
}


