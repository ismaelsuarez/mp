import { readFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import { parsePaywayBlock } from '../payments/payway/facParser';
import { PaywayService } from '../payments/payway/PaywayService';
import { writeRes, ResDoc } from '../payments/payway/resWriter';

// Hook: emitir factura AFIP (stub)
async function emitirFacturaAFIP(){
  // TODO: integrar con tu módulo actual y devolver { tipo, ptoVta, nro, cae, vtoCae, total, ivaContenido }
  return {
    tipo: 'B', ptoVta: '0001', nro: '0001-00001234', cae: '70456789012345', vtoCae: '10/10/2025',
    total: 71500.00, ivaContenido: 11020.66
  };
}

export async function processFacWithPayway(fullPath: string, payway: PaywayService){
  const txt = readFileSync(fullPath, 'utf-8');
  const facName = basename(fullPath);
  const baseDir = dirname(fullPath);

  const block = parsePaywayBlock(txt);
  if (!block) return null; // no hay bloque payway

  const pagos: ResDoc['pagos'] = [];

  let totalApproved = 0;
  for (const p of block.pagos){
    const result = await payway.requestAndWait({
      amount: Math.round(p.importe * 100),
      currency: 'ARS',
      installments: p.cuotas,
      brand: p.tarjeta?.toUpperCase(),
      plan: p.plan,
      external_reference: block.idOrden,
    });
    if (result.status === 'APPROVED'){
      totalApproved += p.importe;
      pagos.push({
        provider: 'PAYWAY', estado: 'APROBADO', importe: p.importe, moneda: 'ARS',
        tarjeta: p.tarjeta, cuotas: p.cuotas, plan: p.plan,
        paymentId: result.id, autorizacion: (result as any).auth_code, ticket: (result as any).ticket_number, last4: (result as any).last4,
      });
    } else {
      pagos.push({
        provider: 'PAYWAY', estado: 'DECLINADO', importe: p.importe, moneda: 'ARS',
        tarjeta: p.tarjeta, cuotas: p.cuotas, plan: p.plan,
        paymentId: result.id, errorCode: (result as any).error_code, errorMsg: (result as any).error_message,
      });
      if (block.splitPolicy === 'ALL_OR_NOTHING'){
        for (const aprobado of pagos.filter(x=>x.estado==='APROBADO' && x.paymentId)){
          try { await payway.reversal(aprobado.paymentId!,'split_failed'); } catch {}
        }
        const res: ResDoc = {
          diahora: new Date().toISOString(),
          archivoOrigen: facName,
          idOrden: block.idOrden,
          estado: 'DECLINADO',
          pagos
        };
        const resName = writeRes(baseDir, facName, res);
        return join(baseDir, resName);
      }
    }
  }

  if (Math.abs(totalApproved - block.total) < 0.01){
    try {
      const f = await emitirFacturaAFIP();
      const res: ResDoc = {
        diahora: new Date().toISOString(),
        archivoOrigen: facName,
        idOrden: block.idOrden,
        estado: 'OK',
        pagos,
        factura: {
          tipo: f.tipo, ptoVta: f.ptoVta, nro: f.nro, cae: f.cae, vtoCae: f.vtoCae,
          importeTotal: f.total, ivaContenido: f.ivaContenido
        },
        obs: `Medio de pago: Tarjeta (Payway)`
      };
      const resName = writeRes(baseDir, facName, res);
      return join(baseDir, resName);
    } catch (e:any){
      for (const aprobado of pagos.filter(x=>x.estado==='APROBADO' && x.paymentId)){
        try { await payway.reversal(aprobado.paymentId!,'invoice_failed'); } catch {}
      }
      const res: ResDoc = {
        diahora: new Date().toISOString(),
        archivoOrigen: facName,
        idOrden: block.idOrden,
        estado: 'ERROR_FACTURACION',
        pagos,
        reversa: { estado: 'OK', motivo: 'Error al emitir comprobante AFIP' }
      };
      const resName = writeRes(baseDir, facName, res);
      return join(baseDir, resName);
    }
  } else {
    for (const aprobado of pagos.filter(x=>x.estado==='APROBADO' && x.paymentId)){
      try { await payway.reversal(aprobado.paymentId!,'not_fully_paid'); } catch {}
    }
    const res: ResDoc = {
      diahora: new Date().toISOString(),
      archivoOrigen: facName,
      idOrden: block.idOrden,
      estado: 'REVERTIDO',
      pagos,
      obs: 'La suma aprobada no alcanza TOTAL. Sesión revertida por política.'
    };
    const resName = writeRes(baseDir, facName, res);
    return join(baseDir, resName);
  }
}
