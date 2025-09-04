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
    empresaNombre: { x: 27, y: 8, fontSize: 12 },
    empresaDomicilio: { x: 27, y: 12, fontSize: 8 },
    empresaCuit: { x: 27, y: 16, fontSize: 8 },
    empresaIva: { x: 27, y: 20, fontSize: 8 },
    empresaInscripcion: { x: 27, y: 24, fontSize: 8 },

    // Encabezado de Factura
    comprobanteLetra: { x: -9, y: 8, fontSize: 26 },
    clienteNombre: { x: 27, y: 50, fontSize: 8 },
    clienteDomicilio: { x: 27, y: 54, fontSize: 8 },
    clienteCuit: { x: 27, y: 58, fontSize: 8 },
    clienteIva: { x: 27, y: 62, fontSize: 8 },

    // Información del Comprobante
    fecha: { x: 162, y: 18, fontSize: 12 },
    numero: { x: 162, y: 10, fontSize: 10 },
    tipoComprobante: { x: 162, y: 10, fontSize: 10 },
    pv: { x: 160, y: 14, fontSize: 10 },
    referenciaInterna: { x: 160, y: 26, fontSize: 7 },

    // Información Comercial
    atendio: { x: 145, y: 50, fontSize: 9 },
    condicionPago: { x: 145, y: 54, fontSize: 9 },
    hora: { x: 145, y: 58, fontSize: 9 }, // Hora de emisión (lateral)
    email: { x: 145, y: 62, fontSize: 7 },
    
    // Información Adicional
    moneda: { x: 162, y: 30, fontSize: 8 },
    cotizacion: { x: 162, y: 34, fontSize: 8 },
    formaPago: { x: 145, y: 62, fontSize: 8 }, // Movido a Y: 62 para evitar conflicto

    // Detalles de Entrega
    notaRecepcion: { x: 8, y: 70, fontSize: 9 },
    remito: { x: 100, y: 70, fontSize: 9 },
    observaciones: { x: 8, y: 74, maxWidth: 120, fontSize: 9 },

    // Tabla de Items
    itemsStartY: 87,
    itemsRowHeight: 4,
    itemsFontSize: 8,
    cols: {
      cant: { x: 14, w: 16 },
      desc: { x: 32, w: 110 },
      unit: { x: 134, w: 24 },
      alic: { x: 164, w: 14 },
      total: { x: 180, w: 22 },
    },

    // Subtotales por Alícuota
    subtotal21: { x: 1, y: 216, fontSize: 9 },
    subtotal105: { x: 1, y: 220, fontSize: 9 },
    subtotal27: { x: 1, y: 224, fontSize: 9 },

    // Totales e Impuestos
    neto: { x: 1, y: 220, fontSize: 10 },
    neto21: { x: 1, y: 224, fontSize: 9 },
    neto105: { x: 1, y: 228, fontSize: 9 },
    neto27: { x: 1, y: 232, fontSize: 9 },
    iva21: { x: 1, y: 236, fontSize: 9 },
    iva105: { x: 1, y: 240, fontSize: 9 },
    impIvaTotal: { x: 1, y: 244, fontSize: 10 },
    total: { x: 1, y: 248, fontSize: 12 },

    totalEnLetras: { x: 9, y: 206, maxWidth: 120, fontSize: 9 },

    // Información AFIP
    cae: { x: 160, y: 258, fontSize: 8 },
    caeVto: { x: 160, y: 262, fontSize: 8 },

    // QR Code
    qrCode: { x: 20, y: 120, size: 80 },
    qr: { x: 20, y: 210, size: 28 },

    // Textos Legales
    legalDefensaConsumidor: { x: 20, y: 285, maxWidth: 170, fontSize: 7 },
    legalGracias: { x: 20, y: 292, maxWidth: 170, fontSize: 9 },
    legalContacto: { x: 20, y: 299, maxWidth: 170, fontSize: 8 },
  },

  // Validación de campos requeridos
  validation: {
    requiredFields: [
      'comprobanteLetra', 'clienteNombre', 'clienteCuit',
      'pv', 'nro', 'fecha', 'total', 'cae'
    ],
    maxWidth: 210, // Ancho máximo de página A4
    maxHeight: 297  // Alto máximo de página A4
  }
};

export default layoutMendoza;


