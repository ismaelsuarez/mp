// Usage:
// npx ts-node mp/src/modules/payway/payway-stubs/scripts/run-payway-watcher.ts --config ./payway.config.json --in ./carpeta_fac
//
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { processFacWithPayway } from '../src/watchers/fac-payway';
import { PaywayService } from '../src/payments/payway/PaywayService';

function parseArgs() {
  const args = process.argv.slice(2);
  const out: Record<string,string> = {};
  for (let i=0;i<args.length;i++){
    if (args[i].startsWith('--')) { out[args[i].slice(2)] = args[i+1]; i++; }
  }
  return out;
}

async function main(){
  const args = parseArgs();
  const cfgPath = args['config'] || './payway.config.json';
  const inDir = args['in'] || './samples/fac';
  const cfg = JSON.parse(require('fs').readFileSync(cfgPath,'utf-8'));

  const service = new PaywayService({
    baseUrl: cfg.baseUrl,
    apikey: cfg.apikey,
    cuitCuil: cfg.cuitCuil,
    pollIntervalMs: cfg.pollIntervalMs ?? 1500,
    pollMaxSeconds: cfg.pollMaxSeconds ?? 120,
    defaultMerchantId: cfg.defaultMerchantId,
    defaultTerminalId: cfg.defaultTerminalId,
    defaultSerial: cfg.defaultSerial,
  });

  const files = readdirSync(inDir).filter(f => f.toLowerCase().endsWith('.fac'));
  for (const f of files){
    const full = join(inDir, f);
    if (!statSync(full).isFile()) continue;
    try {
      const res = await processFacWithPayway(full, service);
      console.log('OK ->', res || '(no bloque Payway)');
    } catch (e:any){
      console.error('ERROR', f, e.message);
    }
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
