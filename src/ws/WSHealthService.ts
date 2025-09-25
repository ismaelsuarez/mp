import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';
import { resolveEndpoints, AfipEnv } from '../services/afip/AfipEndpoints';

type HealthStatus = 'up' | 'down' | 'degraded';

export interface WSHealthConfig {
  env?: AfipEnv;
  intervalSec?: number;
  timeoutMs?: number;
  http?: AxiosInstance;
  dnsLookup?: (hostname: string) => Promise<void>;
}

export class WSHealthService extends EventEmitter {
  private env: AfipEnv;
  private intervalSec: number;
  private timeoutMs: number;
  private timer: NodeJS.Timeout | null = null;
  private http: AxiosInstance;
  private dnsLookup: (hostname: string) => Promise<void>;
  public last: { status: HealthStatus; at: number; details?: any } | null = null;

  constructor(cfg?: WSHealthConfig) {
    super();
    this.env = cfg?.env || ((String(process.env.EMIT_MODE || 'prod').toLowerCase() === 'homo') ? 'homo' : 'prod');
    this.intervalSec = Number(cfg?.intervalSec || process.env.WS_HEALTH_INTERVAL_SEC || 20);
    this.timeoutMs = Number(cfg?.timeoutMs || process.env.WS_TIMEOUT_MS || 3000);
    this.http = cfg?.http || axios.create({ timeout: this.timeoutMs, validateStatus: () => true });
    this.dnsLookup = cfg?.dnsLookup || (async (hostname: string) => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const dns = require('dns').promises as typeof import('dns').promises;
      await dns.lookup(hostname);
    });
  }

  start(): void {
    if (this.timer) return;
    const run = async () => { try { await this.healthCheck(); } catch {} };
    this.timer = setInterval(run, this.intervalSec * 1000);
    run();
  }

  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = null; }

  async healthCheck(): Promise<HealthStatus> {
    const { wsaa, wsfe } = resolveEndpoints(this.env);
    const hosts = [wsaa, wsfe].map(u => { try { return new URL(u).hostname; } catch { return ''; } });
    let dnsOk = 0; let httpOk = 0;
    for (const h of hosts) {
      if (!h) continue;
      try { await this.dnsLookup(h); dnsOk++; } catch {}
    }
    for (const url of [wsaa, wsfe]) {
      try { const r = await this.http.head(url).catch(async () => await this.http.get(url)); if (r && r.status >= 200 && r.status < 600) httpOk++; } catch {}
    }
    const status: HealthStatus = (dnsOk === hosts.length && httpOk === 2)
      ? 'up'
      : (dnsOk > 0 || httpOk > 0) ? 'degraded' : 'down';
    this.last = { status, at: Date.now(), details: { dnsOk, httpOk, env: this.env } };
    this.emit(status, this.last);
    return status;
  }
}


