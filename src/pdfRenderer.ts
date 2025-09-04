import fs from 'fs';
import PDFDocument from 'pdfkit';

export const mm = (valueInMillimeters: number): number => (valueInMillimeters * 72) / 25.4;

export type Align = 'left' | 'right' | 'center';

export interface TextOpts {
  fontSize?: number;
  bold?: boolean;
  align?: Align;
  maxWidth?: number; // en mm
}

export interface Cell {
  text: string;
  x: number; // mm (inicio de la celda)
  width: number; // mm (ancho de la celda)
  align?: Align;
  fontSize?: number;
  bold?: boolean;
}

export interface Config {
  pageSize?: 'A4';
  coords: {
    // Letra del comprobante (A/B/C) en el recuadro central superior
    comprobanteLetra?: { x: number; y: number; fontSize?: number };

    clienteNombre: { x: number; y: number; fontSize?: number };
    clienteDomicilio: { x: number; y: number; fontSize?: number };
    clienteCuit: { x: number; y: number; fontSize?: number };
    clienteIva: { x: number; y: number; fontSize?: number };

    // Fecha/hora
    fecha: { x: number; y: number; fontSize?: number };
    fechaHora?: { x: number; y: number; fontSize?: number };
    pv: { x: number; y: number; fontSize?: number };
    nro: { x: number; y: number; fontSize?: number };

    atendio?: { x: number; y: number; fontSize?: number };
    condicionPago?: { x: number; y: number; fontSize?: number };

    // Extra encabezado (opcionales)
    referenciaInterna?: { x: number; y: number; fontSize?: number };
    notaRecepcion?: { x: number; y: number; fontSize?: number };
    remito?: { x: number; y: number; fontSize?: number };
    email?: { x: number; y: number; fontSize?: number };
    observaciones?: { x: number; y: number; maxWidth?: number; fontSize?: number };

    itemsStartY: number; // mm
    itemsRowHeight: number; // mm
    itemsFontSize?: number; // tamaño base para filas de items
    cols: {
      cant: { x: number; w: number };
      desc: { x: number; w: number };
      unit: { x: number; w: number };
      alic: { x: number; w: number };
      total: { x: number; w: number };
    };

    // Totales discriminados
    neto: { x: number; y: number; fontSize?: number }; // neto gravado total
    neto21?: { x: number; y: number; fontSize?: number };
    neto105?: { x: number; y: number; fontSize?: number };
    neto27?: { x: number; y: number; fontSize?: number };
    iva21?: { x: number; y: number; fontSize?: number };
    iva105?: { x: number; y: number; fontSize?: number };
    iva27?: { x: number; y: number; fontSize?: number };
    impIvaTotal: { x: number; y: number; fontSize?: number };
    total: { x: number; y: number; fontSize?: number };

    // Total en letras
    totalEnLetras?: { x: number; y: number; maxWidth?: number; fontSize?: number };

    cae: { x: number; y: number; fontSize?: number };
    caeVto: { x: number; y: number; fontSize?: number };

    qr: { x: number; y: number; size: number }; // mm

    // Textos legales / pie
    legalDefensaConsumidor?: { x: number; y: number; maxWidth?: number; fontSize?: number };
    legalGracias?: { x: number; y: number; maxWidth?: number; fontSize?: number };
    legalContacto?: { x: number; y: number; maxWidth?: number; fontSize?: number };
  };
}

export type Item = {
  descripcion: string;
  cantidad: number;
  unitario: number;
  iva: number; // 21 | 10.5 | 27 | 0
  total?: number; // cantidad * unitario (si no viene, se calcula)
};

export type InvoiceData = {
  empresa: {
    nombre?: string;
    cuit: string;
    pv: number;
    numero: number;
  };
  cliente: {
    nombre: string;
    domicilio?: string;
    cuitDni?: string;
    condicionIva?: string;
  };
  fecha: string; // YYYY-MM-DD
  fechaHora?: string; // YYYY-MM-DD HH:mm (opcional)
  tipoComprobanteLetra?: string; // A | B | C
  atendio?: string;
  condicionPago?: string;
  referenciaInterna?: string;
  notaRecepcion?: string;
  remito?: string;
  email?: string;
  observaciones?: string;

  items: Item[];

  netoGravado: number;
  netoPorAlicuota?: { [ali: string]: number }; // { "21": 0, "10.5": 0, "27": 0 }
  ivaPorAlicuota: { [ali: string]: number };
  ivaTotal: number;
  total: number;

  cae: string;
  caeVto: string; // YYYY-MM-DD
};

