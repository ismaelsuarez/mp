import axios from 'axios';
import https from 'https';
import fs from 'fs';

type Auth = { Token: string; Sign: string; Cuit: number };

export class ArcaClient {
  private baseUrl: string;
  private httpsAgent: https.Agent;

  constructor(baseUrl: string, certPath: string, keyPath: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    let cert: string | Buffer | undefined = undefined;
    let key: string | Buffer | undefined = undefined;
    try {
      if (certPath && fs.existsSync(certPath)) {
        cert = fs.readFileSync(certPath);
      }
    } catch {}
    try {
      if (keyPath && fs.existsSync(keyPath)) {
        key = fs.readFileSync(keyPath);
      }
    } catch {}
    // Crear agente solo si hay cert/key válidos; sino, usar default agent y permitir HTTP
    this.httpsAgent = new https.Agent({ cert, key, rejectUnauthorized: false });
  }

  async getCotizacion(_auth: Auth, monId: string, fecha?: string): Promise<{ MonId: string; MonCotiz: number; FchCotiz: string }> {
    // Endpoint de ejemplo desde documentación para homologación:
    // http://wswhomo.afip.gov.ar/wsbfev1/service.asmx?op=BFEGetCotizacion
    // Usamos axios con httpsAgent y query simple (en producción se usa SOAP/XML)
    const url = `${this.baseUrl}/BFEGetCotizacion`;
    const params: any = { MonId: monId };
    if (fecha) params.FchCotiz = fecha;

    console.log('[ArcaClient] Consultando:', { url, params });
    const { data } = await axios.get(url, { httpsAgent: this.httpsAgent, params });
    console.log('[ArcaClient] Respuesta tipo:', typeof data);
    console.log('[ArcaClient] Respuesta (primeros 500 chars):', String(data).substring(0, 500));
    
    if (typeof data === 'string') {
      // Intentar extraer de XML simple
      const get = (tag: string) => {
        const re = new RegExp(`<${tag}>([\\d.,-]+)<\\/${tag}>`);
        const m = data.match(re);
        return m ? m[1] : '';
      };
      const raw = get('MonCotiz') || get('monCotiz') || '';
      const fch = get('FchCotiz') || '';
      console.log('[ArcaClient] Parseado XML:', { raw, fch });
      const n = Number(String(raw).replace(',', '.'));
      if (Number.isFinite(n) && n > 0) {
        console.log('[ArcaClient] ✅ Cotización parseada:', { MonId: monId, MonCotiz: n, FchCotiz: fch });
        return { MonId: monId, MonCotiz: n, FchCotiz: fch };
      }
      // Si no se pudo parsear, lanzar
      console.error('[ArcaClient] ❌ No se pudo parsear la respuesta string');
      throw new Error('ARCA response no parseable');
    }
    // Si es objeto JSON compatible
    const MonCotiz = Number((data && (data.MonCotiz ?? data?.ResultGet?.MonCotiz)) || 0);
    const FchCotiz = String((data && (data.FchCotiz ?? data?.ResultGet?.FchCotiz)) || '');
    console.log('[ArcaClient] Parseado JSON:', { MonCotiz, FchCotiz });
    return { MonId: monId, MonCotiz, FchCotiz };
  }
}


