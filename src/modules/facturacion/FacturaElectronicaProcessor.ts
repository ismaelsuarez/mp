import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import { app } from 'electron';
import { generateInvoicePdf } from '../../pdfRenderer';
import layoutMendoza from '../../invoiceLayout.mendoza';
import { sendArbitraryFile } from '../../services/FtpService';

type TipoDocumento = 'FA'|'FB'|'NCA'|'NCB'|'NDA'|'NDB';

export interface FacInput { fullPath: string; raw?: string; }

export class FacturaElectronicaProcessor {
  private svc: any;
  constructor(getService: () => any) { this.svc = getService(); }

  private mapTipoToCbte(tipo: TipoDocumento): number {
    switch (tipo) {
      case 'FA': return 1; case 'FB': return 6;
      case 'NDA': return 2; case 'NDB': return 7;
      case 'NCA': return 3; case 'NCB': return 8;
    }
    return 6;
  }

  private detectTipoFromFacContent(raw: string, fileName: string): TipoDocumento | null {
    const t = (raw.match(/\bTIPO:\s*(.+)/i)?.[1] || '').trim().toUpperCase();
    if (t === 'FACTURA A' || /A\.fac$/i.test(fileName)) return 'FA';
    if (t === 'FACTURA B' || /B\.fac$/i.test(fileName)) return 'FB';
    if (t === 'NOTA CREDITO A' || /NCA\.fac$/i.test(fileName)) return 'NCA';
    if (t === 'NOTA CREDITO B' || /NCB\.fac$/i.test(fileName)) return 'NCB';
    if (t === 'NOTA DEBITO A' || /NDA\.fac$/i.test(fileName)) return 'NDA';
    if (t === 'NOTA DEBITO B' || /NDB\.fac$/i.test(fileName)) return 'NDB';
    return null;
  }

  private readTextSmart(filePath: string): string {
    const buf = fs.readFileSync(filePath);
    let utf = buf.toString('utf8');
    if ((utf.match(/\uFFFD/g) || []).length === 0) return utf;
    let l1 = buf.toString('latin1');
    const map: Record<number, string> = { 0x80:'\u20AC',0x82:'\u201A',0x83:'\u0192',0x84:'\u201E',0x85:'\u2026',0x86:'\u2020',0x87:'\u2021',0x88:'\u02C6',0x89:'\u2030',0x8A:'\u0160',0x8B:'\u2039',0x8C:'\u0152',0x8E:'\u017D',0x91:'\u2018',0x92:'\u2019',0x93:'\u201C',0x94:'\u201D',0x95:'\u2022',0x96:'\u2013',0x97:'\u2014',0x98:'\u02DC',0x99:'\u2122',0x9A:'\u0161',0x9B:'\u203A',0x9C:'\u0153',0x9E:'\u017E',0x9F:'\u0178' };
    let out = '';
    for (let i=0;i<l1.length;i++){ const c=l1.charCodeAt(i); out += (c>=0x80&&c<=0x9F&&map[c])? JSON.parse('"'+map[c]+'"'): l1[i]; }
    try { out = out.normalize('NFC'); } catch {}
    return out;
  }

