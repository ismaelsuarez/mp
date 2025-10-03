/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';

type Hit = { file: string; line: number; fragment: string };

function scanFile(file: string, patterns: RegExp[]): Hit[] {
  const out: Hit[] = [];
  let txt = '';
  try { txt = fs.readFileSync(file, 'utf8'); } catch { return out; }
  const lines = txt.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const re of patterns) {
      if (re.test(line)) {
        const frag = [lines[Math.max(0, i - 2)], line, lines[Math.min(lines.length - 1, i + 2)]].filter(Boolean).join('\n');
        out.push({ file, line: i + 1, fragment: frag });
        break;
      }
    }
  }
  return out;
}

function walk(dir: string, filterExt = ['.ts', '.js', '.md'], out: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|dist|coverage|\.git/.test(p)) walk(p, filterExt, out); continue; }
    if (filterExt.includes(path.extname(p))) out.push(p);
  }
  return out;
}

async function main() {
  const root = process.cwd();
  const files = walk(root);

  const watchers = files.flatMap(f => scanFile(f, [/chokidar/i, /fs\.watch/i, /watch\(/i, /awaitWriteFinish/i]));
  const facOps = files.flatMap(f => scanFile(f, [/unlink|rm\(|remove\(|rename\(|move\(/i, /\.fac/i]));
  const paths = files.flatMap(f => scanFile(f, [/C:\\tmp/i, /FAC_INCOMING_DIR|FAC_STAGING_DIR|FAC_PROCESSING_DIR|FAC_DONE_DIR|FAC_ERROR_DIR|FAC_OUT_DIR/i]));
  const afip = files.flatMap(f => scanFile(f, [/FECAEReq|AlicIva|ImpIVA|ImpNeto|ImpTotal|ImpTotConc|ImpOpEx|ImpTrib/i]));
  const errors = files.flatMap(f => scanFile(f, [/retry|reintento|backoff|timeout|ECONN|ENOTFOUND|EAI_AGAIN|axios|soap/i]));

  console.log(JSON.stringify({ watchers, facOps, paths, afip, errors }, null, 2));
}

main().catch((e) => { console.error('scan_fac_usage ERROR:', (e as any)?.message || e); process.exit(1); });


