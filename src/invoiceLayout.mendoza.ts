import type { Config } from './pdfRenderer';

const layoutMendoza: Config = {
  coords: {
    comprobanteLetra: { x:-9, y: 8, fontSize: 26 },
    clienteNombre: { x: 27, y: 50, fontSize: 10 },
    clienteDomicilio: { x: 27, y: 54, fontSize: 9 },
    clienteCuit: { x: 27, y: 58, fontSize: 9 },
    clienteIva: { x: 27, y: 62, fontSize: 9 },

    fecha: { x: 175, y: 40, fontSize: 10 },
    fechaHora: { x: 160, y: 40, fontSize: 10 },
    pv: { x: 162, y: 30, fontSize: 10 },
    nro: { x: 181, y: 30, fontSize: 10 },

    atendio: { x: 160, y: 50, fontSize: 9 },
    condicionPago: { x: 160, y: 54, fontSize: 9 },
    referenciaInterna: { x: 160, y: 58, fontSize: 9 },

    notaRecepcion: { x: 70, y: 94, fontSize: 9 },
    remito: { x: 120, y: 94, fontSize: 9 },
    email: { x: 16, y: 100, fontSize: 9 },
    observaciones: { x: 16, y: 106, maxWidth: 120, fontSize: 9 },

    itemsStartY: 105,
    itemsRowHeight: 6,
    itemsFontSize: 9,
    cols: {
      cant: { x: 12, w: 16 },
      desc: { x: 30, w: 110 },
      unit: { x: 142, w: 24 },
      alic: { x: 168, w: 14 },
      total: { x: 184, w: 22 },
    },

    neto: { x: 170, y: 230, fontSize: 10 },
    neto21: { x: 150, y: 230, fontSize: 9 },
    neto105: { x: 150, y: 237, fontSize: 9 },
    neto27: { x: 150, y: 244, fontSize: 9 },
    iva21: { x: 170, y: 237, fontSize: 9 },
    iva105: { x: 170, y: 244, fontSize: 9 },
    impIvaTotal: { x: 170, y: 251, fontSize: 10 },
    total: { x: 170, y: 262, fontSize: 12 },

    totalEnLetras: { x: 20, y: 270, maxWidth: 120, fontSize: 9 },

    cae: { x: 20, y: 250, fontSize: 10 },
    caeVto: { x: 20, y: 257, fontSize: 9 },

    qr: { x: 20, y: 210, size: 28 },

    legalDefensaConsumidor: { x: 20, y: 285, maxWidth: 170, fontSize: 7 },
    legalGracias: { x: 20, y: 292, maxWidth: 170, fontSize: 9 },
    legalContacto: { x: 20, y: 299, maxWidth: 170, fontSize: 8 },
  },
};

export default layoutMendoza;


