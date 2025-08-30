import axios from 'axios';
import https from 'https';

type Auth = { Token: string; Sign: string; Cuit: number };

export class ArcaClient {
  private baseUrl: string;
  private httpsAgent: https.Agent;

  constructor(baseUrl: string, certPath: string, keyPath: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.httpsAgent = new https.Agent({ cert: certPath, key: keyPath, rejectUnauthorized: false });
  }

  async getCotizacion(auth: Auth, monId: string, fecha?: string): Promise<{ MonId: string; MonCotiz: number; FchCotiz: string }> {
    // Endpoint de ejemplo desde documentación para homologación:
    // http://wswhomo.afip.gov.ar/wsbfev1/service.asmx?op=BFEGetCotizacion
    // Usamos axios con httpsAgent y query simple (en producción se usa SOAP/XML)
    const url = `${this.baseUrl}/BFEGetCotizacion`;
    const params: any = { MonId: monId };
    if (fecha) params.FchCotiz = fecha;

    const { data } = await axios.get(url, { httpsAgent: this.httpsAgent, params });
    return data;
  }
}