  private loadConfig() {
    try {
      const p = path.join(app.getPath('userData'), 'config', 'facturas.config.json');
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p,'utf8'));
    } catch {}
    try {
      const p = path.join(process.cwd(), 'config', 'facturas.config.json');
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p,'utf8'));
    } catch {}
    return { pv: 1, contadorFA:1, contadorFB:1, contadorNCA:1, contadorNCB:1, contadorNDA:1, contadorNDB:1 };
  }
  private saveConfig(cfg: any) {
    let p = '';
    try { p = path.join(app.getPath('userData'), 'config', 'facturas.config.json'); } catch {}
    if (!p) p = path.join(process.cwd(), 'config', 'facturas.config.json');
    try { fs.mkdirSync(path.dirname(p), { recursive: true }); } catch {}
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
  }

  private incrCounter(cfg: any, tipo: TipoDocumento) {
    const key = ('contador' + tipo) as keyof typeof cfg;
    cfg[key] = Number(cfg[key]||1) + 1;
  }

  async processFromFac(input: FacInput) {
    const raw = input.raw ?? this.readTextSmart(input.fullPath);
    const tipo = this.detectTipoFromFacContent(raw, path.basename(input.fullPath));
    if (!tipo) throw new Error('FAC no es tipo factura/nota A/B');

    // Parse mínimo (reutilizar patrón de recibo/remito)
    const lines = String(raw||'').split(/\r?\n/);
    const get = (k:string)=>{ const ln=lines.find(l=>l.startsWith(k)); return ln? ln.substring(k.length).trim():''; };
    const dia = get('DIAHORA:');
    let fechaISO = dayjs().format('YYYY-MM-DD');
    try { const m = dia.match(/(\d{2})\/(\d{2})\/(\d{2})/); if (m) fechaISO = `20${m[3]}-${m[2]}-${m[1]}`; } catch {}
    const clienteRaw = get('CLIENTE:');
    const nombre = clienteRaw.replace(/^\(\d+\)\s*/,'').trim();
    const domicilio = get('DOMICILIO:');
    const docTipo = Number(get('TIPODOC:')||'0');
    const docNro = get('NRODOC:');
    const condicionTxt = get('CONDICION:');
    const email = get('EMAIL:');
    const whatsapp = get('WHATSAPP:');

    // Totales consolidado (TOTALES:)
    const start = lines.findIndex(l=>l.trim()==='TOTALES:');
    let neto21=0, neto105=0, neto27=0, exento=0, iva21=0, iva105=0, iva27=0, total=0;
    if (start>=0){
      for (let i=start+1;i<lines.length;i++){
        const t = lines[i].trim();
        if (!t || /^(OBS\.|ITEM:|IP:|TIPO:|FONDO:|COPIAS:|CLIENTE:|TIPODOC:|NRODOC:|CONDICION:|IVARECEPTOR:|DOMICILIO:|MONEDA:|DIAHORA:|TOTALES:$)/.test(t)) break;
        const m = t.match(/^(NETO 21%|NETO 10\.5%|NETO 27%|EXENTO|IVA 21%|IVA 10\.5%|IVA 27%|TOTAL)\s*:\s*([\d\.,]+)$/i);
        if (!m) continue; const key=m[1].toUpperCase(); const val=Number(m[2].replace(/\./g,'').replace(',','.'));
        if (key==='NETO 21%') neto21=val; else if (key==='NETO 10.5%') neto105=val; else if (key==='NETO 27%') neto27=val; else if (key==='EXENTO') exento=val;
        else if (key==='IVA 21%') iva21=val; else if (key==='IVA 10.5%') iva105=val; else if (key==='IVA 27%') iva27=val; else if (key==='TOTAL') total=val;
      }
    }

    // Config y numeración
    const cfg = this.loadConfig();
    const pv = Number(cfg.pv || 1);
    const numero = Number(cfg['contador'+tipo] || 1);

    // Emisión AFIP/ARCA
    const params = {
      pto_vta: pv,
      tipo_cbte: this.mapTipoToCbte(tipo),
      fecha: fechaISO.replace(/-/g,''),
      total,
      neto: neto21+neto105+neto27,
      iva: iva21+iva105+iva27,
      empresa: {},
      cliente: { razon_social_receptor: nombre },
      cuit_receptor: docTipo===80? docNro: undefined,
      doc_tipo: docTipo || undefined,
      razon_social_receptor: nombre,
    } as any;
    const r = await this.svc.emitirFacturaYGenerarPdf(params);

    // Construcción de salida (Local/red) y PDF personalizado
    const numeroEmi = Number(r?.numero || 0);
    const cae = String(r?.cae || '');
    const caeVto = String(r?.caeVto || '');

    const makeMonthDir = (root?: string): string | null => {
      if (!root) return null;
      const venta = path.join(String(root), `Ventas_PV${pv}`);
      const yyyymm = dayjs(fechaISO).format('YYYYMM');
      const dir = path.join(venta, `F${yyyymm}`);
      try { fs.mkdirSync(dir, { recursive: true }); } catch {}
      return dir;
    };
    const outLocalDir = makeMonthDir(cfg.outLocal);
    if (!outLocalDir) throw new Error('Ruta Local no configurada para Facturas');
    const outRed1Dir = makeMonthDir(cfg.outRed1);
    const outRed2Dir = makeMonthDir(cfg.outRed2);

    const prefix = ((): string => {
      if (tipo==='FA') return 'FA'; if (tipo==='FB') return 'FB';
      if (tipo==='NCA') return 'NCA'; if (tipo==='NCB') return 'NCB';
      if (tipo==='NDA') return 'NDA'; return 'NDB';
    })();
    const letra = (tipo==='FA'||tipo==='NCA'||tipo==='NDA') ? 'A' : 'B';
    const literal = (tipo.startsWith('NC') ? 'NOTA DE CRÉDITO' : (tipo.startsWith('ND') ? 'NOTA DE DÉBITO' : 'FACTURA'));
    const pvStr = String(pv).padStart(4, '0');
    const nroNum = numeroEmi || Number(cfg['contador'+tipo] || 1);
    const nroStr = String(nroNum).padStart(8, '0');
    const fileName = `${prefix}_${pvStr}-${nroStr}.pdf`;
    const localOutPath = path.join(outLocalDir, fileName);

    // Resolver FONDO: buscar ruta absoluta o por nombre en templates empaquetado
    const fondoRaw = ((): string => {
      const m = lines.find(l => l.startsWith('FONDO:'));
      return m ? m.substring('FONDO:'.length).trim() : '';
    })();
    const resolveFondo = (src?: string): string | null => {
      if (!src) return null;
      const trimmed = String(src).trim().replace(/^"|"$/g,'');
      const tries: string[] = [];
      tries.push(trimmed);
      tries.push(trimmed.replace(/\\/g, path.sep).replace(/\//g, path.sep));
      tries.push(path.resolve(trimmed));
      try { const baseName = path.basename(trimmed); if (baseName) { tries.push(path.join(process.cwd(),'templates', baseName)); try { tries.push(path.join(app.getAppPath(),'templates', baseName)); } catch {} } } catch {}
      for (const pth of tries) { try { if (pth && fs.existsSync(pth)) return pth; } catch {} }
      return null;
    };
    const appBase = ((): string => { try { return app.getAppPath(); } catch { return process.cwd(); } })();
    const bgPath = resolveFondo(fondoRaw) || path.join(appBase, 'public', 'Noimage.jpg');

    // Datos para pdfRenderer
    const ivaPorAlicuota: any = {};
    if (iva21) ivaPorAlicuota['21'] = iva21;
    if (iva105) ivaPorAlicuota['10.5'] = iva105;
    if (iva27) ivaPorAlicuota['27'] = iva27;
    const data: any = {
      empresa: { pv, numero: nroNum },
      cliente: { nombre, domicilio, cuitDni: (docTipo===80? docNro: undefined) || docNro, condicionIva: condicionTxt },
      fecha: fechaISO,
      tipoComprobanteLetra: letra,
      tipoComprobanteLiteral: literal,
      netoGravado: neto21+neto105+neto27,
      ivaPorAlicuota,
      ivaTotal: iva21+iva105+iva27,
      total,
      cae,
      caeVto,
      items: [],
    };
    await generateInvoicePdf({ bgPath, outputPath: localOutPath, data, config: layoutMendoza, qrDataUrl: r?.qrDataUrl });

    // Copias a red
    try { if (outRed1Dir) fs.copyFileSync(localOutPath, path.join(outRed1Dir, fileName)); } catch {}
    try { if (outRed2Dir) fs.copyFileSync(localOutPath, path.join(outRed2Dir, fileName)); } catch {}

    // Email
    try { const to = (email||'').trim(); if (/.+@.+\..+/.test(to)) { const { sendReceiptEmail } = require('../../services/EmailService'); await sendReceiptEmail(to, localOutPath, { subject: literal, title: literal, intro: 'Adjuntamos el comprobante.', bodyHtml: '<p>Gracias por su preferencia.</p>' }); } } catch {}

    // WhatsApp
    try {
      const phone = (whatsapp||'').replace(/[^0-9]/g,'');
      if (phone) {
        const normalized = phone.startsWith('54') ? ('+'+phone) : ('+54'+phone);
        const stamp = dayjs().format('HHmmss'); const rand = Math.random().toString(36).slice(2,4);
        const wfaName = `wfa${stamp}${rand}.txt`; const wfaPath = path.join(outLocalDir, wfaName);
        fs.writeFileSync(wfaPath, [normalized, nombre, path.basename(localOutPath), 'Que tal, somos de Todo Computacion', 'Adjuntamos el comprobante.'].join('\n'), 'utf8');
        try { const { sendFilesToWhatsappFtp } = require('../../services/FtpService'); await sendFilesToWhatsappFtp([localOutPath, wfaPath],[path.basename(localOutPath), path.basename(wfaPath)]); try { fs.unlinkSync(wfaPath); } catch {} } catch {}
      }
    } catch {}

    // Impresión
    try { const copiesLine = lines.find(l=>l.startsWith('COPIAS:')); const copies = copiesLine? Number(copiesLine.substring('COPIAS:'.length).trim()||'0'):0; if (copies>0) { const { printPdf } = require('../../services/PrintService'); await printPdf(localOutPath, cfg.printerName, copies); } } catch {}

    // Generar .res con sufijo por letra (a/b)
    const suf = (letra === 'A') ? 'a' : 'b';
    let resPath: string | null = null;
    try {
      const dir = path.dirname(input.fullPath);
      const baseName = path.basename(input.fullPath, path.extname(input.fullPath));
      const shortLower = baseName.slice(-8).toLowerCase().replace(/.$/, suf);
      resPath = path.join(dir, `${shortLower}.res`);
      const fechaStr = dayjs().format('DD/MM/YYYY');
      const resLines = [
        'RESPUESTA AFIP    :',
        'CUIT EMPRESA      :',
        'MODO              : 0',
        `PUNTO DE VENTA    : ${String(pv).padStart(5,'0').slice(-5)}`,
        `NUMERO COMPROBANTE: ${String(nroNum).padStart(8,'0')}`,
        `FECHA COMPROBANTE : ${fechaStr}`,
        `NUMERO CAE        : ${cae}`,
        `VENCIMIENTO CAE   : ${caeVto || '0'}`,
        `ARCHIVO REFERENCIA: ${path.basename(input.fullPath)}`,
        `ARCHIVO PDF       : ${path.basename(localOutPath)}`,
        ''
      ];
      const joined = raw.replace(/\s*$/, '') + '\n' + resLines.join('\n');
      fs.writeFileSync(resPath, joined, 'utf8');
    } catch {}

    // Enviar .res por FTP y limpiar
    try { if (resPath && fs.existsSync(resPath)) { await sendArbitraryFile(resPath, path.basename(resPath)); try { fs.unlinkSync(resPath); } catch {} try { fs.unlinkSync(input.fullPath); } catch {} } } catch {}

    // Incrementar y persistir contador
    this.incrCounter(cfg, tipo); this.saveConfig(cfg);
    return { pdfPath: localOutPath, numero: nroNum, cae, caeVto };
  }
}
