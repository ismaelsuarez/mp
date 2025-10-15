import { startSettlementJob } from './payway-stubs/src/jobs/settlementJob';
import { makePaywayService } from './serviceFactory';

export async function startDailySettlement(branchId: string, hhmm: string) {
  const service = await makePaywayService(branchId);
  return startSettlementJob(service, hhmm);
}


