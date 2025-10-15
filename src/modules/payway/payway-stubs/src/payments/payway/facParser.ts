export type FacPay = {
  tarjeta: string;
  importe: number;
  cuotas?: number;
  plan?: string;
};

export type FacPaywayBlock = {
  idOrden: string;
  total: number;
  moneda: 'ARS';
  splitPolicy: 'ALL_OR_NOTHING'|'PARCIAL_PERMITIDO';
  pagos: FacPay[];
  terminalId?: string;
  terminalSerial?: string;
};

const line = (s: string) => s.trim();
const num = (s: string) => Number(String(s).replace(',', '.'));

export function parsePaywayBlock(facText: string): FacPaywayBlock | null {
  const lines = facText.split(/\r?\n/).map(line);
  const idx = lines.findIndex(l => l.toUpperCase().startsWith('COBRO: PAYWAY'));
  if (idx === -1) return null;
  const block: FacPaywayBlock = { idOrden: '', total: 0, moneda: 'ARS', splitPolicy: 'ALL_OR_NOTHING', pagos: [] };
  for (let i = idx+1; i < lines.length; i++) {
    const L = lines[i];
    if (!L || /^#/.test(L)) continue;
    if (/^COBRO:/.test(L) && i !== idx+1) break; // next block
    const [k,vraw] = L.split(':',2);
    if (!vraw) continue;
    const v = vraw.trim();
    switch(k.trim().toUpperCase()){
      case 'ID_ORDEN': block.idOrden = v; break;
      case 'TOTAL': block.total = num(v); break;
      case 'MONEDA': block.moneda = v as any; break;
      case 'POLITICA_SPLIT': block.splitPolicy = v as any; break;
      case 'TERMINAL_ID': block.terminalId = v; break;
      case 'TERMINAL_SERIAL': block.terminalSerial = v; break;
      case 'PAGO': {
        const obj: any = {};
        v.split(';').map(s=>s.trim()).forEach(pair => {
          const [pk,pv] = pair.split('=',2);
          if (!pv) return;
          const key = pk.trim().toUpperCase();
          const val = pv.trim();
          if (key==='TARJETA') obj.tarjeta = val;
          if (key==='IMPORTE') obj.importe = num(val);
          if (key==='CUOTAS') obj.cuotas = Number(val);
          if (key==='PLAN') obj.plan = val;
        });
        if (!obj.tarjeta || !obj.importe) throw new Error('PAGO inválido: TARJETA e IMPORTE son obligatorios');
        block.pagos.push(obj as FacPay);
      } break;
    }
  }
  if (!block.idOrden) throw new Error('ID_ORDEN es obligatorio');
  if (!block.total || block.total <= 0) throw new Error('TOTAL inválido');
  const sum = block.pagos.reduce((a,p)=>a+(p.importe||0),0);
  if (sum <= 0) throw new Error('Debe especificar al menos un PAGO con IMPORTE');
  return block;
}
