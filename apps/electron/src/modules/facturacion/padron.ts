import { afipService } from './afipService';

export async function consultarPadronAlcance13(cuit: number) {
  const afip: any = (afipService as any);
  const inst = await (afip as any).getAfipInstance?.();
  if (!inst?.registerScopeThirteenService) {
    throw new Error('Servicio Padrón 13 no disponible');
  }
  return inst.registerScopeThirteenService.getTaxpayerDetails(Number(cuit));
}

export async function pingPadron13() {
  const afip: any = (afipService as any);
  const inst = await (afip as any).getAfipInstance?.();
  if (!inst?.registerScopeThirteenService) {
    throw new Error('Servicio Padrón 13 no disponible');
  }
  try {
    const res = await inst.registerScopeThirteenService.getServerStatus();
    return { ok: true, status: res };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}


