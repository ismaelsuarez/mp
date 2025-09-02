/*
  Uso:
    node scripts/qr-afip-decode.js "D:\\ruta\\qr1.png" "D:\\ruta\\qr2.jpg"

  Requisitos (una sola vez):
    npm i jimp qrcode-reader --no-save
*/

/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const QrCode = require('qrcode-reader');

async function decodeOne(imagePath) {
  const out = { file: imagePath };
  try {
    if (!fs.existsSync(imagePath)) {
      out.error = 'Archivo no encontrado';
      return out;
    }
    const img = await Jimp.read(imagePath);
    const qr = new QrCode();
    const data = await new Promise((resolve, reject) => {
      qr.callback = (err, value) => (err ? reject(err) : resolve(value));
      try {
        qr.decode(img.bitmap);
      } catch (e) {
        reject(e);
      }
    });
    out.raw = data?.result || '';
    // Si es un QR de AFIP, tendrá .../fe/qr/?p=BASE64
    const m = out.raw.match(/[?&]p=([^&#]+)/);
    if (m) {
      const p = decodeURIComponent(m[1]);
      try {
        const json = JSON.parse(Buffer.from(p, 'base64').toString('utf8'));
        out.afip = json;
        // Campos útiles comunes
        out.summary = {
          ver: json.ver,
          fecha: json.fecha,
          cuit: json.cuit,
          ptoVta: json.ptoVta,
          tipoCmp: json.tipoCmp,
          nroCmp: json.nroCmp,
          importe: json.importe,
          moneda: json.moneda,
          ctz: json.ctz,
          cae: json.cae,
        };
      } catch (e) {
        out.error = `No se pudo decodificar parámetro p: ${e.message}`;
      }
    }
  } catch (e) {
    out.error = e.message;
  }
  return out;
}

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.log('Uso: node scripts/qr-afip-decode.js "C:/ruta/qr.png" [más archivos...]');
    process.exit(1);
  }
  const results = [];
  for (const f of files) {
    const abs = path.resolve(f);
    // eslint-disable-next-line no-await-in-loop
    const r = await decodeOne(abs);
    results.push(r);
  }
  for (const r of results) {
    console.log('\n──────── QR ────────');
    console.log('Archivo:', r.file);
    if (r.error) console.log('Error:', r.error);
    if (r.raw) console.log('URL:', r.raw);
    if (r.summary) {
      console.log('AFIP:', r.summary);
    }
  }
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});


