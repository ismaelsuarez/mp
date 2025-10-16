// Usage:
// npx ts-node mp/src/modules/payway/payway-stubs/scripts/simulate-payway-watcher.ts --in ./path_to_fac_folder
//

import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { processFacWithPayway } from '../src/watchers/fac-payway';

class FakePaywayService {
  async requestAndWait(p: any) {
    const id = 'FAKE-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const ref = (p.external_reference || '').toUpperCase();
    if (ref.includes('DECLINADO')) {
      return { id, status: 'DECLINED', error_code: '05', error_message: 'Operación no autorizada' };
    }
    return { id, status: 'APPROVED', auth_code: '123456', ticket_number: '9876543210', last4: '1234' };
  }
  async reversal(paymentId: string, reason = 'invoice_failed') { return { id: 'RV-' + paymentId }; }
  async settlementNow() { return { id: 'SETTLE-FAKE' }; }
}

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
  const inDir = args['in'] || './samples/fac';
  const files = readdirSync(inDir).filter(f => f.toLowerCase().endsWith('.fac'));
  const service = new FakePaywayService();
  for (const f of files){
    const full = join(inDir, f);
    if (!statSync(full).isFile()) continue;
    try {
      const res = await processFacWithPayway(full, service as any);
      console.log('OK ->', res || '(no bloque Payway)');
    } catch (e:any){
      console.error('ERROR', f, e.message);
    }
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });
