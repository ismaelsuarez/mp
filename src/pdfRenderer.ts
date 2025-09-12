import fs from 'fs';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

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
  
  // Configuración de página
  page?: {
    width: number; // mm
    height: number; // mm
    margins: {
      top: number;
      bottom: number;
      left: number;
      right: number;
    };
  };
  
  coords: {
    // Información de la Empresa
    empresaNombre?: { x: number; y: number; fontSize?: number };
    empresaDomicilio?: { x: number; y: number; fontSize?: number };
    empresaCuit?: { x: number; y: number; fontSize?: number };
    empresaIva?: { x: number; y: number; fontSize?: number };
    empresaInscripcion?: { x: number; y: number; fontSize?: number };

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
    numero?: { x: number; y: number; fontSize?: number };
    tipoComprobante?: { x: number; y: number; fontSize?: number }; // Tipo de comprobante

    atendio?: { x: number; y: number; fontSize?: number };
    condicionPago?: { x: number; y: number; fontSize?: number };

    // Información Adicional
    hora?: { x: number; y: number; fontSize?: number }; // Hora de emisión
    moneda?: { x: number; y: number; fontSize?: number };
    cotizacion?: { x: number; y: number; fontSize?: number };
    formaPago?: { x: number; y: number; fontSize?: number };

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

    // Subtotales por Alícuota
    subtotal21?: { x: number; y: number; fontSize?: number };
    subtotal105?: { x: number; y: number; fontSize?: number };
    subtotal27?: { x: number; y: number; fontSize?: number };

         // Totales discriminados
     neto: { x: number; y: number; fontSize?: number }; // neto gravado total
     netoLabel?: { x: number; y: number; fontSize?: number }; // etiqueta "Neto:"
     neto21?: { x: number; y: number; fontSize?: number };
     neto21Label?: { x: number; y: number; fontSize?: number }; // etiqueta "Neto 21%:"
     neto105?: { x: number; y: number; fontSize?: number };
     neto105Label?: { x: number; y: number; fontSize?: number }; // etiqueta "Neto 10.5%:"
     neto27?: { x: number; y: number; fontSize?: number };
     neto27Label?: { x: number; y: number; fontSize?: number }; // etiqueta "Neto 27%:"
     iva21?: { x: number; y: number; fontSize?: number };
     iva21Label?: { x: number; y: number; fontSize?: number }; // etiqueta "IVA 21%:"
     iva105?: { x: number; y: number; fontSize?: number };
     iva105Label?: { x: number; y: number; fontSize?: number }; // etiqueta "IVA 10.5%:"
     iva27?: { x: number; y: number; fontSize?: number };
     iva27Label?: { x: number; y: number; fontSize?: number }; // etiqueta "IVA 27%:"
     impIvaTotal: { x: number; y: number; fontSize?: number };
     impIvaTotalLabel?: { x: number; y: number; fontSize?: number }; // etiqueta "IVA Total:"
     total: { x: number; y: number; fontSize?: number };
     totalLabel?: { x: number; y: number; fontSize?: number }; // etiqueta "TOTAL:"

    // Total en letras
    totalEnLetras?: { x: number; y: number; maxWidth?: number; fontSize?: number };

    cae: { x: number; y: number; fontSize?: number };
    caeVto: { x: number; y: number; fontSize?: number };

    qrCode?: { x: number; y: number; size: number };

    // Textos legales / pie
    legalDefensaConsumidor?: { x: number; y: number; maxWidth?: number; fontSize?: number };
    legalGracias?: { x: number; y: number; maxWidth?: number; fontSize?: number };
    legalContacto?: { x: number; y: number; maxWidth?: number; fontSize?: number };
    // Observaciones dinámicas de pie (desde OBS.PIE)
    pieObservaciones?: { x: number; y: number; maxWidth?: number; fontSize?: number };
    // Observaciones fiscales dinámicas (OBS.FISCAL)
    obsFiscal?: { x: number; y: number; maxWidth?: number; fontSize?: number; maxChars?: number };
  };

  // Validación de campos requeridos
  validation?: {
    requiredFields: string[];
    maxWidth: number;
    maxHeight: number;
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
    domicilio?: string;
    cuit: string;
    condicionIva?: string;
    inscripcion?: string;
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
  hora?: string; // HH:mm - Hora de emisión
  fechaHora?: string; // YYYY-MM-DD HH:mm (opcional)
  tipoComprobanteLetra?: string; // A | B | C | NC | ND | R (se mantiene por compatibilidad)
  tipoComprobanteLiteral?: string; // Si se setea, se imprime tal cual (ej: "RECIBO")
  mipymeModo?: 'ADC' | 'SCA';
  atendio?: string;
  condicionPago?: string;
  referenciaInterna?: string;
  notaRecepcion?: string;
  remito?: string;
  email?: string;
  observaciones?: string;
  // Observaciones dinámicas del pie de página (p.ej. OBS.PIE)
  pieObservaciones?: string;
  // Observaciones fiscales (nuevo OBS.FISCAL)
  fiscal?: string;

  // Información adicional
  moneda?: string;
  cotizacion?: number;
  formaPago?: string;

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

// Función para generar QR code
async function generateQRCode(data: string): Promise<Buffer> {
  try {
    const buffer = await QRCode.toBuffer(data, {
      type: 'image/png',
      width: 300, // Aumentar tamaño para mejor calidad
      margin: 2,  // Margen más pequeño
      color: {
        dark: '#000000',  // Negro puro
        light: '#FFFFFF'  // Blanco puro
      },
      errorCorrectionLevel: 'M' // Nivel medio de corrección
    });
    return buffer;
  } catch (error) {
    // Retornar un buffer vacío si falla
    return Buffer.alloc(0);
  }
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
  const doc = new PDFDocument({ 
    size: 'A4', 
    margin: 0,
    font: 'Helvetica' // Fuente original que funcionaba
  });
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
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica'); // Fuente original que funcionaba
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
      data.mipymeModo ? `FCE ${data.tipoComprobanteLetra}` : data.tipoComprobanteLetra,
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
    // Formatear fecha en formato argentino DD/MM/YYYY
    const fechaObj = new Date(data.fecha);
    const fechaFormateada = fechaObj.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    drawText(`Fecha: ${fechaFormateada}`, c.fecha.x, c.fecha.y, { fontSize: c.fecha.fontSize ?? 10 });
  }
  
  // Tipo de comprobante (Factura, Nota de Crédito, Remito, etc.)
  if (c.tipoComprobante) {
    const tipoTexto = data.tipoComprobanteLiteral ? data.tipoComprobanteLiteral : (
      data.mipymeModo ? `FACTURA DE CRÉDITO MiPyME – Modo: ${data.mipymeModo}` :
      data.tipoComprobanteLetra === 'A' ? 'FACTURA' :
      data.tipoComprobanteLetra === 'B' ? 'FACTURA' :
      data.tipoComprobanteLetra === 'C' ? 'FACTURA' :
      data.tipoComprobanteLetra === 'NC' ? 'NOTA DE CRÉDITO' :
      data.tipoComprobanteLetra === 'ND' ? 'NOTA DE DÉBITO' :
      data.tipoComprobanteLetra === 'R' ? 'REMITO' :
      'COMPROBANTE'
    );
    drawText(tipoTexto, c.tipoComprobante.x, c.tipoComprobante.y, { 
      fontSize: c.tipoComprobante.fontSize ?? 10, 
      bold: true 
    });
  }
  
  // Número de comprobante en formato "N° 0016 - 00009207"
  const numeroComprobante = `N° ${String(data.empresa.pv).padStart(4, '0')} - ${String(data.empresa.numero).padStart(8, '0')}`;
  drawText(numeroComprobante, c.pv.x, c.pv.y, { fontSize: c.pv.fontSize ?? 10, bold: true });
  
  // Ya no necesitamos dibujar pv y nro por separado
  // drawText(String(data.empresa.pv).padStart(4, '0'), c.pv.x, c.pv.y, { fontSize: c.pv.fontSize ?? 10, bold: true });
  // drawText(String(data.empresa.numero).padStart(8, '0'), c.nro.x, c.nro.y, { fontSize: c.nro.fontSize ?? 10, bold: true });

  if (c.atendio) {
    const atendioValue = (data.atendio || '').replace(/^Atendio:\s*/i, '').trim();
    drawText(`Atendio: ${atendioValue}`, c.atendio.x, c.atendio.y, { fontSize: c.atendio.fontSize ?? 9 });
  }
  if (c.hora) {
    const horaValue = (data.hora || '').replace(/^Hora:\s*/i, '').trim();
    drawText(`Hora: ${horaValue}`, c.hora.x, c.hora.y, { fontSize: c.hora.fontSize ?? 9 });
  }
  if (c.condicionPago) {
    drawText(`Pago: ${data.condicionPago || ''}`, c.condicionPago.x, c.condicionPago.y, { fontSize: c.condicionPago.fontSize ?? 9 });
  }

  // Campos opcionales extra del encabezado
  if (c.referenciaInterna)
    drawLabelValue(drawText, 'Ref.Interna', data.referenciaInterna, c.referenciaInterna.x, c.referenciaInterna.y, {
      fontSize: c.referenciaInterna.fontSize ?? 9,
    });
  if (c.notaRecepcion)
    drawLabelValue(drawText, 'RECEP', data.notaRecepcion, c.notaRecepcion.x, c.notaRecepcion.y, {
      fontSize: c.notaRecepcion.fontSize ?? 9,
    });
  if (c.remito)
    drawLabelValue(drawText, 'REMITO', data.remito, c.remito.x, c.remito.y, { fontSize: c.remito.fontSize ?? 9 });
  if (c.email) {
    drawText(`Mail: ${data.email || ''}`, c.email.x, c.email.y, { fontSize: c.email.fontSize ?? 9 });
  }
  if (c.observaciones && data.observaciones)
    drawText(data.observaciones, c.observaciones.x, c.observaciones.y, {
      fontSize: c.observaciones.fontSize ?? 9,
      maxWidth: c.observaciones.maxWidth,
    });

  // Detalle de ítems
  let rowY = c.itemsStartY;
  const rowHeight = c.itemsRowHeight;
  const itemsFontSize = c.itemsFontSize ?? 9;
  const isReciboItems = (data.tipoComprobanteLiteral || '').toUpperCase() === 'RECIBO';
  for (const it of data.items) {
    const total = typeof it.total === 'number' ? it.total : it.cantidad * it.unitario;
    const cells = isReciboItems
      ? [
          { text: String(it.cantidad), x: c.cols.cant.x, width: c.cols.cant.w, align: 'center', fontSize: itemsFontSize },
          { text: it.descripcion, x: c.cols.desc.x, width: c.cols.desc.w, align: 'left', fontSize: itemsFontSize },
          { text: formatNumberEsAr(total), x: c.cols.total.x, width: c.cols.total.w, align: 'right', fontSize: itemsFontSize },
        ]
      : [
          { text: String(it.cantidad), x: c.cols.cant.x, width: c.cols.cant.w, align: 'center', fontSize: itemsFontSize },
          { text: it.descripcion, x: c.cols.desc.x, width: c.cols.desc.w, align: 'left', fontSize: itemsFontSize },
          { text: formatNumberEsAr(it.unitario), x: c.cols.unit.x, width: c.cols.unit.w, align: 'right', fontSize: itemsFontSize },
          { text: `${it.iva}%`, x: c.cols.alic.x, width: c.cols.alic.w, align: 'center', fontSize: itemsFontSize },
          { text: formatNumberEsAr(total), x: c.cols.total.x, width: c.cols.total.w, align: 'right', fontSize: itemsFontSize },
        ];
    drawRow(cells as any, rowY);
    rowY += rowHeight;
  }

  // Totales - Dibujar etiquetas y valores por separado (como en el sistema viejo)
  console.log('🔍 DEBUG NETO:', { x: c.neto.x, y: c.neto.y, value: data.netoGravado });
  console.log('🔍 DEBUG NETO - Coordenadas convertidas:', { x: mm(c.neto.x), y: mm(c.neto.y) });
  const isRecibo = (data.tipoComprobanteLiteral || '').toUpperCase() === 'RECIBO';
  const hasValue = (n?: number) => typeof n === 'number' && Math.abs(n) > 0.000001;

  // Dibujar etiqueta y valor por separado
  if (!isRecibo || hasValue(data.netoGravado)) {
    if (c.netoLabel) {
      drawText('Neto:', c.netoLabel.x, c.netoLabel.y, { fontSize: c.netoLabel.fontSize ?? 9 });
    }
    drawText(formatNumberEsAr(data.netoGravado), c.neto.x, c.neto.y, { fontSize: c.neto.fontSize ?? 10, bold: true });
  }

  const iva21 = data.ivaPorAlicuota['21'] || 0;
  const iva105 = data.ivaPorAlicuota['10.5'] || data.ivaPorAlicuota['10,5'] || 0;
  const iva27 = data.ivaPorAlicuota['27'] || 0;

  const neto21 = (data.netoPorAlicuota && (data.netoPorAlicuota['21'] || 0)) || undefined;
  const neto105 = (data.netoPorAlicuota && (data.netoPorAlicuota['10.5'] || data.netoPorAlicuota['10,5'] || 0)) || undefined;
  const neto27 = (data.netoPorAlicuota && (data.netoPorAlicuota['27'] || 0)) || undefined;

  if (c.neto21 && typeof neto21 === 'number' && (!isRecibo || hasValue(neto21))) {
    console.log('🔍 DEBUG NETO21:', { x: c.neto21.x, y: c.neto21.y, value: neto21 });
    if (c.neto21Label) {
      drawText('Neto 21%:', c.neto21Label.x, c.neto21Label.y, { fontSize: c.neto21Label.fontSize ?? 9 });
    }
    drawText(formatNumberEsAr(neto21), c.neto21.x, c.neto21.y, { fontSize: c.neto21.fontSize ?? 9 });
  }
  if (c.neto105 && typeof neto105 === 'number' && (!isRecibo || hasValue(neto105))) {
    console.log('🔍 DEBUG NETO105:', { x: c.neto105.x, y: c.neto105.y, value: neto105 });
    if (c.neto105Label) {
      drawText('Neto 10.5%:', c.neto105Label.x, c.neto105Label.y, { fontSize: c.neto105Label.fontSize ?? 9 });
    }
    drawText(formatNumberEsAr(neto105), c.neto105.x, c.neto105.y, { fontSize: c.neto105.fontSize ?? 9 });
  }
  if (c.neto27 && typeof neto27 === 'number' && (!isRecibo || hasValue(neto27))) {
    console.log('🔍 DEBUG NETO27:', { x: c.neto27.x, y: c.neto27.y, value: neto27 });
    if (c.neto27Label) {
      drawText('Neto 27%:', c.neto27Label.x, c.neto27Label.y, { fontSize: c.neto27.fontSize ?? 9 });
    }
    drawText(formatNumberEsAr(neto27), c.neto27.x, c.neto27.y, { fontSize: c.neto27.fontSize ?? 9 });
  }

  if (c.iva21 && (!isRecibo || hasValue(iva21))) {
    if (c.iva21Label) {
      drawText('IVA 21%:', c.iva21Label.x, c.iva21Label.y, { fontSize: c.iva21Label.fontSize ?? 9 });
    }
    drawText(formatNumberEsAr(iva21), c.iva21.x, c.iva21.y, { fontSize: c.iva21.fontSize ?? 9 });
  }
  if (c.iva105 && (!isRecibo || hasValue(iva105))) {
    if (c.iva105Label) {
      drawText('IVA 10.5%:', c.iva105Label.x, c.iva105Label.y, { fontSize: c.iva105Label.fontSize ?? 9 });
    }
    drawText(formatNumberEsAr(iva105), c.iva105.x, c.iva105.y, { fontSize: c.iva105.fontSize ?? 9 });
  }
  if (c.iva27 && (!isRecibo || hasValue(iva27))) {
    if (c.iva27Label) {
      drawText('IVA 27%:', c.iva27Label.x, c.iva27Label.y, { fontSize: c.iva27Label.fontSize ?? 9 });
    }
    drawText(formatNumberEsAr(iva27), c.iva27.x, c.iva27.y, { fontSize: c.iva27.fontSize ?? 9 });
  }

  if (!isRecibo || hasValue(data.ivaTotal)) {
    if (c.impIvaTotalLabel) {
      drawText('IVA Total:', c.impIvaTotalLabel.x, c.impIvaTotalLabel.y, { fontSize: c.impIvaTotalLabel.fontSize ?? 9 });
    }
    drawText(formatNumberEsAr(data.ivaTotal), c.impIvaTotal.x, c.impIvaTotal.y, { fontSize: c.impIvaTotal.fontSize ?? 10 });
  }
  // OBS.FISCAL: debajo del Total
  if (c.obsFiscal && data.fiscal) {
    let fiscalText = data.fiscal;
    const maxChars = (c.obsFiscal as any).maxChars as number | undefined;
    if (maxChars && maxChars > 0) {
      // Re-wrap a líneas duras de longitud maxChars respetando saltos existentes
      const lines: string[] = [];
      for (const part of fiscalText.split(/\r?\n/)) {
        let p = part.trim();
        while (p.length > maxChars) {
          lines.push(p.slice(0, maxChars));
          p = p.slice(maxChars);
        }
        lines.push(p);
      }
      fiscalText = lines.join('\n');
    }
    drawText(fiscalText, c.obsFiscal.x, c.obsFiscal.y, {
      fontSize: c.obsFiscal.fontSize ?? 8,
      maxWidth: c.obsFiscal.maxWidth,
    });
  }
  
  if (c.totalLabel) {
    drawText('TOTAL:', c.totalLabel.x, c.totalLabel.y, { fontSize: c.totalLabel.fontSize ?? 12, bold: true });
  }
  drawText(formatNumberEsAr(data.total), c.total.x, c.total.y, { fontSize: c.total.fontSize ?? 12, bold: true });

  if (c.totalEnLetras) {
    drawText(`SON PESOS: ${numeroALetras(data.total)}`, c.totalEnLetras.x, c.totalEnLetras.y, {
      fontSize: c.totalEnLetras.fontSize ?? 9,
      bold: true,
      maxWidth: c.totalEnLetras.maxWidth,
    });
  }

  // CAE (imprimir solo si hay datos)
  if (data.cae) {
    drawText(`CAE Nº ${data.cae}`.trim(), c.cae.x, c.cae.y, { fontSize: c.cae.fontSize ?? 10, bold: true });
  }
  if (data.caeVto) {
    drawText(data.caeVto, c.caeVto.x, c.caeVto.y, { fontSize: c.caeVto.fontSize ?? 9 });
  }

  // QR Code - preferir URL oficial (qrDataUrl). Fallback: QR simplificado con CAE
  if (c.qrCode) {
    try {
      let qrBuffer: Buffer | null = null;
      if (qrDataUrl) {
        if (Buffer.isBuffer(qrDataUrl)) {
          qrBuffer = qrDataUrl as Buffer;
        } else if (typeof qrDataUrl === 'string') {
          const s = qrDataUrl as string;
          if (/^data:image\//i.test(s)) {
            const base64 = s.replace(/^data:image\/\w+;base64,/, '');
            qrBuffer = Buffer.from(base64, 'base64');
          } else {
            qrBuffer = await generateQRCode(s);
          }
        }
      }
      // Fallback si no hay URL y tenemos CAE
      if (!qrBuffer && data.cae) {
        const qrData = `${data.empresa.cuit}|${data.empresa.condicionIva}|${data.empresa.pv}|${data.empresa.numero}|${data.cae}|${data.caeVto}`;
        qrBuffer = await generateQRCode(qrData);
      }
      if (qrBuffer && qrBuffer.length > 0) {
        const x = mm(c.qrCode.x);
        const y = mm(c.qrCode.y);
        const size = mm(c.qrCode.size);
        doc.image(qrBuffer, x, y, { width: size, height: size });
      }
    } catch {
      // Silenciar errores de QR
    }
  }

  // Textos legales / pie
  const tienePie = Boolean(data.pieObservaciones && data.pieObservaciones.trim().length > 0);
  if (!tienePie) {
    if (c.legalDefensaConsumidor)
      drawText(
        'DEFENSA DEL CONSUMIDOR: Para reclamos, consulte en www.argentina.gob.ar/defensadelconsumidor',
        c.legalDefensaConsumidor.x,
        c.legalDefensaConsumidor.y,
        { fontSize: c.legalDefensaConsumidor.fontSize ?? 7, maxWidth: c.legalDefensaConsumidor.maxWidth },
      );
    if (c.legalContacto)
      drawText('Contacto: (261) 555-0000  -  www.tcmza.com.ar  -  soporte@tcmza.com.ar', c.legalContacto.x, c.legalContacto.y, {
        fontSize: c.legalContacto.fontSize ?? 8,
        maxWidth: c.legalContacto.maxWidth,
      });
  }
  // Observaciones de pie unificadas (desde .fac) y gracias centrado si existe
  if (c.pieObservaciones && tienePie) {
    drawText(data.pieObservaciones!, c.pieObservaciones.x, c.pieObservaciones.y, {
      fontSize: c.pieObservaciones.fontSize ?? 8,
      maxWidth: c.pieObservaciones.maxWidth,
    });
  }
  if (c.legalGracias) {
    const gracias = (data as any).gracias || '';
    if (gracias) {
      drawText(gracias, c.legalGracias.x, c.legalGracias.y, {
        fontSize: c.legalGracias.fontSize ?? 9,
        maxWidth: c.legalGracias.maxWidth,
        align: 'center',
        bold: true,
      });
    }
  }
    
  // Observaciones fiscales (OBS.FISCAL)
  if (c.obsFiscal && data.fiscal) {
    drawText(data.fiscal, c.obsFiscal.x, c.obsFiscal.y, {
      fontSize: c.obsFiscal.fontSize ?? 9,
      maxWidth: c.obsFiscal.maxWidth,
    });
  }

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


