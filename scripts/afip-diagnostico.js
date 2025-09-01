/*
 * Diagnóstico paso a paso AFIP (WSAA/WSFE)
 *
 * Uso (ejemplos):
 *   node scripts/afip-diagnostico.js --entorno=produccion --cuit=30708673435 --pto=16 --cert=C:\\tc\\PCERT.crt --key=C:\\tc\\PKEY.key
 *   node scripts/afip-diagnostico.js --entorno=homologacion --cuit=20317470747 --pto=2 --cert=C:\\arca\\Nuevo\\cert.crt --key=C:\\arca\\Nuevo\\key.key
 *
 * Flags:
 *   --entorno           produccion | homologacion
 *   --cuit              CUIT emisor (numérico)
 *   --pto               Punto de Venta (número)
 *   --cert              Ruta al certificado X.509 en PEM
 *   --key               Ruta a la clave privada en PEM
 *   --tipo              (opcional) Tipo de comprobante para getLastVoucher (por defecto 11)
 *   --emitir-prueba     (opcional) Intentar emitir un comprobante mínimo de prueba (NO recomendado por defecto)
 *   --mem               (opcional) Si true, pasa cert/key como strings en memoria al SDK
 */

/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const ntpClient = require('ntp-client');
const forge = require('node-forge');
const { CompatAfip } = require('../dist/src/modules/facturacion/adapters/CompatAfip.js');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (const a of args) {
    const [k, v] = a.split('=');
    if (k.startsWith('--')) out[k.slice(2)] = v === undefined ? true : v;
  }
  return out;
}

function ok(msg, extra) {
  console.log(`✅ ${msg}`);
  if (extra !== undefined) console.log(extra);
}

function warn(msg, extra) {
  console.log(`⚠️  ${msg}`);
  if (extra !== undefined) console.log(extra);
}

function fail(msg, extra) {
  console.log(`❌ ${msg}`);
  if (extra !== undefined) console.log(extra);
}

function section(title) {
  console.log(`\n──────── ${title} ────────`);
}

function ensureFileExists(p, label) {
  if (!p) throw new Error(`${label} no informado`);
  if (!fs.existsSync(p)) throw new Error(`${label} no existe: ${p}`);
}

function readPemInfo(pemContent) {
  try {
    const cert = forge.pki.certificateFromPem(pemContent);
    const notAfter = cert.validity.notAfter;
    const notBefore = cert.validity.notBefore;
    const now = new Date();
    const valido = now >= notBefore && now <= notAfter;
    const diasRestantes = Math.ceil((notAfter - now) / (1000 * 60 * 60 * 24));
    // Extraer CUIT desde serialNumber del sujeto (p.ej. "CUIT 30708673435")
    let cuitFromCert = null;
    try {
      const snAttr = (cert.subject && cert.subject.attributes || []).find(a => a.name === 'serialNumber' || a.type === '2.5.4.5');
      if (snAttr && snAttr.value) {
        const digits = String(snAttr.value).replace(/\D+/g, '');
        if (digits.length === 11) cuitFromCert = digits;
      }
    } catch {}
    return { valido, notBefore, notAfter, diasRestantes, cuitFromCert, publicKey: cert.publicKey };
  } catch (e) {
    return null;
  }
}

async function checkNtp({ server = 'pool.ntp.org', port = 123, timeout = 5000 }) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout NTP')), timeout);
    ntpClient.getNetworkTime(server, port, (err, date) => {
      clearTimeout(timer);
      if (err) return reject(err);
      const driftMs = date.getTime() - Date.now();
      resolve({ driftMs, durationMs: Date.now() - start });
    });
  });
}

