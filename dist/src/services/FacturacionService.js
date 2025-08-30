"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacturacionService = void 0;
exports.getFacturacionService = getFacturacionService;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
const dayjs_1 = __importDefault(require("dayjs"));
const DbService_1 = require("./DbService");
const afipService_1 = require("../modules/facturacion/afipService");
const FacturaGenerator_1 = require("./FacturaGenerator");
// CommonJS requires
// eslint-disable-next-line @typescript-eslint/no-var-requires
const QRCode = require('qrcode');
class FacturacionService {
    constructor() {
        this.DEBUG_FACT = process.env.FACTURACION_DEBUG === 'true';
    }
    debugLog(...args) { if (this.DEBUG_FACT) { /* eslint-disable no-console */
        console.log('[FACT][Service]', ...args);
    } }
    async emitirFacturaYGenerarPdf(params) {
        const db = (0, DbService_1.getDb)();
        this.debugLog('emitirFacturaYGenerarPdf: inicio', { pto_vta: params.pto_vta, tipo_cbte: params.tipo_cbte, total: params.total });
        // Filtrado por condición IVA de la empresa (RI vs MONO)
        try {
            const empCfg = db.getEmpresaConfig?.();
            if (empCfg && empCfg.condicion_iva) {
                const cond = String(empCfg.condicion_iva || '').toUpperCase();
                const tipoSel = Number(params.tipo_cbte);
                const monoPermitidos = new Set([11, 12, 13]);
                const riPermitidos = new Set([1, 2, 3, 6, 7, 8, 11, 12, 13]);
                if (cond === 'MT' || cond === 'MONO') {
                    if (!monoPermitidos.has(tipoSel)) {
                        throw new Error('Para Monotributo solo se permiten comprobantes tipo C (11, 12, 13).');
                    }
                }
                else if (cond === 'RI') {
                    if (!riPermitidos.has(tipoSel)) {
                        throw new Error('Para Responsable Inscripto solo se permiten comprobantes A/B/C válidos.');
                    }
                }
            }
        }
        catch (e) {
            // Si no hay DB o método no existe, continuar
        }
        // Intentar emitir
        let numero = 0;
        let cae = '';
        let cae_venc = '';
        let outAny = undefined;
        try {
            // Convertir parámetros al formato Comprobante
            const comprobante = {
                tipo: this.mapTipoComprobante(params.tipo_cbte),
                puntoVenta: params.pto_vta,
                fecha: params.fecha,
                empresa: {
                    cuit: params.cuit_emisor,
                    razonSocial: params.empresa?.nombre || 'Empresa',
                    domicilio: params.empresa?.domicilio || '',
                    condicionIva: 'RI'
                },
                cliente: params.cuit_receptor ? {
                    cuit: params.cuit_receptor,
                    razonSocial: params.razon_social_receptor || 'Cliente',
                    condicionIva: params.condicion_iva_receptor || 'CF'
                } : undefined,
                items: (params.detalle || []).map(item => ({
                    descripcion: item.descripcion,
                    cantidad: item.cantidad,
                    precioUnitario: item.precioUnitario,
                    iva: item.alicuotaIva,
                    alicuotaIva: item.alicuotaIva
                })),
                totales: {
                    neto: params.neto,
                    iva: params.iva,
                    total: params.total
                },
                // Nuevos campos de configuración AFIP
                concepto: params.concepto,
                docTipo: params.doc_tipo,
                monId: params.mon_id,
                // Fechas de servicio y comprobantes asociados
                FchServDesde: params.FchServDesde,
                FchServHasta: params.FchServHasta,
                FchVtoPago: params.FchVtoPago,
                comprobantesAsociados: params.comprobantesAsociados
            };
            this.debugLog('Solicitando CAE...');
            outAny = await afipService_1.afipService.solicitarCAE(comprobante);
            cae = outAny.cae;
            cae_venc = outAny.vencimientoCAE;
            this.debugLog('CAE recibido', { cae, cae_venc });
            // Log de observaciones de AFIP si existen
            if (Array.isArray(outAny?.observaciones) && outAny.observaciones.length > 0) {
                /* eslint-disable no-console */
                console.warn(`[FACT][Observaciones] Factura emitida con advertencias:`, outAny.observaciones);
            }
            // Obtener número del último autorizado + 1
            const cfg = db.getAfipConfig();
            if (cfg) {
                this.debugLog('Consultando último autorizado...');
                const ultimo = await afipService_1.afipService.getUltimoAutorizado(params.pto_vta, comprobante.tipo);
                numero = ultimo + 1;
                this.debugLog('Número asignado', numero);
            }
            else {
                numero = Math.floor(Date.now() / 1000); // Fallback
                this.debugLog('CFG AFIP ausente, numero fallback', numero);
            }
        }
        catch (e) {
            this.debugLog('Error emitiendo CAE', e?.message || e);
            const fallbackNumero = Math.floor(Date.now() / 1000);
            db.insertFacturaEstadoPendiente({
                numero: fallbackNumero,
                pto_vta: params.pto_vta,
                tipo_cbte: params.tipo_cbte,
                fecha: params.fecha,
                cuit_emisor: params.cuit_emisor,
                cuit_receptor: params.cuit_receptor,
                razon_social_receptor: params.razon_social_receptor,
                condicion_iva_receptor: params.condicion_iva_receptor,
                neto: params.neto,
                iva: params.iva,
                total: params.total
            });
            throw new Error('AFIP no respondió o error de emisión: ' + String(e?.message || e));
        }
        // QR de AFIP
        const qrUrl = this.buildQrAfipUrl({
            ver: 1,
            fecha: (0, dayjs_1.default)(params.fecha, 'YYYYMMDD').format('YYYY-MM-DD'),
            cuit: Number(params.cuit_emisor),
            ptoVta: params.pto_vta,
            tipoCmp: params.tipo_cbte,
            nroCmp: numero,
            importe: Number(params.total.toFixed(2)),
            moneda: 'PES',
            ctz: 1,
            tipoDocRec: params.cuit_receptor ? 80 : 99,
            nroDocRec: params.cuit_receptor ? Number(params.cuit_receptor) : 0,
            tipoCodAut: 'E',
            codAut: Number(cae)
        });
        // Generar PDF vía plantilla
        this.debugLog('Generando PDF...');
        const pdfPath = await (0, FacturaGenerator_1.getFacturaGenerator)().generarPdf(params.plantilla || 'factura_a', {
            emisor: { nombre: params.empresa?.nombre || 'Empresa', cuit: params.empresa?.cuit || params.cuit_emisor, domicilio: params.empresa?.domicilio, iibb: params.empresa?.iibb, inicio: params.empresa?.inicio, logoPath: params.logoPath },
            receptor: { nombre: params.razon_social_receptor || 'Consumidor Final', cuit: params.cuit_receptor, condicionIva: params.condicion_iva_receptor },
            cbte: { tipo: String(params.tipo_cbte), pto_vta: params.pto_vta, numero, fecha: params.fecha },
            detalle: (params.detalle || []).map(d => ({ ...d, importe: d.cantidad * d.precioUnitario })),
            totales: { neto: params.neto, iva: params.iva, total: params.total },
            afip: { cae, cae_vto: cae_venc, qr_url: qrUrl }
        });
        this.debugLog('PDF generado', pdfPath);
        // Guardar en DB
        db.insertFacturaEmitida({
            numero,
            pto_vta: params.pto_vta,
            tipo_cbte: params.tipo_cbte,
            fecha: (0, dayjs_1.default)(params.fecha, 'YYYYMMDD').format('YYYY-MM-DD'),
            cuit_emisor: params.cuit_emisor,
            cuit_receptor: params.cuit_receptor || null,
            razon_social_receptor: params.razon_social_receptor || null,
            condicion_iva_receptor: params.condicion_iva_receptor || null,
            neto: params.neto,
            iva: params.iva,
            total: params.total,
            cae,
            cae_vencimiento: cae_venc,
            qr_url: qrUrl,
            pdf_path: pdfPath
        });
        this.debugLog('Factura emitida OK', { numero, cae, cae_venc });
        const obs = Array.isArray(outAny?.observaciones) ? outAny.observaciones : undefined;
        return { numero, cae, cae_vencimiento: cae_venc, qr_url: qrUrl, pdf_path: pdfPath, observaciones: obs };
    }
    buildQrAfipUrl(data) {
        const base = 'https://www.afip.gob.ar/fe/qr/?p=';
        const payload = Buffer.from(JSON.stringify(data)).toString('base64');
        return base + payload;
    }
    async abrirPdf(filePath) {
        try {
            await electron_1.shell.openPath(filePath);
        }
        catch { }
    }
    /**
     * Emite factura con integración provincial (AFIP + ATM/AGIP/ARBA)
     */
    async emitirFacturaConProvincias(params) {
        const db = (0, DbService_1.getDb)();
        const startTime = Date.now();
        try {
            // Convertir params a formato Comprobante
            const comprobante = this.convertirAComprobante(params);
            // Solicitar CAE con procesamiento provincial
            const resultado = await afipService_1.afipService.solicitarCAEConProvincias(comprobante);
            if (!resultado.afip.success || !resultado.afip.cae) {
                throw new Error(resultado.afip.error || 'Error en emisión AFIP');
            }
            const numero = resultado.afip.numero;
            const cae = resultado.afip.cae;
            const caeVencimiento = resultado.afip.caeVencimiento;
            // Construir QR de AFIP
            const qrUrl = this.buildQrAfipUrl({
                ver: 1,
                fecha: (0, dayjs_1.default)(params.fecha, 'YYYYMMDD').format('YYYY-MM-DD'),
                cuit: Number(params.cuit_emisor),
                ptoVta: params.pto_vta,
                tipoCmp: params.tipo_cbte,
                nroCmp: numero,
                importe: params.total,
                moneda: 'PES',
                ctz: 1,
                tipoDoc: 99,
                nroDoc: 0,
                tipoCodAut: 'E',
                codAut: cae
            });
            // Generar PDF
            const pdfFileName = `factura_${numero}_${Date.now()}.pdf`;
            const pdfPath = path_1.default.join(this.getFacturasDir(), pdfFileName);
            await (0, FacturaGenerator_1.getFacturaGenerator)().generarPdf(params.plantilla || 'factura_a', {
                emisor: {
                    nombre: params.empresa?.nombre || 'Empresa',
                    cuit: params.cuit_emisor,
                    domicilio: params.empresa?.domicilio,
                    iibb: params.empresa?.iibb,
                    inicio: params.empresa?.inicio,
                    logoPath: params.logoPath
                },
                receptor: {
                    nombre: params.razon_social_receptor || 'Cliente',
                    cuit: params.cuit_receptor || undefined,
                    condicionIva: params.condicion_iva_receptor || 'CF',
                    domicilio: undefined
                },
                cbte: {
                    tipo: String(params.tipo_cbte),
                    pto_vta: params.pto_vta,
                    numero,
                    fecha: params.fecha
                },
                detalle: params.detalle?.map(item => ({
                    descripcion: item.descripcion,
                    cantidad: item.cantidad,
                    precioUnitario: item.precioUnitario,
                    importe: item.cantidad * item.precioUnitario,
                    alicuotaIva: item.alicuotaIva
                })) || [],
                totales: {
                    neto: params.neto,
                    iva: params.iva,
                    total: params.total
                },
                afip: {
                    cae,
                    cae_vto: caeVencimiento,
                    qr_url: qrUrl
                }
            });
            // Guardar en base de datos con información provincial
            const facturaRecord = {
                numero,
                pto_vta: params.pto_vta,
                tipo_cbte: params.tipo_cbte,
                fecha: params.fecha,
                cuit_emisor: params.cuit_emisor,
                cuit_receptor: params.cuit_receptor || null,
                razon_social_receptor: params.razon_social_receptor || null,
                condicion_iva_receptor: params.condicion_iva_receptor || null,
                neto: params.neto,
                iva: params.iva,
                total: params.total,
                cae,
                cae_vencimiento: caeVencimiento,
                qr_url: qrUrl,
                pdf_path: pdfPath,
                // Campos provinciales
                provincia: resultado.provincial?.jurisdiccion || null,
                provincia_estado: resultado.estado,
                provincia_servicio: resultado.provincial?.servicio || null,
                provincia_numero: resultado.provincial?.numeroComprobante || null,
                provincia_codigo: resultado.provincial?.codigo || null,
                provincia_respuesta: resultado.provincial ? JSON.stringify(resultado.provincial) : null,
                provincia_error: resultado.provincial?.error || null
            };
            db.insertFacturaEmitida(facturaRecord);
            // Log del resultado final
            console.log(`✅ Factura ${numero} emitida - Estado: ${resultado.estado} - Duración: ${Date.now() - startTime}ms`);
            return {
                numero,
                cae,
                caeVencimiento,
                qrUrl,
                pdfPath,
                resultado
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Log del error
            console.error(`❌ Error emitiendo factura con provincias: ${errorMessage} - Duración: ${Date.now() - startTime}ms`);
            // Intentar guardar como pendiente si tenemos algunos datos
            try {
                const fallbackNumero = Math.floor(Date.now() / 1000);
                db.insertFacturaEstadoPendiente({
                    numero: fallbackNumero,
                    pto_vta: params.pto_vta,
                    tipo_cbte: params.tipo_cbte,
                    fecha: params.fecha,
                    cuit_emisor: params.cuit_emisor,
                    cuit_receptor: params.cuit_receptor,
                    razon_social_receptor: params.razon_social_receptor,
                    condicion_iva_receptor: params.condicion_iva_receptor,
                    neto: params.neto,
                    iva: params.iva,
                    total: params.total
                });
            }
            catch (dbError) {
                console.error('Error guardando factura pendiente:', dbError);
            }
            throw new Error(`Error en emisión con provincias: ${errorMessage}`);
        }
    }
    /**
     * Convierte parámetros legacy a formato Comprobante
     */
    convertirAComprobante(params) {
        return {
            tipo: this.mapTipoComprobante(params.tipo_cbte),
            puntoVenta: params.pto_vta,
            fecha: params.fecha,
            empresa: {
                cuit: params.cuit_emisor,
                razonSocial: params.empresa?.nombre || 'Empresa',
                domicilio: params.empresa?.domicilio || '',
                condicionIva: 'RI' // Asumimos RI por defecto
            },
            cliente: params.cuit_receptor ? {
                cuit: params.cuit_receptor,
                razonSocial: params.razon_social_receptor || 'Cliente',
                condicionIva: params.condicion_iva_receptor || 'CF'
            } : undefined,
            items: params.detalle?.map(item => ({
                descripcion: item.descripcion,
                cantidad: item.cantidad,
                precioUnitario: item.precioUnitario,
                iva: item.alicuotaIva,
                alicuotaIva: item.alicuotaIva
            })) || [],
            totales: {
                neto: params.neto,
                iva: params.iva,
                total: params.total
            },
            observaciones: '',
            codigoOperacion: ''
        };
    }
    /**
     * Mapea tipo de comprobante numérico a string
     */
    mapTipoComprobante(tipoCbte) {
        switch (tipoCbte) {
            case 1: return 'A';
            case 2: return 'A'; // ND A
            case 3: return 'FA'; // NC A (alias)
            case 6: return 'B';
            case 7: return 'B'; // ND B
            case 8: return 'FB'; // NC B (alias)
            case 11: return 'C';
            case 12: return 'C'; // ND C
            case 13: return 'NC'; // NC C (alias)
            default: return 'C';
        }
    }
    /**
     * Obtiene el directorio de facturas
     */
    getFacturasDir() {
        const facturasDirName = process.env.FACTURAS_DIR || 'facturas';
        const factDir = path_1.default.join(electron_1.app.getPath('userData'), 'documentos', facturasDirName);
        if (!fs_1.default.existsSync(factDir)) {
            fs_1.default.mkdirSync(factDir, { recursive: true });
        }
        return factDir;
    }
}
exports.FacturacionService = FacturacionService;
let instance = null;
function getFacturacionService() { if (!instance)
    instance = new FacturacionService(); return instance; }
