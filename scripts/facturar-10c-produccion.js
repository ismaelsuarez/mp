/**
 * Script: Emitir Factura C por $0,10 en PRODUCCIÓN (WSFEv1)
 * Uso (PowerShell):
 *   node scripts/facturar-10c-produccion.js --cuit 20123456789 --pto 1 --cert "C:\ruta\cert.crt" --key "C:\ruta\key.key"
 *
 * Requisitos previos:
 * - En AFIP: servicio WSFEv1 habilitado y Punto de Venta (Web Services) configurado
 * - Certificado y clave privada de PRODUCCIÓN válidos para el CUIT
 */

/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const Afip = require('@afipsdk/afip.js');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--cuit') out.cuit = args[++i];
    else if (a === '--pto') out.pto = args[++i];
    else if (a === '--cert') out.cert = args[++i];
    else if (a === '--key') out.key = args[++i];
  }
  return out;
}

function yyyymmdd(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

async function main() {
  console.log('🧪 Factura C de $0,10 en PRODUCCIÓN (WSFEv1)');
  console.log('='.repeat(60));

  const { cuit, pto, cert, key } = parseArgs();

  if (!cuit || !pto || !cert || !key) {
    console.log('❌ Falta algún parámetro:');
    console.log('   --cuit <CUIT> --pto <PuntoVenta> --cert <rutaCert> --key <rutaKey>');
    process.exit(1);
  }

  // 1) Verificación de archivos
  console.log('\n📋 1) Verificando certificado/clave...');
  console.log('   - Cert:', cert);
  console.log('   - Key :', key);
  if (!fs.existsSync(cert)) {
    console.log('❌ Certificado no encontrado');
    process.exit(1);
  }
  if (!fs.existsSync(key)) {
    console.log('❌ Clave privada no encontrada');
    process.exit(1);
  }
  try {
    const certHead = (fs.readFileSync(cert, 'utf8') || '').split('\n')[0];
    const keyHead = (fs.readFileSync(key, 'utf8') || '').split('\n')[0];
    console.log('   Cert inicio:', certHead);
    console.log('   Key  inicio:', keyHead);
  } catch {}

  // 2) Instancia AFIP (PRODUCCIÓN)
  console.log('\n📋 2) Creando instancia AFIP (producción)...');
  const afip = new Afip({
    CUIT: Number(cuit),
    production: true,
    cert,
    key
  });
  console.log('   ✅ Instancia creada');

  // 3) Estado servidor
  console.log('\n📋 3) Verificando estado servidor...');
  try {
    const status = await afip.ElectronicBilling.getServerStatus();
    console.log('   ✅ AppServer:', status.AppServer, '| DbServer:', status.DbServer, '| AuthServer:', status.AuthServer);
  } catch (e) {
    console.log('   ⚠️  No se pudo obtener estado:', e?.message || e);
  }

  // 4) Obtener último autorizado
  const ptoVta = Number(pto);
  const tipoCbte = 11; // Factura C
  console.log('\n📋 4) Consultando último autorizado (PtoVta', ptoVta, 'Tipo 11)...');
  let last = 0;
  try {
    last = Number(await afip.ElectronicBilling.getLastVoucher(ptoVta, tipoCbte)) || 0;
    console.log('   ✅ Último:', last, '→ próximo:', last + 1);
  } catch (e) {
    console.log('   ⚠️  No se pudo leer último (continuo con 0):', e?.message || e);
  }

  // 5) Construir solicitud de comprobante mínimo CF $0,10
  console.log('\n📋 5) Enviando createVoucher (Factura C $0,10 CF)...');
  const numero = last + 1;
  const hoy = yyyymmdd(new Date());
  const total = 0.10;
  const neto = 0.10;
  const request = {
    CantReg: 1,
    PtoVta: ptoVta,
    CbteTipo: tipoCbte,
    Concepto: 1, // Productos
    DocTipo: 99, // CF
    DocNro: 0,
    CbteDesde: numero,
    CbteHasta: numero,
    CbteFch: hoy,
    ImpTotal: Number(total.toFixed(2)),
    ImpTotConc: 0,
    ImpNeto: Number(neto.toFixed(2)),
    ImpOpEx: 0,
    ImpIVA: 0,
    ImpTrib: 0,
    MonId: 'PES',
    MonCotiz: 1,
    Iva: []
  };
  try {
    const resp = await afip.ElectronicBilling.createVoucher(request);
    console.log('   ✅ CAE:', resp.CAE, '| Vto:', resp.CAEFchVto);
    console.log('\n🎉 OK. Comprobante emitido →', `PtoVta ${ptoVta} - Tipo 11 - Nro ${numero}`);
  } catch (e) {
    const msg = e?.response?.data || e?.message || String(e);
    console.log('   ❌ Error createVoucher:', msg);
    if (String(msg).includes('401')) {
      console.log('   👉 401 suele indicar que WSFEv1 no está habilitado o credenciales no corresponden a PRODUCCIÓN.');
      console.log('      Verifique: Administrador de Relaciones (WSFEv1) + PV Web Services + cert/clave de producción.');
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error('💥 Error no controlado:', e?.message || e);
    process.exit(1);
  });
}


