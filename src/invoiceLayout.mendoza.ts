import type { Config } from './pdfRenderer';

const layoutMendoza: Config = {
  // Configuración de página
  page: {
    width: 210, // mm - Ancho A4
    height: 297, // mm - Alto A4
    margins: {
      top: 10,
      bottom: 10,
      left: 10,
      right: 10
    }
  },

  coords: {
    // Información de la Empresa
    empresaNombre: { x: 27, y: 8, fontSize: 12 },        // Nombre de la empresa (izquierda)
    empresaDomicilio: { x: 27, y: 12, fontSize: 8 },     // Dirección de la empresa
    empresaCuit: { x: 27, y: 16, fontSize: 8 },          // CUIT de la empresa
    empresaIva: { x: 27, y: 20, fontSize: 8 },           // Condición IVA de la empresa
    empresaInscripcion: { x: 27, y: 24, fontSize: 8 },   // Inscripción de la empresa

    // Encabezado de Factura
    comprobanteLetra: { x: -9, y: 8, fontSize: 26 },     // Letra A/B/C en el recuadro central
    clienteNombre: { x: 27, y: 50, fontSize: 8 },        // Nombre del cliente
    clienteNombreRemito: { x: 27, y: 50, fontSize: 8 },  // Override Remito
    clienteDomicilio: { x: 27, y: 54, fontSize: 8 },     // Dirección del cliente
    clienteDomicilioRemito: { x: 27, y: 54, fontSize: 8 },
    clienteCuit: { x: 27, y: 58, fontSize: 8 },          // CUIT/DNI del cliente
    clienteCuitRemito: { x: 27, y: 58, fontSize: 8 },
    clienteIva: { x: 27, y: 62, fontSize: 8 },           // Condición IVA del cliente
    clienteIvaRemito: { x: 27, y: 62, fontSize: 8 },

    // Información del Comprobante
    fecha: { x: 160, y: 20, fontSize: 12 },              // Fecha de emisión (formato DD/MM/YYYY)
    numero: { x: 162, y: 10, fontSize: 10 },             // Número de comprobante
    numeroRemito: { x: 160, y: 14, fontSize: 8 },       // Override para Remito
    tipoComprobante: { x: 160, y: 8, fontSize: 15 },    // Tipo: "FACTURA", "NOTA DE CRÉDITO", etc.
    // Ajuste específico para NOTA DE CRÉDITO (texto más largo)
    tipoComprobanteNC: { x: 150, y: 8, fontSize: 14 },
    tipoComprobanteRemito: { x: 165, y: 8, fontSize: 14 },
    pv: { x: 160, y: 14, fontSize: 10 },                 // Punto de Venta (PV)
    pvRemito: { x: 160, y: 14, fontSize: 9 },
    referenciaInterna: { x: 160, y: 26, fontSize: 7 },   // Referencia interna de la empresa
    referenciaInternaRemito: { x: 160, y: 28, fontSize: 7 },

    // Información Comercial
    atendio: { x: 145, y: 50, fontSize: 9 },             // Quién atendió al cliente
    atendioRemito: { x: 145, y: 50, fontSize: 9 },
    condicionPago: { x: 145, y: 54, fontSize: 9 },       // Condición de pago (contado/crédito)
    condicionPagoRemito: { x: 145, y: 54, fontSize: 9 },
    hora: { x: 145, y: 58, fontSize: 9 },                // Hora de emisión (formato HH:mm)
    horaRemito: { x: 145, y: 58, fontSize: 9 },
    email: { x: 145, y: 62, fontSize: 7 },               // Email del cliente
    emailRemito: { x: 145, y: 62, fontSize: 7 },
    
    // Información Adicional
    moneda: { x: 162, y: 30, fontSize: 8 },              // Moneda de la factura (ARS, USD, etc.)
    cotizacion: { x: 162, y: 34, fontSize: 8 },          // Cotización de la moneda
    formaPago: { x: 145, y: 62, fontSize: 8 },           // Forma de pago (efectivo, tarjeta, etc.)

    // Detalles de Entrega
    notaRecepcion: { x: 8, y: 70, fontSize: 9 },         // Número de nota de recepción
    notaRecepcionRemito: { x: 8, y: 70, fontSize: 9 },
    remito: { x: 100, y: 70, fontSize: 9 },              // Número de remito
    remitoRemito: { x: 100, y: 70, fontSize: 9 },
    observaciones: { x: 8, y: 70, maxWidth: 120, fontSize: 9 }, // Observaciones generales
    observacionesRemito: { x: 8, y: 70, maxWidth: 120, fontSize: 9 },

    // Tabla de Items
    itemsStartY: 87,                                    // Posición Y donde empiezan los items
    itemsRowHeight: 4,                                  // Altura de cada fila de item (en mm)
    itemsFontSize: 8,                                   // Tamaño de fuente para los items
    // ✅ Configuración específica para items RAW (modo "dump directo")
    itemsRawStartX: 17.5,                                 // Posición X inicial para items RAW (mm)
    itemsRawFontSize: 9.5,                                // Tamaño de fuente para items RAW (opcional, usa itemsFontSize si no se define)
    itemsRawMaxWidth: 190,                              // Ancho máximo para items RAW (mm) - para líneas de ~100 caracteres
    cols: {                                             // Columnas de la tabla
      cant: { x: 14, w: 16 },                          // Cantidad (columna 1)
      desc: { x: 32, w: 110 },                         // Descripción (columna 2)
      unit: { x: 134, w: 24 },                         // Precio unitario (columna 3)
      alic: { x: 164, w: 14 },                         // Alícuota IVA (columna 4)
      total: { x: 180, w: 22 }                          // Total del item (columna 5)
    },

    // Subtotales por Alícuota
    subtotal21: { x: 160, y: 216, fontSize: 10 },        // Subtotal para IVA 21%
    subtotal105: { x: 160, y: 220, fontSize: 10 },       // Subtotal para IVA 10.5%
    subtotal27: { x: 160, y: 224, fontSize: 10 },        // Subtotal para IVA 27%

    // Totales e Impuestos - Etiquetas (izquierda) y Valores (derecha)
    neto: { x: 173, y: 212, fontSize: 10},              // Valor del neto gravado total
    netoLabel: { x: 157, y: 212, fontSize: 10 },         // Etiqueta "Neto:" (izquierda)
    neto21: { x: 173, y: 216, fontSize: 10 },            // Valor del neto con IVA 21%
    neto21Label: { x: 157, y: 216, fontSize: 10 },       // Etiqueta "Neto 21%:" (izquierda)
    neto105: { x: 173, y: 220, fontSize: 10 },           // Valor del neto con IVA 10.5%
    neto105Label: { x: 157, y: 220, fontSize: 10 },      // Etiqueta "Neto 10.5%:" (izquierda)
    neto27: { x: 173, y: 224, fontSize: 10 },            // Valor del neto con IVA 27%
    neto27Label: { x: 157, y: 224, fontSize: 10 },       // Etiqueta "Neto 27%:" (izquierda)
    // Exento (opcional)
    exento: { x: 173, y: 224, fontSize: 10 },            // Valor de Exento
    exentoLabel: { x: 157, y: 224, fontSize: 10 },       // Etiqueta "Exento:" (izquierda)
    iva21: { x: 173, y: 228, fontSize: 10 },             // Valor del IVA 21%
    iva21Label: { x: 157, y: 228, fontSize: 10 },        // Etiqueta "IVA 21%:" (izquierda)
    iva105: { x: 173, y: 232, fontSize: 10 },            // Valor del IVA 10.5%
    iva105Label: { x: 157, y: 232, fontSize: 10 },       // Etiqueta "IVA 10.5%:" (izquierda)
    impIvaTotal: { x: 173, y: 236, fontSize: 10 },       // Valor del IVA total
    impIvaTotalLabel: { x: 157, y: 236, fontSize: 10 },  // Etiqueta "IVA Total:" (izquierda)
    total: { x: 169, y: 250, fontSize: 12 },            // Valor del total final
    totalLabel: { x: 153, y: 250, fontSize: 12 },       // Etiqueta "TOTAL:" (izquierda)

    // Total en letras
    totalEnLetras: { x: 9, y: 206, maxWidth: 120, fontSize: 9 }, // "SON PESOS: UN MIL..." (total en letras)
    totalEnLetrasRemito: { x: 9, y: 206, maxWidth: 120, fontSize: 9 },

    // Información AFIP
    cae: { x: 115, y: 252, fontSize: 8 },                        // Número de CAE (Código de Autorización Electrónico)
    caeVto: { x: 115, y: 256, fontSize: 8 },                     // Fecha de vencimiento del CAE

    // QR Code - Al lado del CAE
    qrCode: { x: 115, y: 210, size: 40 },                        // QR code con datos AFIP (40mm x 40mm)

    // Textos Legales
    legalDefensaConsumidor: { x: 10, y: 274, maxWidth: 190, fontSize: 7 }, // Texto de defensa del consumidor
    legalContacto: { x: 10, y: 274, maxWidth: 190, fontSize: 8 },          // Información de contacto
    legalGracias: { x: 60, y: 289, maxWidth: 90, fontSize: 9 },            // Mensaje de agradecimiento (centrado)
    // Observaciones dinámicas de pie (desde OBS.PIE)
    pieObservaciones: { x: 10, y: 273, maxWidth: 190, fontSize: 8 },
    // Variante exclusiva para Remito (fondo diferente): subir el pie
    pieObservacionesRemito: { x: 10, y: 273, maxWidth: 190, fontSize: 8 },
    // Observaciones fiscales (debajo de TOTAL)
    obsFiscal: { x: 114, y: 262, maxWidth: 96, fontSize: 6, maxChars: 84 },

    // Overrides exclusivos para Remito (fecha)
    fechaRemito: { x: 160, y: 20, fontSize: 12 },
    // Si usáramos fechaHoraRemito, también podríamos definirlo aquí
  },

  // Validación de campos requeridos
  validation: {
    requiredFields: [                                // Campos obligatorios para generar la factura
      'comprobanteLetra', 'clienteNombre', 'clienteCuit',
      'pv', 'nro', 'fecha', 'total', 'cae'
    ],
    maxWidth: 210,                                   // Ancho máximo de página A4 (en mm)
    maxHeight: 297                                   // Alto máximo de página A4 (en mm)
  }
};

export default layoutMendoza;

// ===== Retenciones layout (centralizado) =====
export type TextBox = { x: number; y: number; width: number; lineGap?: number; fontSize?: number };

export const invoiceLayout = {
  retencion: {
    background: 'templates/FirmaDa.jpg',
    fonts: {
      regular: 'src/modules/fonts/CONSOLA.TTF',
      bold: 'src/modules/fonts/CONSOLAB.TTF',
    },
    blocks: {
      body: { x: 50, y: 5, width: 490, lineGap: 0.5, fontSize: 11 } as TextBox,
    },
  },
} as const;

export type RetencionLayout = typeof invoiceLayout['retencion'];

