import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { app } from 'electron';
import { getOutDir } from '../../apps/electron/src/services/ReportService';
import { DBFFile } from 'dbffile';
import { sendMpDbf } from './FtpService';

// Carga datos de A13 usando el servicio padron.ts
export async function fetchPadron13Data(cuit: number): Promise<any> {
  const mod = require('../modules/facturacion/padron');
  const res = await mod.consultarPadronAlcance13(Number(cuit));
  return res;
}

function safeString(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

// Extraer/normalizar principales campos del response A13
export function normalizeA13(persona: any, cuit: number) {
  // Algunas implementaciones de A13 retornan { persona: { ... } }
  const p = (persona && typeof persona === 'object' && 'persona' in persona) ? (persona as any).persona : persona;
  const idPersona = p?.idPersona ?? persona?.idPersona ?? null;
  const tipoPersona = p?.tipoPersona ?? persona?.tipoPersona ?? '';
  const tipoClave = p?.tipoClave ?? persona?.tipoClave ?? '';
  const estadoClave = p?.estadoClave ?? persona?.estadoClave ?? '';
  const nombre = p?.nombre ?? persona?.nombre ?? '';
  const apellido = p?.apellido ?? persona?.apellido ?? '';
  const razonSocial = p?.razonSocial ?? persona?.razonSocial ?? '';
  const nombreFantasia = p?.nombreFantasia ?? persona?.nombreFantasia ?? '';
  const fechaNacimiento = p?.fechaNacimiento ?? persona?.fechaNacimiento ?? '';
  const fechaFallecimiento = p?.fechaFallecimiento ?? persona?.fechaFallecimiento ?? '';
  const fechaInscripcion = p?.fechaInscripcion ?? persona?.fechaInscripcion ?? '';
  const fechaContratoSocial = p?.fechaContratoSocial ?? persona?.fechaContratoSocial ?? '';
  const mesCierre = p?.mesCierre ?? persona?.mesCierre ?? '';
  const tipoDocumento = p?.tipoDocumento ?? persona?.tipoDocumento ?? '';
  const numeroDocumento = p?.numeroDocumento ?? persona?.numeroDocumento ?? '';
  const formaJuridica = p?.formaJuridica ?? persona?.formaJuridica ?? '';
  const idActividadPrincipal = p?.idActividadPrincipal ?? persona?.idActividadPrincipal ?? '';
  const descActividadPrincipal = p?.descripcionActividadPrincipal ?? persona?.descripcionActividadPrincipal ?? '';
  // Domicilio: preferir domicilioFiscal si existe; si no, tomar el primer elemento de 'domicilio'
  const domicilioLista = Array.isArray(p?.domicilio) ? p?.domicilio : [];
  const domicilio = p?.domicilioFiscal || persona?.domicilioFiscal || domicilioLista?.[0] || {};
  const domCalle = domicilio?.direccion ?? domicilio?.calle ?? '';
  const domNumero = domicilio?.numero ?? '';
  const domLocalidad = domicilio?.localidad ?? '';
  const domProvincia = domicilio?.descripcionProvincia ?? domicilio?.provincia ?? '';
  const domProvId = domicilio?.idProvincia ?? '';
  const domTipo = domicilio?.tipoDomicilio ?? '';
  const domTipoDatoAd = domicilio?.tipoDatoAdicional ?? '';
  const domDatoAd = domicilio?.datoAdicional ?? '';
  const domCP = domicilio?.codPostal ?? domicilio?.codigoPostal ?? '';
  const domEstado = domicilio?.estadoDomicilio ?? '';

  // Domicilios específicos por tipo
  const domFiscal = domicilioLista.find((d: any) => (d?.tipoDomicilio || '').toUpperCase() === 'FISCAL') || null;
  const domLegal = domicilioLista.find((d: any) => (d?.tipoDomicilio || '').toUpperCase() === 'LEGAL/REAL') || null;
  const FISC_CALLE = domFiscal?.direccion ?? domFiscal?.calle ?? '';
  const FISC_NUM = domFiscal?.numero ?? '';
  const FISC_LOC = domFiscal?.localidad ?? '';
  const FISC_PROV = domFiscal?.descripcionProvincia ?? domFiscal?.provincia ?? '';
  const FISC_PROV_ID = domFiscal?.idProvincia ?? null;
  const FISC_CP = domFiscal?.codPostal ?? domFiscal?.codigoPostal ?? '';
  const FISC_ESTADO = domFiscal?.estadoDomicilio ?? '';
  const LEG_CALLE = domLegal?.direccion ?? domLegal?.calle ?? '';
  const LEG_NUM = domLegal?.numero ?? '';
  const LEG_LOC = domLegal?.localidad ?? '';
  const LEG_PROV = domLegal?.descripcionProvincia ?? domLegal?.provincia ?? '';
  const LEG_PROV_ID = domLegal?.idProvincia ?? null;
  const LEG_CP = domLegal?.codPostal ?? domLegal?.codigoPostal ?? '';
  const LEG_ESTADO = domLegal?.estadoDomicilio ?? '';
  const impSrc = p?.impuestos ?? persona?.impuestos;
  const actSrc = p?.actividades ?? persona?.actividades;
  const carSrc = p?.caracterizaciones ?? persona?.caracterizaciones;
  const impuestos = Array.isArray(impSrc) ? impSrc.map((x: any) => x?.idImpuesto ?? x?.id ?? '').filter(Boolean).join(';') : '';
  const actividades = Array.isArray(actSrc) ? actSrc.map((x: any) => x?.idActividad ?? x?.id ?? '').filter(Boolean).join(';') : '';
  const caracterizaciones = Array.isArray(carSrc) ? carSrc.map((x: any) => x?.idCaracterizacion ?? x?.id ?? '').filter(Boolean).join(';') : '';
  const clavesInactivas = Array.isArray(p?.claveInactivaAsociada) ? p.claveInactivaAsociada.filter(Boolean).join(';') : '';
  const periodoActPrin = p?.periodoActividadPrincipal ?? persona?.periodoActividadPrincipal ?? '';

  // Metadata (si estuviera presente en el response)
  const metadata = (persona && typeof persona === 'object' && 'metadata' in persona) ? (persona as any).metadata : (p?.metadata || {});
  const metFecha = metadata?.fechaHora ?? '';
  const metHost = metadata?.servidor ?? '';

  return {
    CUIT: String(cuit),
    IDPERSONA: idPersona ? Number(idPersona) : null,
    TIPO: safeString(tipoPersona),
    TIPOCLAVE: safeString(tipoClave),
    ESTADOCL: safeString(estadoClave),
    NOMBRE: safeString(nombre),
    APELLIDO: safeString(apellido),
    RAZONSOC: safeString(razonSocial),
    FANTASIA: safeString(nombreFantasia),
    NACIM: safeString(fechaNacimiento),
    FALLEC: safeString(fechaFallecimiento),
    FECINS: safeString(fechaInscripcion),
    CONTRSOC: safeString(fechaContratoSocial),
    MESCIERRE: safeString(mesCierre),
    DOC_T: safeString(tipoDocumento),
    DOC_N: safeString(numeroDocumento),
    FORMAJUR: safeString(formaJuridica),
    ACT_PRIN: safeString(idActividadPrincipal),
    ACT_DESC: safeString(descActividadPrincipal),
    DOM_CALLE: safeString(domCalle),
    DOM_NUM: safeString(domNumero),
    DOM_LOC: safeString(domLocalidad),
    DOM_PROV: safeString(domProvincia),
    PROV_ID: domProvId ? Number(domProvId) : null,
    TIPO_DOM: safeString(domTipo),
    TIPO_DA: safeString(domTipoDatoAd),
    DATO_AD: safeString(domDatoAd),
    DOM_CP: safeString(domCP),
    DOM_EST: safeString(domEstado),
    // Domicilios separados
    FISC_CALLE: safeString(FISC_CALLE),
    FISC_NUM: safeString(FISC_NUM),
    FISC_LOC: safeString(FISC_LOC),
    FISC_PROV: safeString(FISC_PROV),
    FISC_PROV_ID: FISC_PROV_ID ? Number(FISC_PROV_ID) : null,
    FISC_CP: safeString(FISC_CP),
    FISC_EST: safeString(FISC_ESTADO),
    LEG_CALLE: safeString(LEG_CALLE),
    LEG_NUM: safeString(LEG_NUM),
    LEG_LOC: safeString(LEG_LOC),
    LEG_PROV: safeString(LEG_PROV),
    LEG_PROV_ID: LEG_PROV_ID ? Number(LEG_PROV_ID) : null,
    LEG_CP: safeString(LEG_CP),
    LEG_EST: safeString(LEG_ESTADO),
    IMPUESTOS: safeString(impuestos),
    ACTIVIDADES: safeString(actividades),
    CARACT: safeString(caracterizaciones),
    CLAV_INAC: safeString(clavesInactivas),
    PERI_ACT: safeString(periodoActPrin),
    MET_FECHA: safeString(metFecha),
    MET_HOST: safeString(metHost)
  };
}

export async function writeA13CsvAndDbf(cuit: number, persona: any, baseName?: string) {
  const row = normalizeA13(persona, cuit);
  // Dejar CSV/DBF junto a los reportes (como Mercado Pago)
  const base = getOutDir();
  const outDir = path.join(base, 'A13');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch {}
  const bn = String(baseName && baseName.trim() ? baseName : 'a13').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const csvPath = path.join(outDir, `${bn}.csv`);
  const dbfPath = path.join(outDir, `${bn}.dbf`);
  const rawPath = path.join(outDir, `${bn}.raw.json`);
  const csvFullPath = path.join(outDir, `${bn}_full.csv`);

  // CSV simple con encabezados fijos
  const headers = Object.keys(row);
  const csv = headers.join(',') + '\n' + headers.map(h => JSON.stringify((row as any)[h] ?? '')).join(',') + '\n';
  fs.writeFileSync(csvPath, csv, 'utf8');
  try { fs.writeFileSync(rawPath, JSON.stringify(persona, null, 2), 'utf8'); } catch {}

  // CSV completo aplanado (todos los campos que vengan)
  const flatten = (obj: any, prefix = '', acc: any = {}) => {
    if (obj === null || obj === undefined) return acc;
    if (Array.isArray(obj)) { acc[prefix.replace(/\.$/, '')] = JSON.stringify(obj); return acc; }
    if (typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) {
        const next = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object') (flatten as any)(v, next, acc); else (acc as any)[next] = v as any;
      }
      return acc;
    }
    (acc as any)[prefix.replace(/\.$/, '')] = obj; return acc;
  };
  const flat = flatten(persona || {});
  const fullHeaders = Object.keys(flat);
  const fullCsv = fullHeaders.join(',') + '\n' + fullHeaders.map(h => JSON.stringify((flat as any)[h] ?? '')).join(',') + '\n';
  fs.writeFileSync(csvFullPath, fullCsv, 'utf8');

  // DBF con campos de texto (C) y uno numérico para IDPERSONA
  try { if (fs.existsSync(dbfPath)) fs.unlinkSync(dbfPath); } catch {}
  const fields = [
    { name: 'CUIT', type: 'C', size: 11 },
    { name: 'IDPERSONA', type: 'N', size: 12, decs: 0 },
    { name: 'TIPO', type: 'C', size: 10 },
    { name: 'TIPOCLAVE', type: 'C', size: 12 },
    { name: 'ESTADOCL', type: 'C', size: 12 },
    { name: 'NOMBRE', type: 'C', size: 50 },
    { name: 'APELLIDO', type: 'C', size: 50 },
    { name: 'RAZONSOC', type: 'C', size: 80 },
    { name: 'FANTASIA', type: 'C', size: 80 },
    { name: 'NACIM', type: 'C', size: 10 },
    { name: 'FALLEC', type: 'C', size: 10 },
    { name: 'FECINS', type: 'C', size: 10 },
    { name: 'CONTRSOC', type: 'C', size: 10 },
    { name: 'MESCIERRE', type: 'C', size: 6 },
    { name: 'DOC_T', type: 'C', size: 8 },
    { name: 'DOC_N', type: 'C', size: 20 },
    { name: 'FORMAJUR', type: 'C', size: 40 },
    { name: 'ACT_PRIN', type: 'C', size: 12 },
    { name: 'ACT_DESC', type: 'C', size: 80 },
    { name: 'DOM_CALLE', type: 'C', size: 100 },
    { name: 'DOM_NUM', type: 'C', size: 10 },
    { name: 'DOM_LOC', type: 'C', size: 60 },
    { name: 'DOM_PROV', type: 'C', size: 40 },
    { name: 'PROV_ID', type: 'N', size: 4, decs: 0 },
    { name: 'TIPO_DOM', type: 'C', size: 20 },
    { name: 'TIPO_DA', type: 'C', size: 20 },
    { name: 'DATO_AD', type: 'C', size: 60 },
    { name: 'DOM_CP', type: 'C', size: 10 },
    { name: 'DOM_EST', type: 'C', size: 20 },
    // Domicilios específicos
    { name: 'FISC_CALLE', type: 'C', size: 100 },
    { name: 'FISC_NUM', type: 'C', size: 10 },
    { name: 'FISC_LOC', type: 'C', size: 60 },
    { name: 'FISC_PROV', type: 'C', size: 40 },
    { name: 'FISC_PV_ID', type: 'N', size: 4, decs: 0 },
    { name: 'FISC_CP', type: 'C', size: 10 },
    { name: 'FISC_EST', type: 'C', size: 20 },
    { name: 'LEG_CALLE', type: 'C', size: 100 },
    { name: 'LEG_NUM', type: 'C', size: 10 },
    { name: 'LEG_LOC', type: 'C', size: 60 },
    { name: 'LEG_PROV', type: 'C', size: 40 },
    { name: 'LEG_PV_ID', type: 'N', size: 4, decs: 0 },
    { name: 'LEG_CP', type: 'C', size: 10 },
    { name: 'LEG_EST', type: 'C', size: 20 },
    { name: 'IMPUESTOS', type: 'C', size: 200 },
    { name: 'ACTIVIDAD', type: 'C', size: 200 },
    { name: 'CARACT', type: 'C', size: 200 },
    { name: 'CLAV_INAC', type: 'C', size: 200 },
    { name: 'PERI_ACT', type: 'C', size: 6 },
    { name: 'MET_FECHA', type: 'C', size: 19 },
    { name: 'MET_HOST', type: 'C', size: 40 }
  ] as any[];
  const dbf = await DBFFile.create(dbfPath, fields as any);
  await dbf.appendRecords([
    {
      CUIT: row.CUIT,
      IDPERSONA: row.IDPERSONA ?? 0,
      TIPO: row.TIPO,
      TIPOCLAVE: row.TIPOCLAVE,
      ESTADOCL: row.ESTADOCL,
      NOMBRE: row.NOMBRE,
      APELLIDO: row.APELLIDO,
      RAZONSOC: row.RAZONSOC,
      FANTASIA: row.FANTASIA,
      NACIM: row.NACIM,
      FALLEC: row.FALLEC,
      FECINS: row.FECINS,
      CONTRSOC: row.CONTRSOC,
      MESCIERRE: row.MESCIERRE,
      DOC_T: row.DOC_T,
      DOC_N: row.DOC_N,
      FORMAJUR: row.FORMAJUR,
      ACT_PRIN: row.ACT_PRIN,
      ACT_DESC: row.ACT_DESC,
      DOM_CALLE: row.DOM_CALLE,
      DOM_NUM: row.DOM_NUM,
      DOM_LOC: row.DOM_LOC,
      DOM_PROV: row.DOM_PROV,
      PROV_ID: row.PROV_ID ?? 0,
      TIPO_DOM: row.TIPO_DOM,
      TIPO_DA: row.TIPO_DA,
      DATO_AD: row.DATO_AD,
      DOM_CP: row.DOM_CP,
      DOM_EST: row.DOM_EST,
      FISC_CALLE: row.FISC_CALLE,
      FISC_NUM: row.FISC_NUM,
      FISC_LOC: row.FISC_LOC,
      FISC_PROV: row.FISC_PROV,
      FISC_PV_ID: row.FISC_PROV_ID ?? 0,
      FISC_CP: row.FISC_CP,
      FISC_EST: row.FISC_EST,
      LEG_CALLE: row.LEG_CALLE,
      LEG_NUM: row.LEG_NUM,
      LEG_LOC: row.LEG_LOC,
      LEG_PROV: row.LEG_PROV,
      LEG_PV_ID: row.LEG_PROV_ID ?? 0,
      LEG_CP: row.LEG_CP,
      LEG_EST: row.LEG_EST,
      IMPUESTOS: row.IMPUESTOS,
      ACTIVIDAD: row.ACTIVIDADES,
      CARACT: row.CARACT,
      CLAV_INAC: row.CLAV_INAC,
      PERI_ACT: row.PERI_ACT,
      MET_FECHA: row.MET_FECHA,
      MET_HOST: row.MET_HOST
    } as any
  ]);

  return { outDir, csvPath, dbfPath, rawPath, csvFullPath, baseName: bn };
}