function formatNumberEsAr(value: number): string {
  return (value ?? 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function numeroALetras(num: number): string {
  // Conversión simple a letras en castellano (ARS)
  // Soporta hasta millones; suficiente para facturas comunes
  const unidades = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = [
    '',
    'DIEZ',
    'VEINTE',
    'TREINTA',
    'CUARENTA',
    'CINCUENTA',
    'SESENTA',
    'SETENTA',
    'OCHENTA',
    'NOVENTA',
  ];
  const especiales: { [k: number]: string } = {
    11: 'ONCE',
    12: 'DOCE',
    13: 'TRECE',
    14: 'CATORCE',
    15: 'QUINCE',
  };
  const centenas = [
    '',
    'CIEN',
    'DOSCIENTOS',
    'TRESCIENTOS',
    'CUATROCIENTOS',
    'QUINIENTOS',
    'SEISCIENTOS',
    'SETECIENTOS',
    'OCHOCIENTOS',
    'NOVECIENTOS',
  ];

  function seccion(n: number): string {
    if (n === 0) return '';
    if (n < 10) return unidades[n];
    if (n > 10 && n < 16) return especiales[n];
    if (n < 20) return 'DIECI' + unidades[n - 10].toLowerCase();
    if (n === 20) return 'VEINTE';
    if (n > 20 && n < 30) return 'VEINTI' + unidades[n - 20].toLowerCase();
    if (n < 100) {
      const d = Math.floor(n / 10);
      const u = n % 10;
      return u ? `${decenas[d]} Y ${unidades[u]}` : decenas[d];
    }
    if (n === 100) return 'CIEN';
    if (n < 1000) {
      const c = Math.floor(n / 100);
      const r = n % 100;
      const cc = centenas[c];
      return r ? `${cc} ${seccion(r)}` : cc;
    }
    return '';
  }

  function miles(n: number): string {
    if (n < 1000) return seccion(n);
    const m = Math.floor(n / 1000);
    const r = n % 1000;
    const mtxt = m === 1 ? 'MIL' : `${seccion(m)} MIL`;
    return r ? `${mtxt} ${seccion(r)}` : mtxt;
  }

  function millones(n: number): string {
    if (n < 1000000) return miles(n);
    const mm = Math.floor(n / 1000000);
    const r = n % 1000000;
    const mmtxt = mm === 1 ? 'UN MILLON' : `${seccion(mm)} MILLONES`;
    return r ? `${mmtxt} ${miles(r)}` : mmtxt;
  }

  const entero = Math.floor(Math.abs(num));
  const dec = Math.round((Math.abs(num) - entero) * 100);
  const letras = entero === 0 ? 'CERO' : millones(entero);
  const fraccion = dec.toString().padStart(2, '0');
  return `${letras} CON ${fraccion}/100`;
}

function drawLabelValue(
  docText: (text: string, xMM: number, yMM: number, opts?: TextOpts) => void,
  label: string,
  value: string | undefined,
  xMM: number,
  yMM: number,
  opts: TextOpts = {},
) {
  if (!value) return;
  const full = `${label}: ${value}`;
  docText(full, xMM, yMM, opts);
}

export async function generateInvoicePdf({
  bgPath,
  outputPath,
  data,
  qrDataUrl,
  config,
}: {
  bgPath: string;
  outputPath: string;
  data: InvoiceData;
  qrDataUrl?: string | Buffer;
  config: Config;
}) {
  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  const pageW = doc.page.width;
  const pageH = doc.page.height;

  // Fondo a página completa
  doc.image(bgPath, 0, 0, { width: pageW, height: pageH });

  // Fuentes (usar Helvetica por defecto si no se registran TTF)
  const fontRegularRegistered = false;
  const fontBoldRegistered = false;

  function setFont(bold?: boolean) {
    if (!fontRegularRegistered && !fontBoldRegistered) {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica');
    } else {
      doc.font(bold ? 'B' : 'R');
    }
  }

  function drawText(text: string, xMM: number, yMM: number, opts: TextOpts = {}) {
    const { fontSize = 10, bold, align = 'left', maxWidth } = opts;
    setFont(bold);
    doc.fontSize(fontSize);
    const x = mm(xMM);
    const y = mm(yMM);
    const width = maxWidth ? mm(maxWidth) : undefined;
    doc.text(text ?? '', x, y, { width, align });
  }

  function drawNumber(value: number, xRightMM: number, yMM: number, opts: TextOpts = {}) {
    const text = formatNumberEsAr(value);
    drawText(text, xRightMM, yMM, { ...opts, align: opts.align ?? 'right' });
  }

  function drawImage(img: string | Buffer, xMM: number, yMM: number, wMM?: number) {
    const x = mm(xMM);
    const y = mm(yMM);
    const opt: any = {};
    if (wMM) opt.width = mm(wMM);
    doc.image(img as any, x, y, opt);
  }

  function drawRow(cells: Cell[], yMM: number) {
    for (const cell of cells) {
      const { text, x, width, align = 'left', fontSize = 9, bold } = cell;
      drawText(text, x, yMM, { align, fontSize, bold, maxWidth: width });
    }
  }

  const c = config.coords;

  // Letra del comprobante
  if (data.tipoComprobanteLetra && c.comprobanteLetra) {
    drawText(
      data.tipoComprobanteLetra,
      c.comprobanteLetra.x,
      c.comprobanteLetra.y,
      { fontSize: c.comprobanteLetra.fontSize ?? 26, bold: true, align: 'center' },
    );
  }

  // Encabezado / Cliente
  drawText(data.cliente.nombre, c.clienteNombre.x, c.clienteNombre.y, {
    fontSize: c.clienteNombre.fontSize ?? 10,
    bold: true,
    maxWidth: 90,
  });
  if (data.cliente.domicilio) {
    drawText(data.cliente.domicilio, c.clienteDomicilio.x, c.clienteDomicilio.y, {
      fontSize: c.clienteDomicilio.fontSize ?? 9,
      maxWidth: 90,
    });
  }
  if (data.cliente.cuitDni)
    drawText(data.cliente.cuitDni, c.clienteCuit.x, c.clienteCuit.y, { fontSize: c.clienteCuit.fontSize ?? 9 });
  if (data.cliente.condicionIva)
    drawText(data.cliente.condicionIva, c.clienteIva.x, c.clienteIva.y, { fontSize: c.clienteIva.fontSize ?? 9 });

  // Encabezado / Comprobante
  const fechaMostrar = (data.fechaHora || data.fecha) as string;
  if (c.fechaHora) {
    drawText(fechaMostrar, c.fechaHora.x, c.fechaHora.y, { fontSize: c.fechaHora.fontSize ?? 10 });
  } else {
    drawText(fechaMostrar, c.fecha.x, c.fecha.y, { fontSize: c.fecha.fontSize ?? 10 });
  }
  drawText(String(data.empresa.pv).padStart(4, '0'), c.pv.x, c.pv.y, { fontSize: c.pv.fontSize ?? 10, bold: true });
  drawText(String(data.empresa.numero).padStart(8, '0'), c.nro.x, c.nro.y, { fontSize: c.nro.fontSize ?? 10, bold: true });

  if (data.atendio && c.atendio)
    drawText(data.atendio, c.atendio.x, c.atendio.y, { fontSize: c.atendio.fontSize ?? 9 });
  if (data.condicionPago && c.condicionPago)
    drawText(data.condicionPago, c.condicionPago.x, c.condicionPago.y, { fontSize: c.condicionPago.fontSize ?? 9 });

  // Campos opcionales extra del encabezado
  if (c.referenciaInterna)
    drawLabelValue(drawText, 'REF', data.referenciaInterna, c.referenciaInterna.x, c.referenciaInterna.y, {
      fontSize: c.referenciaInterna.fontSize ?? 9,
    });
  if (c.notaRecepcion)
    drawLabelValue(drawText, 'RECEP', data.notaRecepcion, c.notaRecepcion.x, c.notaRecepcion.y, {
      fontSize: c.notaRecepcion.fontSize ?? 9,
    });
  if (c.remito)
    drawLabelValue(drawText, 'REMITO', data.remito, c.remito.x, c.remito.y, { fontSize: c.remito.fontSize ?? 9 });
  if (c.email)
    drawLabelValue(drawText, 'EMAIL', data.email, c.email.x, c.email.y, { fontSize: c.email.fontSize ?? 9 });
  if (c.observaciones && data.observaciones)
    drawText(data.observaciones, c.observaciones.x, c.observaciones.y, {
      fontSize: c.observaciones.fontSize ?? 9,
      maxWidth: c.observaciones.maxWidth,
    });

  // Detalle de ítems
  let rowY = c.itemsStartY;
  const rowHeight = c.itemsRowHeight;
  const itemsFontSize = c.itemsFontSize ?? 9;
  for (const it of data.items) {
    const total = typeof it.total === 'number' ? it.total : it.cantidad * it.unitario;
    drawRow(
      [
        { text: String(it.cantidad), x: c.cols.cant.x, width: c.cols.cant.w, align: 'center', fontSize: itemsFontSize },
        { text: it.descripcion, x: c.cols.desc.x, width: c.cols.desc.w, align: 'left', fontSize: itemsFontSize },
        { text: formatNumberEsAr(it.unitario), x: c.cols.unit.x, width: c.cols.unit.w, align: 'right', fontSize: itemsFontSize },
        { text: `${it.iva}%`, x: c.cols.alic.x, width: c.cols.alic.w, align: 'center', fontSize: itemsFontSize },
        { text: formatNumberEsAr(total), x: c.cols.total.x, width: c.cols.total.w, align: 'right', fontSize: itemsFontSize },
      ],
      rowY,
    );
    rowY += rowHeight;
  }

  // Totales
  drawNumber(data.netoGravado, c.neto.x, c.neto.y, { fontSize: c.neto.fontSize ?? 10, bold: true });

  const iva21 = data.ivaPorAlicuota['21'] || 0;
  const iva105 = data.ivaPorAlicuota['10.5'] || data.ivaPorAlicuota['10,5'] || 0;
  const iva27 = data.ivaPorAlicuota['27'] || 0;

  const neto21 = (data.netoPorAlicuota && (data.netoPorAlicuota['21'] || 0)) || undefined;
  const neto105 = (data.netoPorAlicuota && (data.netoPorAlicuota['10.5'] || data.netoPorAlicuota['10,5'] || 0)) || undefined;
  const neto27 = (data.netoPorAlicuota && (data.netoPorAlicuota['27'] || 0)) || undefined;

  if (c.neto21 && typeof neto21 === 'number') drawNumber(neto21, c.neto21.x, c.neto21.y, { fontSize: c.neto21.fontSize ?? 9 });
  if (c.neto105 && typeof neto105 === 'number') drawNumber(neto105, c.neto105.x, c.neto105.y, { fontSize: c.neto105.fontSize ?? 9 });
  if (c.neto27 && typeof neto27 === 'number') drawNumber(neto27, c.neto27.x, c.neto27.y, { fontSize: c.neto27.fontSize ?? 9 });

  if (c.iva21) drawNumber(iva21, c.iva21.x, c.iva21.y, { fontSize: c.iva21.fontSize ?? 9 });
  if (c.iva105) drawNumber(iva105, c.iva105.x, c.iva105.y, { fontSize: c.iva105.fontSize ?? 9 });
  if (c.iva27) drawNumber(iva27, c.iva27.x, c.iva27.y, { fontSize: c.iva27.fontSize ?? 9 });

  drawNumber(data.ivaTotal, c.impIvaTotal.x, c.impIvaTotal.y, { fontSize: c.impIvaTotal.fontSize ?? 10 });
  drawNumber(data.total, c.total.x, c.total.y, { fontSize: c.total.fontSize ?? 12, bold: true });

  if (c.totalEnLetras) {
    drawText(`SON PESOS: ${numeroALetras(data.total)}`, c.totalEnLetras.x, c.totalEnLetras.y, {
      fontSize: c.totalEnLetras.fontSize ?? 9,
      bold: true,
      maxWidth: c.totalEnLetras.maxWidth,
    });
  }

  // CAE
  drawText(`CAE Nº ${data.cae}`.trim(), c.cae.x, c.cae.y, { fontSize: c.cae.fontSize ?? 10, bold: true });
  drawText(data.caeVto, c.caeVto.x, c.caeVto.y, { fontSize: c.caeVto.fontSize ?? 9 });

  // QR
  if (qrDataUrl) {
    let buf: Buffer;
    if (typeof qrDataUrl === 'string') {
      const base64 = qrDataUrl.replace(/^data:image\/\w+;base64,/, '');
      buf = Buffer.from(base64, 'base64');
    } else {
      buf = qrDataUrl;
    }
    drawImage(buf, c.qr.x, c.qr.y, c.qr.size);
  }

  // Textos legales / pie
  if (c.legalDefensaConsumidor)
    drawText(
      'DEFENSA DEL CONSUMIDOR: Para reclamos, consulte en www.argentina.gob.ar/defensadelconsumidor',
      c.legalDefensaConsumidor.x,
      c.legalDefensaConsumidor.y,
      { fontSize: c.legalDefensaConsumidor.fontSize ?? 7, maxWidth: c.legalDefensaConsumidor.maxWidth },
    );
  if (c.legalGracias)
    drawText('Gracias por su compra.', c.legalGracias.x, c.legalGracias.y, {
      fontSize: c.legalGracias.fontSize ?? 9,
      maxWidth: c.legalGracias.maxWidth,
    });
  if (c.legalContacto)
    drawText('Contacto: (261) 555-0000  -  www.tcmza.com.ar  -  soporte@tcmza.com.ar', c.legalContacto.x, c.legalContacto.y, {
      fontSize: c.legalContacto.fontSize ?? 8,
      maxWidth: c.legalContacto.maxWidth,
    });

  doc.end();
  await new Promise<void>((resolve) => stream.on('finish', () => resolve()));
  return { ok: true, outputPath };
}

export async function generateCalibrationPdf(bgPath: string, outputPath: string, opts?: {
  rectWidthMM?: number;
  rectHeightMM?: number;
  // Permitir pasar un layout alternativo si se desea
  config?: Config;
}) {
  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  doc.image(bgPath, 0, 0, { width: pageW, height: pageH });

  const rectWDefault = mm(opts?.rectWidthMM ?? 40);
  const rectHDefault = mm(opts?.rectHeightMM ?? 6);

  const cfg = opts?.config;
  const coords = (cfg ? cfg.coords : undefined) || ({} as any);

  // Si no se pasó config, intentar cargar el layout por defecto dinámicamente
  // Nota: import dinámico para evitar ciclo en tiempo de compilación
  if (!cfg) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const defaultLayout: { default?: Config; coords?: Config['coords'] } = require('./invoiceLayout.mendoza');
      const usable = (defaultLayout.default as Config) || (defaultLayout as unknown as Config);
      Object.assign(coords, usable.coords);
    } catch {
      // sin layout, no dibujamos nada
    }
  }

  doc.strokeColor('red').lineWidth(0.5);
  doc.fontSize(6).fillColor('red');

  const entries = Object.entries(coords) as Array<[string, any]>;
  for (const [key, pos] of entries) {
    if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') continue;
    const x = mm(pos.x);
    const y = mm(pos.y);
    const isQr = key.toLowerCase() === 'qr' && typeof pos.size === 'number';
    const rectW = isQr ? mm(pos.size) : rectWDefault;
    const rectH = isQr ? mm(pos.size) : rectHDefault;
    doc.rect(x, y, rectW, rectH).stroke();
    doc.text(key, x + mm(1), y + mm(1), { width: rectW - mm(2) });
  }

  doc.end();
  await new Promise<void>((resolve) => stream.on('finish', () => resolve()));
}


