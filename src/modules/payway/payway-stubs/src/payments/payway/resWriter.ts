import { writeFileSync } from 'fs';
import { join } from 'path';

export type ResPayment = {
  provider: 'PAYWAY';
  estado: 'APROBADO'|'DECLINADO'|'ERROR';
  importe: number;
  moneda: 'ARS';
  tarjeta?: string;
  cuotas?: number;
  plan?: string;
  paymentId?: string;
  autorizacion?: string;
  ticket?: string;
  last4?: string;
  errorCode?: string;
  errorMsg?: string;
};

export type ResDoc = {
  diahora: string;
  archivoOrigen: string;
  idOrden: string;
  estado: 'OK'|'DECLINADO'|'ERROR_FACTURACION'|'REVERTIDO';
  pagos: ResPayment[];
  factura?: {
    tipo: string; ptoVta: string; nro: string; cae: string; vtoCae: string;
    importeTotal: number; ivaContenido?: number;
  };
  reversa?: { estado: 'OK'|'ERROR'; id?: string; motivo?: string };
  obs?: string;
};

export function writeRes(baseDir: string, facName: string, doc: ResDoc){
  const pad = (n:number)=> String(n).padStart(2,'0');
  const now = new Date();
  const dh = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${String(now.getFullYear()).slice(-2)} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const out: string[] = [
    `DIAHORA:${dh}`,
    `ARCHIVO_ORIGEN:${facName}`,
    `ID_ORDEN:${doc.idOrden}`,
    `ESTADO:${doc.estado}`,
    ``,
    `PAGOS_CANT:${doc.pagos.length}`
  ];

  doc.pagos.forEach((p,idx)=>{
    const i = idx+1;
    out.push(
      `PAGO_${i}_PROVIDER:${p.provider}`,
      `PAGO_${i}_ESTADO:${p.estado}`,
      `PAGO_${i}_IMPORTE:${p.importe.toFixed(2)}`,
      `PAGO_${i}_MONEDA:${p.moneda}`,
      `PAGO_${i}_TARJETA:${p.tarjeta ?? '-'}`,
      `PAGO_${i}_CUOTAS:${p.cuotas ?? '-'}`,
      `PAGO_${i}_PLAN:${p.plan ?? '-'}`,
      `PAGO_${i}_PAYMENT_ID:${p.paymentId ?? '-'}`,
      `PAGO_${i}_AUTORIZACION:${p.autorizacion ?? '-'}`,
      `PAGO_${i}_TICKET:${p.ticket ?? '-'}`,
      `PAGO_${i}_LAST4:${p.last4 ?? '-'}`,
    );
    if (p.errorCode) out.push(`PAGO_${i}_ERROR_CODE:${p.errorCode}`);
    if (p.errorMsg) out.push(`PAGO_${i}_ERROR_MSG:${p.errorMsg}`);
  });

  if (doc.factura){
    const f = doc.factura;
    out.push(
      ``,
      `FACTURA_TIPO:${f.tipo}`,
      `PTO_VTA:${f.ptoVta}`,
      `NRO:${f.nro}`,
      `CAE:${f.cae}`,
      `VTO_CAE:${f.vtoCae}`,
      `IMPORTE_TOTAL:${f.importeTotal.toFixed(2)}`,
      `IVA_CONTENIDO:${(f.ivaContenido ?? 0).toFixed(2)}`,
    );
  } else {
    out.push(
      ``,
      `FACTURA_TIPO:-`,
      `PTO_VTA:-`,
      `NRO:-`,
      `CAE:-`,
      `VTO_CAE:-`,
    );
  }

  if (doc.reversa){
    out.push(
      ``,
      `REVERSA_ESTADO:${doc.reversa.estado}`,
      `REVERSA_ID:${doc.reversa.id ?? '-'}`,
      `REVERSA_MOTIVO:${doc.reversa.motivo ?? '-'}`,
    );
  }

  if (doc.obs){
    out.push(
      ``,
      `OBS:${doc.obs}`
    );
  }

  const resName = facName.replace(/\.fac$/i, '.res');
  writeFileSync(join(baseDir, resName), out.join('\n'), 'utf-8');
  return resName;
}
