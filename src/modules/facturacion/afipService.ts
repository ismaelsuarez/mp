import { DatosAFIP, Comprobante, TipoComprobante, ServerStatus, CertificadoInfo } from './types';
import { AfipVoucherResponse } from './afip/types';
import { AfipInstanceManager } from './afip/AfipInstanceManager';
import { getDb } from '../../services/DbService';
import { AfipLogger } from './afip/AfipLogger';
import { CertificateValidator } from './afip/CertificateValidator';
import { AfipHelpers } from './afip/helpers';
import { AfipValidator, ValidationParams } from './afip/AfipValidator';
import { IdempotencyManager } from './afip/IdempotencyManager';
import { ResilienceWrapper } from './afip/ResilienceWrapper';
import { getResilienceConfig } from './afip/config';
import { caeValidator } from './afip/CAEValidator';
import { getProvinciaManager } from './provincia/ProvinciaManager';
import { getSecureStore } from '../../services/SecureStore';
import { ComprobanteProvincialParams, ResultadoProvincial } from './provincia/IProvinciaService';
import { timeValidator, validateSystemTimeAndThrow } from './utils/TimeValidator';
import { validateArcaRules } from './arca/ArcaAdapter';
import { consultarPadronAlcance13 } from './padron';
import { getCondicionIvaReceptorId } from '../../services/afip/wsfe/catalogs';

// Eliminado: carga del SDK externo @afipsdk/afip.js

class AfipService {
  private afipInstance: any = null;
  private instanceManager: AfipInstanceManager | null = null;
  private logger: AfipLogger;
  private idempotencyManager: IdempotencyManager;
  private resilienceWrapper: ResilienceWrapper;
  private DEBUG_FACT: boolean = process.env.FACTURACION_DEBUG === 'true';
  private tempCleanup: (() => void) | null = null;
  private cotizCache: Map<string, { ts: number; data: { monId: string; monCotiz: number; fchCotiz: string; fuente: string; modo: string } } > = new Map();

  private debugLog(...args: any[]) {
    if (this.DEBUG_FACT) {
      // eslint-disable-next-line no-console
      console.log('[FACT][AFIPService]', ...args);
    }
  }

  // ====== Helpers de moneda (pedido cliente) ======
  private monedasCache: { ts: number; items: string[] } | null = null;
  private resolveMonId(input: string): string {
    const s = String(input || '').trim().toUpperCase();
    if (!s) return 'PES';
    if (s === 'PESOS' || s === 'ARS' || s === 'PES') return 'PES';
    if (s === 'DOLARES' || s === 'DÓLARES' || s === 'USD' || s === 'DOL') return 'DOL';
    if (s === 'EUROS' || s === 'EUR') return 'EUR';
    return s;
  }
  private prevDiaHabil(yyyymmdd: string): string {
    const y = Number(yyyymmdd.slice(0,4)); const m = Number(yyyymmdd.slice(4,6))-1; const d = Number(yyyymmdd.slice(6,8));
    const dt = new Date(Date.UTC(y,m,d));
    do { dt.setUTCDate(dt.getUTCDate()-1); } while (dt.getUTCDay() === 0 || dt.getUTCDay() === 6);
    const mm = String(dt.getUTCMonth()+1).padStart(2,'0'); const dd = String(dt.getUTCDate()).padStart(2,'0');
    return `${dt.getUTCFullYear()}${mm}${dd}`;
  }
  private async ensureMonedasValid(afip: any, monId: string): Promise<void> {
    const now = Date.now();
    if (!this.monedasCache || (now - this.monedasCache.ts) > 12*60*60*1000) {
      const list = await afip.ElectronicBilling.getCurrenciesTypes();
      const ids = Array.isArray(list) ? list.map((x:any)=> String((x.Id||x.id||'')).toUpperCase()) : [];
      this.monedasCache = { ts: now, items: ids };
    }
    if (!this.monedasCache.items.includes(monId)) {
      throw new Error('MonId inválido');
    }
  }
  private async getCotizacion(afip: any, monId: string, fch?: string): Promise<{ valor:number; fecha:string }> {
    const svc: any = afip?.ElectronicBilling;
    const norm = (r: any) => {
      const val = Number((r && (r.MonCotiz ?? r?.ResultGet?.MonCotiz)) || 0);
      const fecha = String((r && (r.FchCotiz ?? r?.ResultGet?.FchCotiz)) || '');
      if (!Number.isFinite(val) || val <= 0) throw new Error('Cotización no válida');
      return { valor: val, fecha };
    };
    try {
      // 1) Oficial/alias: getCurrencyCotization(monId[, fch])
      if (svc && typeof svc.getCurrencyCotization === 'function') {
        const r = fch ? await svc.getCurrencyCotization(monId, fch) : await svc.getCurrencyCotization(monId);
        return norm(r);
      }
      // 2) Alias alternativo: getCurrencyQuotation(monId[, fch])
      if (svc && typeof svc.getCurrencyQuotation === 'function') {
        const r = fch ? await svc.getCurrencyQuotation(monId, fch) : await svc.getCurrencyQuotation(monId);
        return norm(r);
      }
      // 3) Variante con objeto: getParamGetCotizacion({ MonId, FchCotiz? })
      if (svc && typeof svc.getParamGetCotizacion === 'function') {
        const args: any = { MonId: monId }; if (fch) args.FchCotiz = fch;
        const r = await svc.getParamGetCotizacion(args);
        return norm(r);
      }
      throw new Error('Método de cotización no disponible en SDK');
    } catch (e:any) {
      const msg = String(e?.message || e);
      if (/timeout|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|5\d\d/i.test(msg)) {
        throw new Error('TRANSIENT_COTIZ');
      }
      if (/no disponible/i.test(msg)) {
        // Sin método en SDK: clasificar como permanente por ausencia de contrato
        throw new Error('PERMANENT_COTIZ');
      }
      throw new Error('PERMANENT_COTIZ');
    }
  }

