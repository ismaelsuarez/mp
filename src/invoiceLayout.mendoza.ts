import type { Config } from './pdfRenderer';

const layoutMendoza: Config = {
  coords: {
    comprobanteLetra: { x: 80, y: 10 },
    clienteNombre: { x: 16, y: 52 },
    clienteDomicilio: { x: 16, y: 59 },
    clienteCuit: { x: 16, y: 66 },
    clienteIva: { x: 16, y: 73 },

    fecha: { x: 175, y: 40 },
    fechaHora: { x: 160, y: 40 },
    pv: { x: 162, y: 30 },
    nro: { x: 181, y: 30 },

    atendio: { x: 16, y: 86 },
    condicionPago: { x: 120, y: 86 },

    referenciaInterna: { x: 16, y: 94 },
    notaRecepcion: { x: 70, y: 94 },
    remito: { x: 120, y: 94 },
    email: { x: 16, y: 100 },
    observaciones: { x: 16, y: 106, maxWidth: 120 },

    itemsStartY: 105,
    itemsRowHeight: 6,
    cols: {
      cant: { x: 12, w: 16 },
      desc: { x: 30, w: 110 },
      unit: { x: 142, w: 24 },
      alic: { x: 168, w: 14 },
      total: { x: 184, w: 22 },
    },

    neto: { x: 170, y: 230 },
    neto21: { x: 150, y: 230 },
    neto105: { x: 150, y: 237 },
    neto27: { x: 150, y: 244 },
    iva21: { x: 170, y: 237 },
    iva105: { x: 170, y: 244 },
    impIvaTotal: { x: 170, y: 251 },
    total: { x: 170, y: 262 },

    totalEnLetras: { x: 20, y: 270, maxWidth: 120 },

    cae: { x: 20, y: 250 },
    caeVto: { x: 20, y: 257 },

    qr: { x: 20, y: 210, size: 28 },

    legalDefensaConsumidor: { x: 20, y: 285, maxWidth: 170 },
    legalGracias: { x: 20, y: 292, maxWidth: 170 },
    legalContacto: { x: 20, y: 299, maxWidth: 170 },
  },
};

export default layoutMendoza;