export async function processA13TriggerFile(controlPath: string) {
  // Lee CUIT de primera línea
  const raw = fs.readFileSync(controlPath, 'utf8');
  const firstLine = (raw.split(/\r?\n/)[0] || '').trim();
  const cuit = Number(firstLine.replace(/\D/g, ''));
  if (!cuit || String(cuit).length < 11) throw new Error('CUIT inválido en a13.txt');

  // Basename según archivo entrante (p.ej. a13_1252.txt -> a13_1252)
  const inBase = path.basename(controlPath).replace(/\.[^.]+$/, '');
  const baseName = /^a13/i.test(inBase) ? inBase : `a13_${inBase}`;

  const persona = await fetchPadron13Data(cuit);
  const files = await writeA13CsvAndDbf(cuit, persona, baseName);

  // Enviar solo DBF por FTP usando la configuración de FTP Mercado Pago
  // Importante: enviar exactamente el archivo generado (no mp.dbf)
  try { await sendMpDbf(files.dbfPath, `${files.baseName}.dbf`, { force: true }); } catch {}

  return files;
}

// Limpieza de archivos A13 antiguos (default: >1 día)
export function cleanupOldA13Reports(maxAgeDays: number = 1) {
  try {
    const base = getOutDir();
    const outDir = path.join(base, 'A13');
    if (!fs.existsSync(outDir)) return { ok: false, reason: 'no_dir' };
    const now = Date.now();
    const maxAgeMs = Math.max(1, maxAgeDays) * 24 * 60 * 60 * 1000;
    const entries = fs.readdirSync(outDir);
    let deleted = 0;
    for (const name of entries) {
      if (!/^a13/i.test(name)) continue;
      const full = path.join(outDir, name);
      try {
        const st = fs.statSync(full);
        if (now - st.mtimeMs > maxAgeMs) {
          try { fs.unlinkSync(full); deleted += 1; } catch {}
        }
      } catch {}
    }
    return { ok: true, deleted };
  } catch {
    return { ok: false };
  }
}