async function main() {
  const args = parseArgs();
  const entorno = (args.entorno || '').toLowerCase();
  const cuit = args.cuit;
  const pto = Number(args.pto || args.punto || 0);
  const certPath = args.cert;
  const keyPath = args.key;
  const tipoCbte = Number(args.tipo || 11);
  const emitirPrueba = Boolean(args['emitir-prueba']);
  const usarMem = String(args.mem || '').toLowerCase() === 'true' || args.mem === true;

  console.log('🔍 Diagnóstico AFIP (WSAA/WSFE)');
  console.log({ entorno, cuit, pto, certPath, keyPath, tipoCbte, emitirPrueba, usarMem });

  // Paso 0: Validación de argumentos
  section('0) Validación de argumentos');
  try {
    if (!['produccion', 'homologacion'].includes(entorno)) throw new Error('Entorno inválido (usar produccion|homologacion)');
    if (!cuit || !/^\d{11}$/.test(String(cuit))) throw new Error('CUIT inválido');
    if (!Number.isInteger(pto) || pto <= 0) throw new Error('Punto de Venta inválido (>0)');
    ensureFileExists(certPath, 'Certificado');
    ensureFileExists(keyPath, 'Clave privada');
    ok('Argumentos OK');
  } catch (e) {
    fail('Argumentos inválidos', e.message);
    process.exit(1);
  }

  // Paso 1: Verificación formato PEM
  section('1) Verificación de archivos (PEM)');
  try {
    const certContent = fs.readFileSync(certPath, 'utf8');
    const keyContent = fs.readFileSync(keyPath, 'utf8');
    if (!certContent.includes('-----BEGIN CERTIFICATE-----')) throw new Error('Certificado no es PEM');
    if (!keyContent.includes('-----BEGIN')) throw new Error('Clave privada no es PEM');
    ok('PEM válidos');
    const pemInfo = readPemInfo(certContent);
    if (pemInfo) {
      const { valido, notAfter, diasRestantes } = pemInfo;
      if (valido) ok(`Certificado vigente. Días restantes: ${diasRestantes}`);
      else warn(`Certificado fuera de vigencia (vence: ${notAfter.toISOString()})`);
      // Validar CUIT del certificado vs CUIT ingresado
      if (pemInfo.cuitFromCert) {
        if (String(pemInfo.cuitFromCert) !== String(cuit)) {
          throw new Error(`CUIT del certificado (${pemInfo.cuitFromCert}) no coincide con el CUIT ingresado (${cuit})`);
        } else {
          ok(`CUIT del certificado coincide: ${pemInfo.cuitFromCert}`);
        }
      } else {
        warn('No se pudo extraer CUIT del certificado (serialNumber) para validación');
      }
      // Validar correspondencia de clave privada con certificado (RSA)
      try {
        const privKey = (() => {
          try { return forge.pki.privateKeyFromPem(keyContent); } catch { return null; }
        })();
        if (privKey && pemInfo.publicKey && privKey.n && pemInfo.publicKey.n) {
          if (privKey.n.compareTo(pemInfo.publicKey.n) === 0) {
            ok('Clave privada corresponde al certificado (modulus coincide)');
          } else {
            throw new Error('La clave privada NO corresponde al certificado (modulus distinto)');
          }
        } else {
          warn('No se pudo verificar correspondencia clave/cert (formato no RSA PKCS)');
        }
      } catch (e) {
        throw new Error(e.message || 'Error validando correspondencia clave/cert');
      }
    } else {
      warn('No se pudo parsear el certificado para vigencia (node-forge)');
    }
  } catch (e) {
    fail('Archivos inválidos', e.message);
    process.exit(1);
  }

  // Paso 2: Chequeo NTP (drift)
  section('2) Sincronización de hora (NTP)');
  try {
    const { driftMs, durationMs } = await checkNtp({});
    ok(`NTP OK. Deriva: ${Math.abs(driftMs)} ms, duración: ${durationMs} ms`);
  } catch (e) {
    warn('NTP con problemas (continuamos igual)', e.message);
  }

  // Paso 3: Instancia AFIP y estado servidor
  section('3) Instancia AFIP y estado servidor');
  let afip;
  try {
    const certContentMem = fs.readFileSync(certPath, 'utf8');
    const keyContentMem = fs.readFileSync(keyPath, 'utf8');
    const afipOptions = usarMem
      ? { CUIT: cuit, cert: certContentMem, key: keyContentMem, production: entorno === 'produccion' }
      : { CUIT: cuit, cert: certPath, key: keyPath, production: entorno === 'produccion' };
    afip = new CompatAfip(afipOptions);
    ok(`Instancia AFIP creada (production=${entorno === 'produccion'}, cert/key en memoria=${usarMem})`);
  } catch (e) {
    fail('No se pudo crear instancia AFIP', e.message);
    process.exit(1);
  }
  try {
    const status = await afip.ElectronicBilling.getServerStatus();
    ok('ServerStatus OK', status);
  } catch (e) {
    fail('ServerStatus ERROR (posible conectividad/WSAA)', e.message);
  }

  // Paso 4: Listado de Puntos de Venta (requiere WSAA/WSFE OK)
  section('4) Listar Puntos de Venta (WSFE)');
  try {
    const eb = afip.ElectronicBilling;
    const fn = eb.getSalesPoints || eb.getPointsOfSales;
    if (typeof fn !== 'function') throw new Error('Método getSalesPoints/getPointsOfSales no disponible en SDK');
    const pts = await fn.call(eb);
    ok('Puntos de Venta WSFE', pts);
  } catch (e) {
    fail('No se pudieron listar Puntos de Venta', e.message);
    warn('Si es 401: revisar relación “WSFEv1” y que el PV esté habilitado como “RECE (WS)” en el entorno');
  }

  // Paso 5: FEParamGet* (tipos paramétricos)
  section('5) FEParamGet* (tipos paramétricos)');
  const feTests = [
    { name: 'getVoucherTypes', fn: () => ebCall(afip, 'getVoucherTypes') },
    { name: 'getConceptTypes', fn: () => ebCall(afip, 'getConceptTypes') },
    { name: 'getDocumentTypes', fn: () => ebCall(afip, 'getDocumentTypes') },
    { name: 'getCurrenciesTypes', fn: () => ebCall(afip, 'getCurrenciesTypes') },
  ];
  for (const t of feTests) {
    try {
      const res = await t.fn();
      ok(`${t.name} OK`, Array.isArray(res) ? `Items: ${res.length}` : res);
    } catch (e) {
      fail(`${t.name} ERROR`, e.message);
    }
  }

  function ebCall(afip, name) {
    const fn = afip.ElectronicBilling?.[name];
    if (typeof fn !== 'function') throw new Error(`Método ${name} no disponible`);
    return fn.call(afip.ElectronicBilling);
  }

  // Paso 6: Último comprobante autorizado (opcional por tipo)
  section('6) Último comprobante autorizado (getLastVoucher)');
  try {
    const last = await afip.ElectronicBilling.getLastVoucher(pto, tipoCbte);
    ok(`getLastVoucher OK (PtoVta=${pto}, Tipo=${tipoCbte})`, last);
  } catch (e) {
    fail('getLastVoucher ERROR', e.message);
    warn('Si es 400: PV no habilitado en ese entorno o TipoCbte incompatible con PV/condición');
  }

  // Paso 7: Emisión de prueba (deshabilitada por defecto)
  if (emitirPrueba) {
    section('7) Emisión mínima de prueba (createVoucher)');
    try {
      const today = new Date();
      const yyyymmdd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
      const data = {
        CantReg: 1,
        PtoVta: pto,
        CbteTipo: tipoCbte,
        Concepto: 1,
        DocTipo: 99,
        DocNro: 0,
        CbteFch: yyyymmdd,
        ImpTotal: 0.01,
        ImpTotConc: 0,
        ImpNeto: 0.01,
        ImpOpEx: 0,
        ImpIVA: 0,
        ImpTrib: 0,
        MonId: 'PES',
        MonCotiz: 1,
      };
      const resp = await afip.ElectronicBilling.createVoucher(data);
      ok('createVoucher OK', resp);
    } catch (e) {
      fail('createVoucher ERROR', e.message);
      warn('Si ServerStatus y FEParamGet* están OK pero falla acá, revisar mapping de tipos/IVA y datos del comprobante');
    }
  }

  console.log('\n🎯 Diagnóstico finalizado');
}

main().catch((e) => {
  fail('Error no controlado', e.message);
  process.exit(1);
});


