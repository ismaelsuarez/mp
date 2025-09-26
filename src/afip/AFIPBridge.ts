export type CaeResponse = { cae: string; vencimiento: string; qrData: any; raw: any };

export class AFIPError extends Error {
  kind: 'transient' | 'permanent';
  code?: string;
  httpStatus?: number;
  constructor(message: string, kind: 'transient' | 'permanent', code?: string, httpStatus?: number) {
    super(message);
    this.name = 'AFIPError';
    this.kind = kind;
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export interface AFIPBridge {
  getTA?(): Promise<void>;
  solicitarCAE(req: any): Promise<CaeResponse>;
}

export class StubAFIPBridge implements AFIPBridge {
  async getTA(): Promise<void> { /* no-op */ }
  async solicitarCAE(req: any): Promise<CaeResponse> {
    const mode = String(process.env.AFIP_STUB_MODE || 'ok');
    await new Promise(res => setTimeout(res, Math.min(300, Number(process.env.WS_TIMEOUT_MS || 300))));
    if (mode === 'fail_transient') {
      throw new AFIPError('timeout simulada', 'transient', 'ETIMEDOUT', 504);
    }
    if (mode === 'fail_permanent') {
      throw new AFIPError('validación simulada', 'permanent', 'VALIDATION');
    }
    const cae = Math.floor(10_000_000_000_000 + Math.random() * 89_999_999_999_999).toString();
    const addDays = (d: number) => {
      const now = new Date(); now.setDate(now.getDate() + d);
      const y = now.getFullYear(); const m = String(now.getMonth() + 1).padStart(2, '0'); const dd = String(now.getDate()).padStart(2, '0');
      return `${y}${m}${dd}`;
    };
    const vencimiento = addDays(7);
    const qrData = { ok: true, cae };
    return { cae, vencimiento, qrData, raw: { stub: true, req } };
  }
}

export class RealAFIPBridge implements AFIPBridge {
  private afip: any;
  constructor(afipInstance?: any) {
    try {
      // Reusar servicio/instancia existente
      if (afipInstance) this.afip = afipInstance;
      else {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { afipService } = require('../modules/facturacion/afipService');
        this.afip = (afipService as any).getAfipInstance ? null : afipService; // fallback: usaremos métodos públicos abajo
      }
    } catch {}
  }
  async getTA(): Promise<void> { /* manejado por afipService internamente */ }
  async solicitarCAE(req: any): Promise<CaeResponse> {
    try {
      // Reusar el servicio existente para emitir y obtener CAE + QR
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { afipService } = require('../modules/facturacion/afipService');
      const tipoCbte = Number(req?.tipo || 6);
      // Mapear condIvaCode → categoría esperada por afipService ('CF'|'RI'|'MT'|'EX')
      const condIvaCode: number | undefined = typeof req?.condIvaCode === 'number' ? req.condIvaCode : undefined;
      const condicionCategoria = ((): 'CF'|'RI'|'MT'|'EX'|undefined => {
        switch (condIvaCode) {
          case 5: return 'CF';
          case 6: case 13: return 'MT';
          case 1: return 'RI';
          case 4: case 15: return 'EX';
          default: return undefined; // 8/9/10 u otros no soportados deben haber sido filtrados antes
        }
      })();
      const payload = {
        pto_vta: (require('../services/DbService') as any).getDb().getAfipConfig()?.pto_vta || 1,
        tipo_cbte: tipoCbte,
        fecha: String(req?.fecha || ''),
        total: Number(req?.total || 0),
        neto: Number(req?.neto || 0),
        iva: Number(req?.iva || 0),
        doc_tipo: Number(req?.docTipo || 99),
        cuit_receptor: req?.docNro ? String(req.docNro) : undefined,
        condicion_iva_receptor: condicionCategoria,
        detalle: Array.isArray(req?.items) ? req.items.map((it: any) => ({ descripcion: it.descripcion, cantidad: it.cantidad, precioUnitario: it.unitario, alicuotaIva: it.iva })) : []
      };
      const r = await afipService.solicitarCAE(payload);
      if (!r || !r.cae) throw new Error('AFIP sin CAE');
      return { cae: String(r.cae), vencimiento: String(r.vencimientoCAE || r.caeVencimiento || ''), qrData: (r as any).qrData, raw: r };
    } catch (e: any) {
      const msg = String(e?.message || e);
      // clasificar
      if (/timeout|ETIMEDOUT|ECONN|ENOTFOUND|EAI_AGAIN|network|ECONNRESET|EHOST|502|503|504/i.test(msg)) {
        throw new AFIPError(msg, 'transient', e?.code, e?.response?.status);
      }
      if (/Validación AFIP falló|Errores de validación|Observaciones|INVALID/i.test(msg)) {
        throw new AFIPError(msg, 'permanent', e?.code, e?.response?.status);
      }
      // por defecto, tratar como transient si es HTTP >=500
      const status = e?.response?.status;
      if (status && status >= 500) throw new AFIPError(msg, 'transient', e?.code, status);
      throw new AFIPError(msg, 'permanent', e?.code, status);
    }
  }
}


