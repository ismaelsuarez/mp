// Simple extractor: node scripts/extract-pdf-text.js <pdfPath>
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/extract-pdf-text.js <pdfPath>');
    process.exit(1);
  }
  const full = path.resolve(file);
  const buf = fs.readFileSync(full);
  const res = await pdfParse(buf);
  // Print plain text
  console.log(res.text);
}

main().catch((e) => { console.error(e?.message || e); process.exit(2); });


