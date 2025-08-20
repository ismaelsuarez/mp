import { DatosAFIP, Comprobante, TipoComprobante } from './types';
import dayjs from 'dayjs';
import { getDb } from '../../services/DbService';

// Carga diferida del SDK para evitar crash si falta
function loadAfip() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('afip.js');
  } catch (e) {
    throw new Error('SDK AFIP no instalado. Instala "afip.js" o indica el SDK a usar.');
  }
}

function mapTipoCbte(tipo: TipoComprobante): number {
  switch (tipo) {
    case 'FA': return 1; // Factura A
    case 'FB': return 6; // Factura B
    case 'NC': return 3; // Nota de Crédito A (simplificado)
    case 'RECIBO': return 4; // Recibo A (referencia; ajustar según uso)
    default: return 6;
  }
}

export async function solicitarCAE(comprobante: Comprobante): Promise<DatosAFIP> {
  const cfg = getDb().getAfipConfig();
  if (!cfg) throw new Error('Falta configurar AFIP en Administración');
  const Afip = loadAfip();
  const afip = new Afip({ CUIT: Number(cfg.cuit), production: cfg.entorno === 'produccion', cert: cfg.cert_path, key: cfg.key_path });

  const ptoVta = cfg.pto_vta || comprobante.puntoVenta;
  const tipoCbte = mapTipoCbte(comprobante.tipo);
  const last = await afip.ElectronicBilling.getLastVoucher(ptoVta, tipoCbte);
  const numero = Number(last) + 1;

  const neto = comprobante.totales.neto;
  const iva = comprobante.totales.iva;
  const total = comprobante.totales.total;

  const ivaArray = [] as any[];
  const mapId = (p: number) => (p === 10.5 ? 4 : p === 27 ? 6 : 5);
  // Sumar bases por alícuota
  const bases = new Map<number, number>();
  for (const it of comprobante.items) {
    const base = it.cantidad * it.precioUnitario;
    bases.set(it.iva, (bases.get(it.iva) || 0) + base);
  }
  for (const [alic, base] of bases) {
    ivaArray.push({ Id: mapId(alic), BaseImp: base, Importe: (base * alic) / 100 });
  }

  const req = {
    CantReg: 1,
    PtoVta: ptoVta,
    CbteTipo: tipoCbte,
    Concepto: 1,
    DocTipo: 99,
    DocNro: 0,
    CbteDesde: numero,
    CbteHasta: numero,
    CbteFch: comprobante.fecha,
    ImpTotal: total,
    ImpTotConc: 0,
    ImpNeto: neto,
    ImpOpEx: 0,
    ImpIVA: iva,
    ImpTrib: 0,
    MonId: 'PES',
    MonCotiz: 1,
    Iva: ivaArray
  };

  try {
    const res = await afip.ElectronicBilling.createVoucher(req);
    const cae: string = res.CAE;
    const caeVto: string = res.CAEFchVto;

    const qrData = buildQrUrl({
      ver: 1,
      fecha: dayjs(comprobante.fecha, 'YYYYMMDD').format('YYYY-MM-DD'),
      cuit: Number(cfg.cuit),
      ptoVta,
      tipoCmp: tipoCbte,
      nroCmp: numero,
      importe: Number(total.toFixed(2)),
      moneda: 'PES',
      ctz: 1,
      tipoDocRec: 99,
      nroDocRec: 0,
      tipoCodAut: 'E',
      codAut: Number(cae)
    });

    return { cae, vencimientoCAE: caeVto, qrData };
  } catch (e: any) {
    const msg = e?.message || 'AFIP rechazó la solicitud de CAE';
    throw new Error(String(msg));
  }
}

function buildQrUrl(data: any): string {
  const base = 'https://www.afip.gob.ar/fe/qr/?p=';
  const payload = Buffer.from(JSON.stringify(data)).toString('base64');
  return base + payload;
}


