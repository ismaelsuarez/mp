import { Comprobante } from '../../types';

// Comprobante válido - Factura B
export const comprobanteValido: Comprobante = {
  tipo: 'FACTURA_B',
  puntoVenta: 1,
  fecha: '20241219',
  empresa: {
    cuit: '20123456789',
    razonSocial: 'EMPRESA TEST S.A.',
    condicionIva: 'RESPONSABLE_INSCRIPTO'
  },
  cliente: {
    cuit: '20123456789',
    razonSocial: 'CLIENTE TEST S.A.',
    condicionIva: 'RESPONSABLE_INSCRIPTO'
  },
  items: [
    {
      descripcion: 'Producto de prueba',
      cantidad: 1,
      precioUnitario: 1000,
      alicuotaIva: 21,
      subtotal: 1000
    }
  ],
  totales: {
    neto: 1000,
    iva: 210,
    total: 1210
  },
  observaciones: 'Comprobante de prueba',
  codigoOperacion: '01'
};

// Comprobante válido - Factura C
export const comprobanteValidoC: Comprobante = {
  tipo: 'FACTURA_C',
  puntoVenta: 1,
  fecha: '20241219',
  empresa: {
    cuit: '20123456789',
    razonSocial: 'EMPRESA TEST S.A.',
    condicionIva: 'RESPONSABLE_INSCRIPTO'
  },
  cliente: {
    cuit: '20123456789',
    razonSocial: 'CLIENTE TEST S.A.',
    condicionIva: 'RESPONSABLE_INSCRIPTO'
  },
  items: [
    {
      descripcion: 'Producto de prueba C',
      cantidad: 2,
      precioUnitario: 500,
      alicuotaIva: 21,
      subtotal: 1000
    }
  ],
  totales: {
    neto: 1000,
    iva: 210,
    total: 1210
  },
  observaciones: 'Comprobante C de prueba',
  codigoOperacion: '01'
};

// Comprobante inválido - sin items
export const comprobanteSinItems: Comprobante = {
  tipo: 'FACTURA_B',
  puntoVenta: 1,
  fecha: '20241219',
  empresa: {
    cuit: '20123456789',
    razonSocial: 'EMPRESA TEST S.A.',
    condicionIva: 'RESPONSABLE_INSCRIPTO'
  },
  cliente: {
    cuit: '20123456789',
    razonSocial: 'CLIENTE TEST S.A.',
    condicionIva: 'RESPONSABLE_INSCRIPTO'
  },
  items: [],
  totales: {
    neto: 0,
    iva: 0,
    total: 0
  },
  observaciones: 'Comprobante sin items',
  codigoOperacion: '01'
};

// Comprobante inválido - totales incorrectos
export const comprobanteTotalesIncorrectos: Comprobante = {
  tipo: 'FACTURA_B',
  puntoVenta: 1,
  fecha: '20241219',
  empresa: {
    cuit: '20123456789',
    razonSocial: 'EMPRESA TEST S.A.',
    condicionIva: 'RESPONSABLE_INSCRIPTO'
  },
  cliente: {
    cuit: '20123456789',
    razonSocial: 'CLIENTE TEST S.A.',
    condicionIva: 'RESPONSABLE_INSCRIPTO'
  },
  items: [
    {
      descripcion: 'Producto de prueba',
      cantidad: 1,
      precioUnitario: 1000,
      alicuotaIva: 21,
      subtotal: 1000
    }
  ],
  totales: {
    neto: 1000,
    iva: 200, // Incorrecto, debería ser 210
    total: 1200 // Incorrecto, debería ser 1210
  },
  observaciones: 'Comprobante con totales incorrectos',
  codigoOperacion: '01'
};

// Comprobante para duplicados (mismo número)
export const comprobanteDuplicado: Comprobante = {
  ...comprobanteValido,
  numero: 1001 // Número específico para tests de duplicados
};

// Comprobante con moneda extranjera
export const comprobanteMonedaExtranjera: Comprobante = {
  ...comprobanteValido,
  moneda: 'USD',
  cotizacion: 1000,
  observaciones: 'Comprobante en dólares'
};

// Comprobante para tests de homologación
export const comprobanteHomologacion: Comprobante = {
  tipo: 'FACTURA_B',
  puntoVenta: 1,
  fecha: '20241219',
  empresa: {
    cuit: process.env.AFIP_CUIT_HOMOLOGACION || '20123456789',
    razonSocial: 'EMPRESA HOMOLOGACION S.A.',
    condicionIva: 'RESPONSABLE_INSCRIPTO'
  },
  cliente: {
    cuit: '20123456789',
    razonSocial: 'CLIENTE HOMOLOGACION S.A.',
    condicionIva: 'RESPONSABLE_INSCRIPTO'
  },
  items: [
    {
      descripcion: 'Servicio de homologación',
      cantidad: 1,
      precioUnitario: 100,
      alicuotaIva: 21,
      subtotal: 100
    }
  ],
  totales: {
    neto: 100,
    iva: 21,
    total: 121
  },
  observaciones: 'Comprobante para tests de homologación AFIP',
  codigoOperacion: '01'
};
