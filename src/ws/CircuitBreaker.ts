import { getQueueDB } from '../services/queue/QueueDB';

type CircuitState = 'UP' | 'DEGRADED' | 'DOWN' | 'HALF_OPEN';

export class CircuitBreaker {
  private state: CircuitState = 'UP';
  private failures = 0;
  private cooldownUntil = 0;
  private readonly failureThreshold: number;
  private readonly cooldownSec: number;

  constructor(opts?: { failureThreshold?: number; cooldownSec?: number }) {
    this.failureThreshold = Number(opts?.failureThreshold ?? (process.env.WS_CIRCUIT_FAILURE_THRESHOLD || 3));
    this.cooldownSec = Number(opts?.cooldownSec ?? (process.env.WS_CIRCUIT_COOLDOWN_SEC || 30));
    this.load();
  }

  private load() {
    try {
      const db = getQueueDB().driver;
      const row = db.prepare("SELECT value FROM queue_settings WHERE key='circuit_state'").get();
      if (row?.value) this.state = String(row.value) as CircuitState;
      const f = db.prepare("SELECT value FROM queue_settings WHERE key='circuit_failures'").get();
      if (f?.value) this.failures = Number(f.value) || 0;
      const cd = db.prepare("SELECT value FROM queue_settings WHERE key='circuit_cooldown_until'").get();
      if (cd?.value) this.cooldownUntil = Number(cd.value) || 0;
    } catch {}
  }

  private persist() {
    try {
      const db = getQueueDB().driver;
      db.prepare("INSERT INTO queue_settings(key,value) VALUES('circuit_state',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(this.state);
      db.prepare("INSERT INTO queue_settings(key,value) VALUES('circuit_failures',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(this.failures));
      db.prepare("INSERT INTO queue_settings(key,value) VALUES('circuit_cooldown_until',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(this.cooldownUntil));
    } catch {}
  }

  public getState(): CircuitState {
    // cooldown check
    if (this.state === 'DOWN' && Date.now() >= this.cooldownUntil) {
      this.state = 'HALF_OPEN';
      this.persist();
    }
    return this.state;
  }

  public recordFailure(): void {
    this.failures++;
    if (this.failures >= this.failureThreshold) {
      this.state = 'DOWN';
      this.cooldownUntil = Date.now() + (this.cooldownSec * 1000);
    } else if (this.state === 'UP') {
      this.state = 'DEGRADED';
    }
    this.persist();
  }

  public recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      // éxito en half-open → reset total
      this.reset();
      return;
    }
    // sucesos normales: mejorar estado
    if (this.state !== 'UP') this.state = 'UP';
    this.failures = 0;
    this.persist();
  }

  public reset(): void {
    this.failures = 0;
    this.cooldownUntil = 0;
    this.state = 'UP';
    this.persist();
  }

  public shouldPop(): boolean {
    const s = this.getState();
    if (s === 'DOWN') return false;
    if (s === 'HALF_OPEN') {
      // Permitir un solo job: controlador debe manejar concurrency=1
      return true;
    }
    return true;
  }
}


