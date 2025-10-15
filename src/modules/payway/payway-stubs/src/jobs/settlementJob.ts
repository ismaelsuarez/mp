import { PaywayService } from '../payments/payway/PaywayService';

export function startSettlementJob(payway: PaywayService, hhmm: string){
  let timer: any;
  const tick = async () => {
    const now = new Date();
    const [hh, mm] = hhmm.split(':').map(Number);
    const when = new Date(now);
    when.setHours(hh, mm, 0, 0);
    if (when < now) when.setDate(when.getDate()+1);
    const ms = when.getTime() - now.getTime();
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try { await payway.settlementNow(); } catch {}
      tick();
    }, ms);
  };
  tick();
  return () => clearTimeout(timer);
}
