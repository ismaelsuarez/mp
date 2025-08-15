const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function main() {
  const projectRoot = process.cwd();
  const src = path.join(projectRoot, 'docs', 'manual.html');
  const dstDir = path.join(projectRoot, 'build');
  const dst = path.join(dstDir, 'manual.html');
  if (!fs.existsSync(src)) {
    console.warn('[copy-manual] manual.html not found in docs/. Skipping.');
    return;
  }
  ensureDir(dstDir);
  fs.copyFileSync(src, dst);
  console.log('[copy-manual] Copied docs/manual.html -> build/manual.html');
}

main();