  constructor() {
    this.logger = new AfipLogger();
    this.idempotencyManager = new IdempotencyManager();
    this.resilienceWrapper = new ResilienceWrapper(getResilienceConfig(), this.logger);
  }

  /**
   * Obtiene una instancia de AFIP configurada
   */
  private async getAfipInstance(): Promise<any> {
    this.debugLog('getAfipInstance: inicio');
    const cfg = getDb().getAfipConfig();
    if (!cfg) {
      throw new Error('Falta configurar AFIP en Administración');
    }
    this.debugLog('Config AFIP cargada', { entorno: cfg.entorno, cuit: cfg.cuit, pto_vta: cfg.pto_vta, cert_path: cfg.cert_path, key_path: cfg.key_path });

    // VALIDACIÓN DE TIEMPO NTP - NUEVA FUNCIONALIDAD
    try {
      await validateSystemTimeAndThrow();
      this.logger.logRequest('timeValidation', { status: 'passed', message: 'Sistema sincronizado con NTP' });
      this.debugLog('Validación NTP OK');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.logError('timeValidation', error instanceof Error ? error : new Error(errorMessage), {
        message: 'Validación de tiempo falló antes de crear instancia AFIP'
      });
      this.debugLog('Validación NTP FAIL', errorMessage);
      throw new Error(`Error de sincronización de tiempo: ${errorMessage}`);
    }

    // Cert/key obligatorios: si faltan, abortar (no usar fallback SecureStore de forma automática)
    const resolvedCertPath = String(cfg.cert_path || '').trim();
    const resolvedKeyPath = String(cfg.key_path || '').trim();
    if (!resolvedCertPath || !resolvedKeyPath) {
      this.logger.logError('config_afip_incompleta', new Error('Faltan cert_path/key_path'));
      throw new Error('Configuración AFIP incompleta: debe configurar Certificado (.crt/.pem) y Clave privada (.key)');
    }

    // Validar certificado antes de crear instancia (usar ruta resuelta)
    const certInfo = CertificateValidator.validateCertificate(resolvedCertPath);
    if (!certInfo.valido) {
      this.debugLog('Certificado inválido', certInfo);
      throw new Error(`Certificado inválido: ${certInfo.error}`);
    }
    this.debugLog('Certificado válido. Días restantes:', certInfo.diasRestantes);

    if (!this.instanceManager) {
      this.instanceManager = new AfipInstanceManager(() => ({
        cuit: Number(cfg.cuit),
        production: cfg.entorno === 'produccion',
        cert: resolvedCertPath,
        key: resolvedKeyPath
      }));
    }
    const instance = await this.instanceManager.getInstance();
    this.debugLog('Instancia AFIP creada/reutilizada', { production: cfg.entorno === 'produccion' });
    return (this.afipInstance = instance);
  }

