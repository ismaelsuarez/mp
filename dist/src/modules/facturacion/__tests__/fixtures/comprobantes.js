"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.comprobanteHomologacion = exports.comprobanteMonedaExtranjera = exports.comprobanteDuplicado = exports.comprobanteTotalesIncorrectos = exports.comprobanteSinItems = exports.comprobanteValidoC = exports.comprobanteValido = void 0;
// Comprobante válido - Factura B
exports.comprobanteValido = {
    tipo: 'B',
    puntoVenta: 1,
    fecha: '20241219',
    empresa: {
        cuit: '20123456789',
        razonSocial: 'EMPRESA TEST S.A.',
        domicilio: 'Calle Test 123',
        condicionIva: 'RI'
    },
    cliente: {
        cuit: '20123456789',
        razonSocial: 'CLIENTE TEST S.A.',
        condicionIva: 'RI'
    },
    items: [
        {
            descripcion: 'Producto de prueba',
            cantidad: 1,
            precioUnitario: 1000,
            iva: 21,
            alicuotaIva: 21
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
exports.comprobanteValidoC = {
    tipo: 'C',
    puntoVenta: 1,
    fecha: '20241219',
    empresa: {
        cuit: '20123456789',
        razonSocial: 'EMPRESA TEST S.A.',
        domicilio: 'Calle Test 123',
        condicionIva: 'RI'
    },
    cliente: {
        cuit: '20123456789',
        razonSocial: 'CLIENTE TEST S.A.',
        condicionIva: 'RI'
    },
    items: [
        {
            descripcion: 'Producto de prueba C',
            cantidad: 2,
            precioUnitario: 500,
            iva: 21,
            alicuotaIva: 21
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
exports.comprobanteSinItems = {
    tipo: 'B',
    puntoVenta: 1,
    fecha: '20241219',
    empresa: {
        cuit: '20123456789',
        razonSocial: 'EMPRESA TEST S.A.',
        domicilio: 'Calle Test 123',
        condicionIva: 'RI'
    },
    cliente: {
        cuit: '20123456789',
        razonSocial: 'CLIENTE TEST S.A.',
        condicionIva: 'RI'
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
exports.comprobanteTotalesIncorrectos = {
    tipo: 'B',
    puntoVenta: 1,
    fecha: '20241219',
    empresa: {
        cuit: '20123456789',
        razonSocial: 'EMPRESA TEST S.A.',
        domicilio: 'Calle Test 123',
        condicionIva: 'RI'
    },
    cliente: {
        cuit: '20123456789',
        razonSocial: 'CLIENTE TEST S.A.',
        condicionIva: 'RI'
    },
    items: [
        {
            descripcion: 'Producto de prueba',
            cantidad: 1,
            precioUnitario: 1000,
            iva: 21,
            alicuotaIva: 21
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
exports.comprobanteDuplicado = {
    ...exports.comprobanteValido,
    numero: 1001 // Número específico para tests de duplicados
};
// Comprobante con moneda extranjera
exports.comprobanteMonedaExtranjera = {
    ...exports.comprobanteValido,
    monId: 'USD',
    observaciones: 'Comprobante en dólares'
};
// Comprobante para tests de homologación
exports.comprobanteHomologacion = {
    tipo: 'B',
    puntoVenta: 1,
    fecha: '20241219',
    empresa: {
        cuit: process.env.AFIP_CUIT_HOMOLOGACION || '20123456789',
        razonSocial: 'EMPRESA HOMOLOGACION S.A.',
        domicilio: 'Calle Homologacion 456',
        condicionIva: 'RI'
    },
    cliente: {
        cuit: '20123456789',
        razonSocial: 'CLIENTE HOMOLOGACION S.A.',
        condicionIva: 'RI'
    },
    items: [
        {
            descripcion: 'Servicio de homologación',
            cantidad: 1,
            precioUnitario: 100,
            iva: 21,
            alicuotaIva: 21
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
