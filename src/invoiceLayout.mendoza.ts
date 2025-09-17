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
    clienteDomicilio: { x: 27, y: 54, fontSize: 8 },     // Dirección del cliente
    clienteCuit: { x: 27, y: 58, fontSize: 8 },          // CUIT/DNI del cliente
    clienteIva: { x: 27, y: 62, fontSize: 8 },           // Condición IVA del cliente

    // Información del Comprobante
    fecha: { x: 160, y: 20, fontSize: 12 },              // Fecha de emisión (formato DD/MM/YYYY)
    numero: { x: 162, y: 10, fontSize: 10 },             // Número de comprobante
    tipoComprobante: { x: 165, y: 8, fontSize: 15 },    // Tipo: "FACTURA", "NOTA DE CRÉDITO", etc.
    pv: { x: 160, y: 14, fontSize: 10 },                 // Punto de Venta (PV)
    referenciaInterna: { x: 160, y: 26, fontSize: 7 },   // Referencia interna de la empresa

    // Información Comercial
    atendio: { x: 145, y: 50, fontSize: 9 },             // Quién atendió al cliente
    condicionPago: { x: 145, y: 54, fontSize: 9 },       // Condición de pago (contado/crédito)
    hora: { x: 145, y: 58, fontSize: 9 },                // Hora de emisión (formato HH:mm)
    email: { x: 145, y: 62, fontSize: 7 },               // Email del cliente
    
    // Información Adicional
    moneda: { x: 162, y: 30, fontSize: 8 },              // Moneda de la factura (ARS, USD, etc.)
    cotizacion: { x: 162, y: 34, fontSize: 8 },          // Cotización de la moneda
    formaPago: { x: 145, y: 62, fontSize: 8 },           // Forma de pago (efectivo, tarjeta, etc.)

    // Detalles de Entrega
    notaRecepcion: { x: 8, y: 70, fontSize: 9 },         // Número de nota de recepción
    remito: { x: 100, y: 70, fontSize: 9 },              // Número de remito
    observaciones: { x: 8, y: 70, maxWidth: 120, fontSize: 9 }, // Observaciones generales

    // Tabla de Items
    itemsStartY: 87,                                    // Posición Y donde empiezan los items
    itemsRowHeight: 4,                                  // Altura de cada fila de item (en mm)
    itemsFontSize: 8,                                   // Tamaño de fuente para los items
    cols: {                                             // Columnas de la tabla
      cant: { x: 14, w: 16 },                          // Cantidad (columna 1)
      desc: { x: 32, w: 110 },                         // Descripción (columna 2)
      unit: { x: 134, w: 24 },                         // Precio unitario (columna 3)
      alic: { x: 164, w: 14 },                         // Alícuota IVA (columna 4)
      total: { x: 180, w: 22 }                          // Total del item (columna 5)
    },

    // Subtotales por Alícuota
    subtotal21: { x: 160, y: 216, fontSize: 9 },        // Subtotal para IVA 21%
    subtotal105: { x: 160, y: 220, fontSize: 9 },       // Subtotal para IVA 10.5%
    subtotal27: { x: 160, y: 224, fontSize: 9 },        // Subtotal para IVA 27%

    // Totales e Impuestos - Etiquetas (izquierda) y Valores (derecha)
    neto: { x: 180, y: 212, fontSize: 9 },              // Valor del neto gravado total
    netoLabel: { x: 160, y: 212, fontSize: 9 },         // Etiqueta "Neto:" (izquierda)
    neto21: { x: 180, y: 216, fontSize: 9 },            // Valor del neto con IVA 21%
    neto21Label: { x: 160, y: 216, fontSize: 9 },       // Etiqueta "Neto 21%:" (izquierda)
    neto105: { x: 180, y: 220, fontSize: 9 },           // Valor del neto con IVA 10.5%
    neto105Label: { x: 160, y: 220, fontSize: 9 },      // Etiqueta "Neto 10.5%:" (izquierda)
    neto27: { x: 180, y: 224, fontSize: 9 },            // Valor del neto con IVA 27%
    neto27Label: { x: 160, y: 224, fontSize: 9 },       // Etiqueta "Neto 27%:" (izquierda)
    iva21: { x: 180, y: 228, fontSize: 9 },             // Valor del IVA 21%
    iva21Label: { x: 160, y: 228, fontSize: 9 },        // Etiqueta "IVA 21%:" (izquierda)
    iva105: { x: 180, y: 232, fontSize: 9 },            // Valor del IVA 10.5%
    iva105Label: { x: 160, y: 232, fontSize: 9 },       // Etiqueta "IVA 10.5%:" (izquierda)
    impIvaTotal: { x: 180, y: 236, fontSize: 9 },       // Valor del IVA total
    impIvaTotalLabel: { x: 160, y: 236, fontSize: 9 },  // Etiqueta "IVA Total:" (izquierda)
    total: { x: 180, y: 245, fontSize: 12 },            // Valor del total final
    totalLabel: { x: 160, y: 245, fontSize: 12 },       // Etiqueta "TOTAL:" (izquierda)

    // Total en letras
    totalEnLetras: { x: 9, y: 206, maxWidth: 120, fontSize: 9 }, // "SON PESOS: UN MIL..." (total en letras)

    // Información AFIP
    cae: { x: 160, y: 258, fontSize: 8 },                        // Número de CAE (Código de Autorización Electrónico)
    caeVto: { x: 160, y: 262, fontSize: 8 },                     // Fecha de vencimiento del CAE

    // QR Code - Al lado del CAE
    qrCode: { x: 115, y: 230, size: 40 },                        // QR code con datos AFIP (40mm x 40mm)

    // Textos Legales
    legalDefensaConsumidor: { x: 10, y: 274, maxWidth: 170, fontSize: 7 }, // Texto de defensa del consumidor
    legalContacto: { x: 10, y: 274, maxWidth: 170, fontSize: 8 },          // Información de contacto
    legalGracias: { x: 60, y: 288, maxWidth: 90, fontSize: 9 },            // Mensaje de agradecimiento (centrado)
    // Observaciones dinámicas de pie (desde OBS.PIE)
    pieObservaciones: { x: 10, y: 274, maxWidth: 170, fontSize: 8 },
    // Variante exclusiva para Remito (fondo diferente): subir el pie
    pieObservacionesRemito: { x: 10, y: 266, maxWidth: 170, fontSize: 8 },
    // Observaciones fiscales (debajo de TOTAL)
    obsFiscal: { x: 114, y: 262, maxWidth: 96, fontSize: 6, maxChars: 84 },
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


