/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';

function readJsonSafe(p: string): any { try { return JSON.parse(fs.readFileSync(p,'utf8')); } catch { return null; } }
function readTextSafe(p: string): string { try { return fs.readFileSync(p,'utf8'); } catch { return ''; } }

function listAuditDirs(): string[] {
  const base = path.resolve(process.cwd(), 'logs', 'afip', 'prod', 'audit');
  try { fs.mkdirSync(base, { recursive: true }); } catch {}
  try {
    return fs.readdirSync(base).map(n => path.join(base, n)).filter(p => {
      try { return fs.statSync(p).isDirectory(); } catch { return false; }
    }).sort();
  } catch { return []; }
}

function summarize() {
  const dirs = listAuditDirs();
  const out: any = {
    count: dirs.length,
    withCondIva: 0,
    mathOk: 0,
    ivaSumOk: 0,
    datesOk: 0,
    resultados: { A: 0, R: 0, N: 0 },
    obs: {} as Record<string, number>,
    errs: {} as Record<string, number>,
    endpoints: new Set<string>(),
  };
  for (const d of dirs) {
    const summary = readJsonSafe(path.join(d, 'summary.json')) || {};
    const host = String(summary.endpointHost || '');
    if (host) out.endpoints.add(host);
    if (summary.hasCondIva) out.withCondIva++;
    if (summary.mathOk) out.mathOk++;
    if (summary.ivaSumOk) out.ivaSumOk++;
    if (summary.datesOk) out.datesOk++;
    const res = String(summary.resultado || 'N');
    if (res === 'A') out.resultados.A++; else if (res === 'R') out.resultados.R++; else out.resultados.N++;
    const obs = Array.isArray(summary.obs) ? summary.obs : [];
    for (const o of obs) { const k = String(o.Code || ''); out.obs[k] = (out.obs[k] || 0) + 1; }
    const errs = Array.isArray(summary.errs) ? summary.errs : [];
    for (const e of errs) { const k = String(e.Code || ''); out.errs[k] = (out.errs[k] || 0) + 1; }
  }
  return out;
}

function writeReport(sum: any) {
  const md = [] as string[];
  md.push('# AFIP PROD Audit Summary');
  md.push('');
  md.push(`Muestras analizadas: ${sum.count}`);
  md.push(`Endpoints: ${Array.from(sum.endpoints).join(', ')}`);
  md.push(`Con CondicionIVAReceptorId: ${sum.withCondIva}/${sum.count}`);
  md.push(`Math OK: ${sum.mathOk}/${sum.count} | IVA OK: ${sum.ivaSumOk}/${sum.count} | Fechas OK: ${sum.datesOk}/${sum.count}`);
  md.push(`Resultado A/R/N: ${sum.resultados.A}/${sum.resultados.R}/${sum.resultados.N}`);
  md.push('');
  md.push('Observaciones más comunes:');
  for (const [k, v] of Object.entries(sum.obs)) md.push(`- ${k}: ${v}`);
  md.push('');
  md.push('Errores más comunes:');
  for (const [k, v] of Object.entries(sum.errs)) md.push(`- ${k}: ${v}`);
  const outPath = path.resolve(process.cwd(), 'docs', 'afip-prod-audit-summary.md');
  try { fs.mkdirSync(path.dirname(outPath), { recursive: true }); } catch {}
  fs.writeFileSync(outPath, md.join('\n'), 'utf8');
  console.log(md.join('\n'));
  console.log(`\nReporte escrito en: ${outPath}`);
}

function main() {
  const sum = summarize();
  writeReport(sum);
}

main();


