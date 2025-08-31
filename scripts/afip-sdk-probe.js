/*
  Uso:
    node scripts/afip-sdk-probe.js --entorno=homologacion|produccion --cuit=CUIT --pto=PV --cert="C:\\ruta\\cert.crt" --key="C:\\ruta\\key.key" [--mem=true]
*/

const fs = require('fs');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (const a of args) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function loadAfip() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('@afipsdk/afip.js');
  } catch (e) {
    console.error('No se pudo cargar @afipsdk/afip.js');
    process.exit(1);
  }
}

async function main() {
  const { entorno, cuit, pto, cert, key, mem } = parseArgs();
  if (!entorno || !cuit || !pto || !cert || !key) {
    console.error('Args requeridos: --entorno= --cuit= --pto= --cert= --key= [--mem=true]');
    process.exit(1);
  }

  const production = String(entorno).toLowerCase() === 'produccion';

  const Afip = loadAfip();
  let certArg = cert;
  let keyArg = key;
  if (String(mem).toLowerCase() === 'true') {
    certArg = fs.readFileSync(cert, 'utf8');
    keyArg = fs.readFileSync(key, 'utf8');
  }

  const afip = new Afip({ CUIT: Number(cuit), production, cert: certArg, key: keyArg });

  console.log('➡️  Entorno:', production ? 'PROD' : 'HOMO');
  console.log('➡️  CUIT:', cuit, 'PV:', Number(pto));

  try {
    const status = await afip.ElectronicBilling.getServerStatus();
    console.log('ServerStatus:', status);
  } catch (e) {
    console.error('ServerStatus ERROR:', e?.message || e);
  }

  try {
    const eb = afip.ElectronicBilling;
    const getPvs = eb.getSalesPoints || eb.getPointsOfSales;
    const pvs = typeof getPvs === 'function' ? await getPvs.call(eb) : null;
    console.log('Puntos de venta:', pvs);
  } catch (e) {
    console.error('Puntos de venta ERROR:', e?.message || e);
  }

  try {
    const tipos = await afip.ElectronicBilling.getVoucherTypes();
    console.log('Tipos de comprobante:', Array.isArray(tipos) ? tipos.map(t => t.Id) : tipos);
  } catch (e) {
    console.error('getVoucherTypes ERROR:', e?.message || e);
  }

  try {
    const conceptos = await afip.ElectronicBilling.getConceptTypes();
    console.log('Conceptos:', conceptos);
  } catch (e) {
    console.error('getConceptTypes ERROR:', e?.message || e);
  }

  try {
    const docs = await afip.ElectronicBilling.getDocumentTypes();
    console.log('Tipos de documento:', docs);
  } catch (e) {
    console.error('getDocumentTypes ERROR:', e?.message || e);
  }

  try {
    const mons = await afip.ElectronicBilling.getCurrenciesTypes();
    console.log('Monedas:', mons);
  } catch (e) {
    console.error('getCurrenciesTypes ERROR:', e?.message || e);
  }

  try {
    const last = await afip.ElectronicBilling.getLastVoucher(Number(pto), 11);
    console.log('Ultimo comprobante C:', last);
  } catch (e) {
    console.error('getLastVoucher ERROR:', e?.message || e);
  }
}

main().catch(e => {
  console.error('Fatal:', e?.message || e);
  process.exit(1);
});


