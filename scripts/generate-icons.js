#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const toIco = require('to-ico');

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function rasterizeSvg(svgPath, size) {
  const svg = fs.readFileSync(svgPath, 'utf8');
  const canvas = createCanvas(size, size, 'image');
  const ctx = canvas.getContext('2d');
  const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  const img = await loadImage(dataUrl);
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(img, 0, 0, size, size);
  return canvas.toBuffer('image/png');
}

async function main() {
  const root = path.join(__dirname, '..');
  const svgPath = path.join(root, 'build', 'icon.svg');
  if (!fs.existsSync(svgPath)) {
    console.error('No se encontró build/icon.svg');
    process.exit(1);
  }

  const outPublic = path.join(root, 'public');
  const outBuild = path.join(root, 'build');
  await ensureDir(outPublic);
  await ensureDir(outBuild);

  // PNG principal para la app (64x64)
  const png64 = await rasterizeSvg(svgPath, 64);
  fs.writeFileSync(path.join(outPublic, 'icon.png'), png64);

  // ICO multi-tamaño (16, 24, 32, 48, 64)
  const sizes = [16, 24, 32, 48, 64];
  const pngBuffers = [];
  for (const s of sizes) {
    pngBuffers.push(await rasterizeSvg(svgPath, s));
  }
  const icoBuffer = await toIco(pngBuffers);
  fs.writeFileSync(path.join(outBuild, 'icon.ico'), icoBuffer);

  console.log('Iconos generados: public/icon.png, build/icon.ico');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