  // ====== Consulta pública para UI (Modo Caja) ======
  public async consultarCotizacionMoneda(options?: {
    monIdText?: string;
    modo?: 'ULTIMA' | 'HABIL_ANTERIOR';
    baseDate?: string; // YYYYMMDD
  }): Promise<{ monId: string; monCotiz: number; fchCotiz: string; fuente: string; modo: string }>{
    const monId = this.resolveMonId(options?.monIdText || 'DOL');
    const modo = (options?.modo || 'ULTIMA');
    const today = (()=>{ const d = new Date(); const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); return `${y}${m}${dd}`; })();
    const base = (options?.baseDate && /^\d{8}$/.test(options.baseDate)) ? options.baseDate : today;
    const cacheKey = `${monId}|${modo}|${base}`;
    const cached = this.cotizCache.get(cacheKey);
    const now = Date.now();
    if (cached && (now - cached.ts) < 15*60*1000) {
      return cached.data;
    }
    const afip = await this.getAfipInstance();
    await this.ensureMonedasValid(afip, monId);
    let r: { valor:number; fecha:string };
    if (modo === 'HABIL_ANTERIOR') {
      const fch = this.prevDiaHabil(base);
      r = await this.getCotizacion(afip, monId, fch);
    } else {
      r = await this.getCotizacion(afip, monId);
    }
    const out = { monId, monCotiz: r.valor, fchCotiz: (r.fecha || '').replace(/-/g,'').slice(0,8), fuente: 'AFIP/WSFEv1(PROD)', modo };
    this.cotizCache.set(cacheKey, { ts: now, data: out });
    return out;
  }

  /**
   * Flujo ARCA (WSBFEv1) mínimo: solo validación local por ahora.
   * Próximo paso: integrar WSAA para wsbfev1 y BFEAuthorize/BFEGetPARAM.
   */
  private async solicitarCAEArca(comprobante: Comprobante): Promise<DatosAFIP> {
    // Validaciones ARCA locales
    const arcaVal = validateArcaRules(comprobante);
    if (!arcaVal.isValid) {
      throw new Error(`Reglas ARCA: ${arcaVal.errors.join('; ')}`);
    }
    if (arcaVal.warnings.length) {
      this.debugLog('ARCA warnings', arcaVal.warnings);
    }

    // Placeholder: hasta integrar BFEAuthorize, devolvemos error claro
    throw new Error('ARCA activo: falta integrar WSAA/BFEAuthorize. Configurar homologación ARCA.');
  }

  /**
   * Solicita CAE para un comprobante con control de idempotencia
   */
  async solicitarCAE(comprobante: Comprobante): Promise<DatosAFIP> {
    try {
      this.debugLog('solicitarCAE: inicio', {
        tipo: comprobante.tipo,
        puntoVenta: comprobante.puntoVenta,
        fecha: comprobante.fecha,
        total: comprobante.totales?.total
      });
      // Validar comprobante básico
      const errors = AfipHelpers.validateComprobante(comprobante);
      if (errors.length > 0) {
        this.debugLog('solicitarCAE: validación local falló', errors);
        throw new Error(`Errores de validación: ${errors.join(', ')}`);
      }

      const isArca = (process.env.AFIP_MODE || '').toLowerCase() === 'arca';
      // Si ARCA está activo, por ahora reutilizamos flujo WSFE (consolidado) incluyendo IVARECEPTOR
      if (isArca) this.debugLog('AFIP_MODE=arca → usando flujo consolidado WSFE con IVARECEPTOR (compat)');

      const afip = await this.getAfipInstance();
      const cfg = getDb().getAfipConfig()!;
      
      // Tomar pto de venta desde UI si viene, caso contrario usar config
      const ptoVta = comprobante.puntoVenta || cfg.pto_vta;
      // Priorizar código numérico si viene establecido (evita ambigüedad NC A/B/C)
      const tipoCbte = ((): number => {
        const cbteNum = Number((comprobante as any)?.cbteTipo || 0);
        if (Number.isFinite(cbteNum) && cbteNum > 0) return cbteNum;
        return AfipHelpers.mapTipoCbte(comprobante.tipo);
      })();
      this.debugLog('Parámetros AFIP', { ptoVta, tipoCbte });


      // VALIDACIÓN CON FEParamGet* - NUEVA FUNCIONALIDAD
      const validator = new AfipValidator(afip);
      // Validación previa con Padrón 13 si la UI lo solicita y hay CUIT de receptor
      const debeValidarPadron = (comprobante as any)?.validarPadron13 === true;
      if (debeValidarPadron && comprobante?.cliente?.cuit) {
        try {
          const pad13 = await consultarPadronAlcance13(Number(comprobante.cliente.cuit));
          if (!pad13 || !pad13?.idPersona) {
            const msg = `Padrón 13: CUIT ${comprobante.cliente.cuit} no encontrado o inválido`;
            this.logger.logError('padron13_validation', new Error(msg), { cuit: comprobante.cliente.cuit });
            throw new Error(msg);
          }
        } catch (e: any) {
          const msg = `Error validando Padrón 13: ${e?.message || e}`;
          this.logger.logError('padron13_validation_error', e instanceof Error ? e : new Error(String(e)));
          throw new Error(msg);
        }
      }
      const validationParams: ValidationParams = {
        cbteTipo: tipoCbte,
        concepto: comprobante.concepto || 1,
        docTipo: comprobante.docTipo || 99,
        monId: comprobante.monId || 'PES',
        ptoVta: ptoVta,
        cuit: cfg.cuit
      };

      // Ejecutar validación con AFIP
      const validationResult = await validator.validateComprobante(validationParams);
      
      if (!validationResult.isValid) {
        const errorMessage = `Validación AFIP falló: ${validationResult.errors.join('; ')}`;
        this.logger.logError('solicitarCAE', new Error(errorMessage), { 
          comprobante, 
          validationResult 
        });
        this.debugLog('Validación FEParamGet* FAIL', validationResult);
        throw new Error(errorMessage);
      }

      // Log warnings si existen
      if (validationResult.warnings.length > 0) {
        this.logger.logRequest('validationWarnings', { warnings: validationResult.warnings });
        this.debugLog('Validación FEParamGet* warnings', validationResult.warnings);
      }

      // Determinar si es MiPyME y CbteTipo aplicable
      const isMiPyme = (comprobante as any)?.modoFin && ['ADC','SCA'].includes(String((comprobante as any).modoFin));
      const miPymeCbteTipo = isMiPyme ? AfipHelpers.mapToMiPymeCbte(tipoCbte) : tipoCbte;

      // Obtener último número autorizado con resiliencia (servicio según tipo)
      const last = await this.resilienceWrapper.execute(
        () => isMiPyme ? afip.ElectronicBillingMiPyme.getLastVoucher(ptoVta, miPymeCbteTipo)
                       : afip.ElectronicBilling.getLastVoucher(ptoVta, tipoCbte),
        'getLastVoucher'
      ) as number;
      
      const numero = Number(last) + 1;
      this.debugLog('getLastVoucher OK', { last: Number(last), siguiente: numero });

      // CONTROL DE IDEMPOTENCIA - NUEVA FUNCIONALIDAD
      const idempotencyResult = await this.idempotencyManager.checkIdempotency(
        ptoVta, 
        tipoCbte, 
        numero,
        { comprobante, validationParams }
      );
      this.debugLog('Idempotencia', idempotencyResult);

      // Si es un duplicado exitoso, retornar CAE existente
      if (idempotencyResult.isDuplicate && !idempotencyResult.shouldProceed && idempotencyResult.existingCae) {
        this.logger.logRequest('idempotency_hit', { 
          ptoVta, tipoCbte, numero, 
          existingCae: idempotencyResult.existingCae 
        });

        // Construir QR con CAE existente
        const qrData = AfipHelpers.buildQrUrl({
          cuit: Number(cfg.cuit),
          ptoVta,
          tipoCmp: tipoCbte,
          nroCmp: numero,
          importe: comprobante.totales.total,
          fecha: comprobante.fecha,
          cae: idempotencyResult.existingCae
        });

        return { 
          numero, 
          cae: idempotencyResult.existingCae, 
          vencimientoCAE: idempotencyResult.existingCaeVto || '', 
          qrData 
        };
      }

      // Caso límite: duplicado sin CAE cargado (registro inconsistente) → proceder igualmente
      if (idempotencyResult.isDuplicate && !idempotencyResult.shouldProceed && !idempotencyResult.existingCae) {
        this.logger.logRequest('idempotency_inconsistent_duplicate', { ptoVta, tipoCbte, numero });
        idempotencyResult.shouldProceed = true as any;
      }

      // Si hay error en idempotencia, fallar
      if (idempotencyResult.error) {
        throw new Error(`Error de idempotencia: ${idempotencyResult.error}`);
      }

      // Si no debe proceder, fallar
      if (!idempotencyResult.shouldProceed) {
        throw new Error('Comprobante en proceso, intente nuevamente en unos momentos');
      }

      // Consolidar totales por alícuota (enviar SOLO montos consolidados a AFIP)
      const totales = AfipHelpers.consolidateTotals(comprobante.items);
      const ivaArray = totales.Iva;
      this.debugLog('Construyendo request createVoucher (consolidado)', totales);

      // Construir request para AFIP
      // Normalizaciones de tipos/formatos exigidos por WSFE
      const concepto = Number(comprobante.concepto || 1);
      const docTipo = Number(comprobante.docTipo || 99);
      const docNro = comprobante.cliente?.cuit
        ? Number(String(comprobante.cliente.cuit).replace(/\D/g, ''))
        : 0;
      const cbteFch = String(comprobante.fecha).replace(/-/g, '');
      // Moneda (pedido cliente)
      const monIdNorm = this.resolveMonId((comprobante as any)?.moneda?.monIdText || comprobante.monId || 'PES');
      await this.ensureMonedasValid(afip, monIdNorm);
      let monCotizNum = 1; let fchCotizUsed: string | undefined; const canMis = ((((comprobante as any)?.can_mis_mon_ext) || (comprobante as any)?.moneda?.canMisMonExt || 'N').toUpperCase() as 'S'|'N');
      if (monIdNorm !== 'PES') {
        if (canMis === 'S') {
          fchCotizUsed = this.prevDiaHabil(cbteFch);
          const { valor, fecha } = await this.getCotizacion(afip, monIdNorm, fchCotizUsed);
          monCotizNum = valor; if (fecha) fchCotizUsed = fecha.replace(/-/g,'');
        } else {
          const { valor, fecha } = await this.getCotizacion(afip, monIdNorm);
          monCotizNum = valor; fchCotizUsed = fecha ? fecha.replace(/-/g,'') : undefined;
        }
      }
      // Selección flexible: si 'N' y viene COTIZADOL (>0), preferirlo como candidato fiscal
      const oficialWsfe = monCotizNum;
      let fuenteUsada: 'WSFE'|'COTIZADOL' = 'WSFE';
      try {
        const hint = Number((comprobante as any)?.cotiza_hint);
        if (monIdNorm !== 'PES' && canMis === 'N' && Number.isFinite(hint) && hint > 0) {
          monCotizNum = hint;
          fuenteUsada = 'COTIZADOL';
        }
      } catch {}

      const request: any = {
        CantReg: 1,
        PtoVta: ptoVta,
        CbteTipo: isMiPyme ? miPymeCbteTipo : tipoCbte,
        Concepto: concepto,
        DocTipo: docTipo,
        DocNro: docNro,
        CbteDesde: numero,
        CbteHasta: numero,
        CbteFch: cbteFch,
        ImpTotal: totales.ImpTotal,
        ImpTotConc: totales.ImpTotConc,
        ImpNeto: totales.ImpNeto,
        ImpOpEx: totales.ImpOpEx,
        ImpIVA: totales.ImpIVA,
        ImpTrib: totales.ImpTrib,
        MonId: monIdNorm,
        MonCotiz: monCotizNum,
        Iva: ivaArray,
        CanMisMonExt: canMis
      };
      // Notas de Crédito: importes siempre positivos
      const isNotaCredito = [3, 8, 13].includes(Number(request.CbteTipo));
      if (isNotaCredito) {
        try {
          const abs2 = (n: any) => Math.abs(Number(n || 0));
          request.ImpTotal = abs2(request.ImpTotal);
          request.ImpTotConc = abs2(request.ImpTotConc);
          request.ImpNeto = abs2(request.ImpNeto);
          request.ImpOpEx = abs2(request.ImpOpEx);
          request.ImpIVA = abs2(request.ImpIVA);
          request.ImpTrib = abs2(request.ImpTrib);
          if (Array.isArray(request.Iva)) {
            request.Iva = request.Iva.map((x: any) => ({ Id: Number(x.Id), BaseImp: abs2(x.BaseImp), Importe: abs2(x.Importe) }));
          }
        } catch {}
      }
      // Política de moneda flexible
      const policy = { officialSource: 'WSFE', selection: canMis === 'S' ? 'exact' : 'tolerant', maxUpPercent: 2, maxDownPercent: 400 } as const;
      const oficial = oficialWsfe; const upper = Number((oficial * 1.02).toFixed(6)); const lower = Number((oficial / 5).toFixed(6));
      const candidate = monCotizNum; const inRange = candidate >= lower && candidate <= upper;
      if (monIdNorm !== 'PES') {
        if (policy.selection === 'exact' && Math.abs(candidate - oficial) > 0.000001) throw new Error('PERMANENT_COTIZ_EXACT_MISMATCH');
        if (policy.selection === 'tolerant' && !inRange) throw new Error('PERMANENT_COTIZ_OUT_OF_RANGE');
      }
      try { console.warn('[FACT] FE Moneda', { monId: monIdNorm, canMisMonExt: canMis, policy, monCotiz: monCotizNum, oficial, fuente: fuenteUsada, fchOficial: fchCotizUsed }); } catch {}
      // Nota: si hubo hint y se usó como fiscal, 'fuente'='COTIZADOL'. Si no, se registra como hint solo visual si aplica.
      try { if ((monIdNorm === 'DOL' || monIdNorm === 'EUR') && fuenteUsada === 'WSFE') { const hint = Number((comprobante as any)?.cotiza_hint); if (hint > 0 && Number(request.MonCotiz) === 1) { (request as any)._cotizaHint = hint; } } } catch {}
      // Condicion Frente al IVA del receptor (obligatorio a futuro). Enviar SIEMPRE en PROD.
      try {
        const categoria = ((): 'CF'|'RI'|'MT'|'EX'|undefined => {
          const v = String(comprobante?.cliente?.condicionIva || '').toUpperCase();
          if (v === 'CF' || /CONSUMIDOR\s+FINAL/.test(v)) return 'CF';
          if (v === 'RI' || /RESPONSABLE\s+INSCRIPTO/.test(v)) return 'RI';
          if (v === 'MT' || /MONOTRIB/.test(v)) return 'MT';
          if (v === 'EX' || /EXENTO/.test(v)) return 'EX';
          // Inferir CF si DocTipo=99 y DocNro=0
          if (docTipo === 99 && Number(docNro||0) === 0) return 'CF';
          return undefined;
        })();
        const condId = await getCondicionIvaReceptorId({
          afip,
          cbteTipo: isMiPyme ? miPymeCbteTipo : tipoCbte,
          receptorHint: { docTipo, docNro, categoria }
        });
        if (typeof condId === 'number' && Number.isFinite(condId)) {
          (request as any).CondicionIVAReceptorId = Number(condId);
        }
      } catch {
        // Fallback mínimo: CF → 5 (para no bloquear si catálogo falla)
        if (docTipo === 99 && Number(docNro||0) === 0) {
          (request as any).CondicionIVAReceptorId = 5;
        }
      }
      // Regla general: si ImpIVA es 0, no informar Iva/AlicIva (evita obs 10018)
      try {
        const impIvaNum = Number(request.ImpIVA);
        if (!impIvaNum || impIvaNum === 0) {
          delete request.Iva;
        }
      } catch {}
      // Tributos opcionales
      if (Array.isArray((comprobante as any).tributos) && (comprobante as any).tributos.length > 0) {
        request.Tributos = (comprobante as any).tributos.map((t: any) => ({
          Id: Number(t.Id), Desc: String(t.Desc), BaseImp: Number(t.BaseImp), Alic: Number(t.Alic), Importe: Number(t.Importe)
        }));
      }

      // ARCA / Provinciales: IVARECEPTOR (si hay condición IVA del receptor)
      try {
        const ivarc = AfipHelpers.mapCondicionIvaReceptorToArcaCode(comprobante.cliente?.condicionIva);
        if (ivarc !== undefined) (request as any).IVARECEPTOR = ivarc;
      } catch {}

      // Política actual: solo RI. No se aplican ajustes especiales para Monotributo.

      // Fechas de servicio: obligatorias si Concepto es 2 o 3
      if (Number(request.Concepto) === 2 || Number(request.Concepto) === 3) {
        const normalize = (s?: string) => (s ? String(s).replace(/-/g, '') : undefined);
        const fdesde = normalize(comprobante.FchServDesde);
        const fhasta = normalize(comprobante.FchServHasta);
        const fvto = normalize(comprobante.FchVtoPago);
        if (fdesde) request.FchServDesde = fdesde;
        if (fhasta) request.FchServHasta = fhasta;
        if (fvto) request.FchVtoPago = fvto;
      }

      // Comprobantes asociados (NC/ND): construir con {Tipo,PtoVta,Nro,Cuit,CbteFch} si están disponibles
      const ensureYyyymmdd = (s?: string) => {
        if (!s) return undefined as any;
        const t = String(s).trim();
        if (/^\d{8}$/.test(t)) return t as any;
        if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t.replace(/-/g, '') as any;
        const m = t.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
        if (m) {
          const yy = m[3].length === 2 ? `20${m[3]}` : m[3];
          return `${yy}${m[2]}${m[1]}` as any;
        }
        return undefined as any;
      };
      const assocInput = ((): any[] => {
        const a1 = (comprobante as any)?.comprobantesAsociados;
        if (Array.isArray(a1) && a1.length > 0) return a1;
        const a2 = (comprobante as any)?.cbtesAsoc;
        if (Array.isArray(a2) && a2.length > 0) return a2;
        const a3 = (comprobante as any)?.cbteAsoc;
        if (a3 && typeof a3 === 'object') return [a3];
        return [];
      })();
      try {
        if (([2,7,3,8,13] as number[]).includes(Number(request.CbteTipo))) {
          console.warn('[AFIP][NC] CbtesAsoc.input', assocInput);
        }
      } catch {}
      if (([2, 7, 3, 8, 13] as number[]).includes(Number(request.CbteTipo))) {
        if (assocInput.length > 0) {
          request.CbtesAsoc = assocInput.map((x: any) => {
            const mapped = {
              Tipo: Number(x.Tipo ?? x.CbteTipo ?? x.tipo ?? 0),
              PtoVta: Number(x.PtoVta ?? x.ptoVta ?? x.pv ?? 0),
              Nro: Number(x.Nro ?? x.numero ?? x.nro ?? 0),
              Cuit: x.Cuit ? Number(String(x.Cuit).replace(/\D/g, '')) : (x.cuit ? Number(String(x.cuit).replace(/\D/g, '')) : undefined),
              CbteFch: ensureYyyymmdd(x.CbteFch ?? x.fecha ?? x.fch)
            } as any;
            // Completar Cuit emisor del comprobante asociado si no fue provisto
            if (!mapped.Cuit) mapped.Cuit = Number(String(cfg.cuit).replace(/\D/g, ''));
            return mapped;
          }).filter((z: any) => Number(z.Tipo) && Number(z.PtoVta) && Number(z.Nro));
        }
        const isNcAyB = Number(request.CbteTipo) === 3 || Number(request.CbteTipo) === 8;
        const hasAsoc = Array.isArray(request.CbtesAsoc) && request.CbtesAsoc.length > 0;
        if (isNcAyB) {
          if (hasAsoc) {
            try { console.warn('[AFIP][NC] CbtesAsoc.mapped', request.CbtesAsoc); } catch {}
            // Enriquecer asociados con datos faltantes (CbteFch/Cuit) consultando AFIP si es necesario
            try {
              const enrichOne = async (a: any) => {
                if (!a) return;
                const needsDate = !a.CbteFch || String(a.CbteFch).trim().length === 0;
                const needsCuit = !a.Cuit || Number(a.Cuit) === 0;
                if (!needsDate && !needsCuit) return;
                const info: any = await this.resilienceWrapper.execute(
                  () => this.getAfipInstance().then(af => af.ElectronicBilling.getVoucherInfo(Number(a.PtoVta), Number(a.Tipo), Number(a.Nro))),
                  'getVoucherInfo'
                );
                const det = info?.ResultGet ?? info;
                if (needsDate) {
                  try {
                    const f = String(det?.CbteFch || det?.FchEmi || det?.FchCbte || det?.Fecha || '').replace(/-/g,'');
                    if (/^\d{8}$/.test(f)) a.CbteFch = f;
                  } catch {}
                }
                if (needsCuit) {
                  try { a.Cuit = Number(String(cfg.cuit).replace(/\D/g, '')); } catch {}
                }
              };
              for (const a of (request.CbtesAsoc as any[])) { try { await enrichOne(a); } catch {} }
              try { console.warn('[AFIP][NC] CbtesAsoc.enriched', request.CbtesAsoc); } catch {}
            } catch {}
          } else {
            // Fallback por período: PeriodoAsoc = 1° del mes a fecha de emisión
            const fch = ensureYyyymmdd(request.CbteFch) || String(comprobante.fecha || '').replace(/-/g,'');
            const from = require('./afip/helpers').monthStartFromYYYYMMDD(fch);
            request.PeriodoAsoc = { FchDesde: from, FchHasta: fch };
            // Exclusividad
            delete request.CbtesAsoc;
            try { console.warn('[AFIP][NC] PeriodoAsoc.fallback', request.PeriodoAsoc); } catch {}
          }
        } else {
          // Para ND (2/7) y NC C (13) mantener comportamiento actual: asociado requerido
          if (!hasAsoc) {
            throw new Error('PermanentError: Falta comprobante asociado para Nota/Débito');
          }
        }
      }

      // Solicitar CAE con resiliencia (servicio según tipo)
      const response = await this.resilienceWrapper.execute(
        () => isMiPyme ? afip.ElectronicBillingMiPyme.createVoucher({ ...request, ModoFin: (comprobante as any).modoFin })
                       : afip.ElectronicBilling.createVoucher(request),
        'createVoucher'
      ) as AfipVoucherResponse;

      const cae: string = String(response.CAE);
      const caeVto: string = String(response.CAEFchVto);
      const observaciones = Array.isArray(response.Observaciones) ? response.Observaciones : undefined;
      this.debugLog('createVoucher OK', { cae, caeVto });

      // Marcar como exitoso en control de idempotencia
      await this.idempotencyManager.markAsApproved(ptoVta, tipoCbte, numero, cae, caeVto);

      // Construir QR
      const qrData = AfipHelpers.buildQrUrl({
        cuit: Number(cfg.cuit),
        ptoVta,
        tipoCmp: tipoCbte,
        nroCmp: numero,
        importe: comprobante.totales.total,
        fecha: comprobante.fecha,
        cae
      });

      return { numero, cae, vencimientoCAE: caeVto, qrData, observaciones };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.debugLog('solicitarCAE ERROR', errorMessage);
      
      // Marcar como fallido en control de idempotencia si tenemos los datos
      try {
        const cfg = getDb().getAfipConfig();
        if (cfg) {
          const ptoVta = cfg.pto_vta || comprobante.puntoVenta;
          const tipoCbte = AfipHelpers.mapTipoCbte(comprobante.tipo);
          
          // Solo intentar marcar como fallido si ya tenemos el número
          // Si el error ocurrió antes de obtener el número, no podemos marcarlo
          if (comprobante.numero) {
            await this.idempotencyManager.markAsFailed(ptoVta, tipoCbte, comprobante.numero, errorMessage);
          }
        }
      } catch (markError) {
        // Si falla el marcado, solo logear
        this.logger.logError('markAsFailed_error', markError instanceof Error ? markError : new Error(String(markError)));
      }

      this.logger.logError('solicitarCAE', error instanceof Error ? error : new Error(errorMessage), { comprobante });
      throw new Error(`Error solicitando CAE: ${errorMessage}`);
    }
  }

  /**
   * Solicita CAE para un comprobante y lo procesa con administraciones provinciales
   */
  async solicitarCAEConProvincias(comprobante: Comprobante): Promise<ResultadoProvincial> {
    const startTime = Date.now();
    
    this.logger.logRequest('solicitarCAE_con_provincias_inicio', {
      tipo: comprobante.tipo,
      puntoVenta: comprobante.puntoVenta,
      total: comprobante.totales.total,
      cuitEmisor: comprobante.empresa.cuit
    });
    this.debugLog('solicitarCAEConProvincias: inicio');

    try {
      // 1. Solicitar CAE a AFIP primero
      const afipResult = await this.solicitarCAE(comprobante);
      this.debugLog('AFIP CAE obtenido', { cae: afipResult.cae, vto: afipResult.vencimientoCAE });
      
      this.logger.logRequest('afip_cae_obtenido', {
        cae: afipResult.cae,
        vencimiento: afipResult.vencimientoCAE,
        numero: comprobante.numero
      });

      // 2. Preparar datos para servicios provinciales
      const cfg = getDb().getAfipConfig()!;
      const ptoVta = cfg.pto_vta || comprobante.puntoVenta;
      const tipoCbte = AfipHelpers.mapTipoCbte(comprobante.tipo);
      
      // Obtener número del comprobante (calculado en solicitarCAE)
      const last = await this.resilienceWrapper.execute(
        () => this.getAfipInstance().then(afip => afip.ElectronicBilling.getLastVoucher(ptoVta, tipoCbte)),
        'getLastVoucher'
      ) as number;
      const numero = Number(last);
      this.debugLog('Número AFIP (con provincias)', numero);

      const provincialParams: ComprobanteProvincialParams = {
        cae: afipResult.cae,
        caeVencimiento: afipResult.vencimientoCAE,
        numero,
        puntoVenta: ptoVta,
        tipoComprobante: tipoCbte,
        fecha: comprobante.fecha,
        cuitEmisor: comprobante.empresa.cuit,
        razonSocialEmisor: comprobante.empresa.razonSocial,
        cuitReceptor: comprobante.cliente?.cuit,
        razonSocialReceptor: comprobante.cliente?.razonSocial,
        condicionIvaReceptor: comprobante.cliente?.condicionIva,
        ivareceptor: AfipHelpers.mapCondicionIvaReceptorToArcaCode(comprobante.cliente?.condicionIva),
        neto: comprobante.totales.neto,
        iva: comprobante.totales.iva,
        total: comprobante.totales.total,
        detalle: comprobante.items.map(item => ({
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          alicuotaIva: item.alicuotaIva
        })),
        observaciones: comprobante.observaciones,
        codigoOperacion: comprobante.codigoOperacion
      };

      // 3. Procesar con administraciones provinciales
      const provinciaManager = getProvinciaManager();
      const resultado = await provinciaManager.procesarComprobante(provincialParams);
      this.debugLog('Resultado provincial', { estado: resultado.estado, servicio: resultado.provincial?.servicio });

      this.logger.logRequest('procesamiento_provincial_completado', {
        cae: afipResult.cae,
        estadoFinal: resultado.estado,
        servicioProvincial: resultado.provincial?.servicio,
        duracion: Date.now() - startTime
      });

      return resultado;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.debugLog('solicitarCAEConProvincias ERROR', errorMessage);
      
      this.logger.logError('solicitarCAE_con_provincias_error', error instanceof Error ? error : new Error(errorMessage), {
        comprobante: {
          tipo: comprobante.tipo,
          puntoVenta: comprobante.puntoVenta,
          total: comprobante.totales.total
        },
        duracion: Date.now() - startTime
      });

      // Si el error es de AFIP, devolver resultado de fallo completo
      return {
        afip: {
          success: false,
          error: errorMessage
        },
        provincial: null,
        estado: 'AFIP_FAIL'
      };
    }
  }

  /**
   * Verifica el estado de los servidores de AFIP
   */
  async checkServerStatus(): Promise<ServerStatus> {
    try {
      const afip = await this.getAfipInstance();
      
      const status = await this.resilienceWrapper.execute(
        () => afip.ElectronicBilling.getServerStatus(),
        'getServerStatus'
      ) as any;
      this.debugLog('ServerStatus', status);

      return {
        appserver: status.AppServer,
        dbserver: status.DbServer,
        authserver: status.AuthServer
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.logError('checkServerStatus', error instanceof Error ? error : new Error(errorMessage));
      throw new Error(`Error verificando estado de servidores: ${errorMessage}`);
    }
  }

  /**
   * Valida el certificado configurado
   */
  validarCertificado(): CertificadoInfo {
    try {
      const cfg = getDb().getAfipConfig();
      if (!cfg) {
        this.debugLog('validarCertificado: no hay configuración');
        return {
          valido: false,
          fechaExpiracion: new Date(),
          diasRestantes: 0,
          error: 'No hay configuración AFIP'
        };
      }

      const info = CertificateValidator.validateCertificate(cfg.cert_path);
      this.debugLog('validarCertificado:', info);
      return info;

    } catch (error) {
      return {
        valido: false,
        fechaExpiracion: new Date(),
        diasRestantes: 0,
        error: `Error validando certificado: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Obtiene el último número autorizado para un punto de venta y tipo
   */
  async getUltimoAutorizado(puntoVenta: number, tipoComprobante: TipoComprobante | number): Promise<number> {
    try {
      const afip = await this.getAfipInstance();
      const tipoCbte = ((): number => {
        if (typeof tipoComprobante === 'number') return tipoComprobante;
        return AfipHelpers.mapTipoCbte(tipoComprobante);
      })();

      const last = await this.resilienceWrapper.execute(
        () => afip.ElectronicBilling.getLastVoucher(puntoVenta, tipoCbte),
        'getLastVoucher'
      ) as number;

      const n = Number(last);
      this.debugLog('getUltimoAutorizado', { puntoVenta, tipoComprobante, last: n });
      return n;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.logError('getUltimoAutorizado', error instanceof Error ? error : new Error(errorMessage), { puntoVenta, tipoComprobante });
      throw new Error(`Error obteniendo último autorizado: ${errorMessage}`);
    }
  }

  /**
   * Obtiene los logs de AFIP para una fecha específica
   */
  getLogs(date?: string) {
    return this.logger.getLogs(date);
  }

  /**
   * Obtiene información de validación de AFIP para debugging
   */
  async getValidationInfo(): Promise<any> {
    try {
      const afip = await this.getAfipInstance();
      const validator = new AfipValidator(afip);
      return await validator.getValidationInfo();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.logError('getValidationInfo', error instanceof Error ? error : new Error(errorMessage));
      throw new Error(`Error obteniendo información de validación: ${errorMessage}`);
    }
  }

  /**
   * Obtiene estadísticas de idempotencia
   */
  getIdempotencyStats(): { pending: number; approved: number; failed: number } {
    return this.idempotencyManager.getStats();
  }

  /**
   * Limpia comprobantes antiguos
   */
  cleanupIdempotency(): number {
    return this.idempotencyManager.cleanup();
  }

  /**
   * Obtiene comprobantes por estado para debugging
   */
  getComprobantesByEstado(estado: 'PENDING' | 'APPROVED' | 'FAILED'): any[] {
    return this.idempotencyManager.getComprobantesByEstado(estado);
  }

  /**
   * Obtiene estadísticas de resiliencia
   */
  getResilienceStats(): any {
    return this.resilienceWrapper.getStats();
  }

  /**
   * Obtiene el estado del circuit breaker
   */
  getCircuitBreakerState(): any {
    return this.resilienceWrapper.getCircuitBreakerState();
  }

  /**
   * Obtiene estadísticas del circuit breaker
   */
  getCircuitBreakerStats(): any {
    return this.resilienceWrapper.getCircuitBreakerStats();
  }

  /**
   * Fuerza el cierre del circuit breaker
   */
  forceCloseCircuitBreaker(): void {
    this.resilienceWrapper.forceCloseCircuitBreaker();
  }

  /**
   * Fuerza la apertura del circuit breaker
   */
  forceOpenCircuitBreaker(): void {
    this.resilienceWrapper.forceOpenCircuitBreaker();
  }

  /**
   * Resetea las estadísticas de resiliencia
   */
  resetResilienceStats(): void {
    this.resilienceWrapper.resetStats();
  }

  /**
   * Obtiene el tiempo restante antes del próximo intento del circuit breaker
   */
  getTimeUntilNextAttempt(): number {
    return this.resilienceWrapper.getTimeUntilNextAttempt();
  }

  /**
   * Verifica si el circuit breaker está listo para half-open
   */
  isReadyForHalfOpen(): boolean {
    return this.resilienceWrapper.isReadyForHalfOpen();
  }

  /**
   * Valida el CAE de una factura antes de una operación
   */
  validateCAEBeforeOperation(
    facturaId: number,
    operation: string
  ): void {
    caeValidator.validateBeforeOperation(facturaId, operation);
  }

  /**
   * Valida el CAE de un comprobante antes de una operación
   */
  validateCAEBeforeOperationByComprobante(
    numero: number,
    ptoVta: number,
    tipoCbte: number,
    operation: string
  ): void {
    caeValidator.validateBeforeOperationByComprobante(numero, ptoVta, tipoCbte, operation);
  }

  /**
   * Obtiene el estado del CAE de una factura
   */
  getCAEStatus(facturaId: number): any {
    return caeValidator.getCAEStatusFromFactura(facturaId);
  }

  /**
   * Obtiene el estado del CAE de un comprobante
   */
  getCAEStatusByComprobante(
    numero: number,
    ptoVta: number,
    tipoCbte: number
  ): any {
    return caeValidator.getCAEStatusFromComprobante(numero, ptoVta, tipoCbte);
  }

  /**
   * Busca facturas con CAE próximo a vencer
   */
  findFacturasWithExpiringCAE(warningThresholdHours: number = 48): any[] {
    return caeValidator.findFacturasWithExpiringCAE(warningThresholdHours);
  }

  /**
   * Busca facturas con CAE vencido
   */
  findFacturasWithExpiredCAE(): any[] {
    return caeValidator.findFacturasWithExpiredCAE();
  }

  /**
   * Obtiene estadísticas de validación de tiempo
   */
  getTimeValidationStats(): any {
    return timeValidator.getStats();
  }

  /**
   * Obtiene el estado de validación de tiempo
   */
  getTimeValidationStatus(): any {
    return timeValidator.getStatus();
  }

  /**
   * Fuerza una validación de tiempo inmediata
   */
  async forceTimeValidation(): Promise<any> {
    return timeValidator.validateSystemTime();
  }

  /** Limpia la instancia de AFIP para forzar renovaciones de TA */
  clearInstance(): void {
    this.instanceManager?.clearCache();
    this.afipInstance = null;
    // Limpiar archivos temporales si se usó modo seguro
    try { this.tempCleanup?.(); } catch {}
    this.tempCleanup = null;
    this.debugLog('Instancia AFIP limpiada');
  }
}

// Exportar instancia singleton
export const afipService = new AfipService();

// Exportar función legacy para compatibilidad
export async function solicitarCAE(comprobante: Comprobante): Promise<DatosAFIP> {
  return afipService.solicitarCAE(comprobante);
}


