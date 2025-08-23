import { config } from 'dotenv';

// Cargar variables de entorno específicas para tests
config({ path: '.env.test' });

// Configurar variables de entorno por defecto para tests
process.env.NODE_ENV = 'test';
process.env.AFIP_ENTORNO = 'testing';

// Configuración de NTP para tests
process.env.NTP_SERVER = 'pool.ntp.org';
process.env.NTP_PORT = '123';
process.env.NTP_ALLOWED_DRIFT = '60000';
process.env.NTP_TIMEOUT = '5000';
process.env.NTP_CHECK_INTERVAL = '3600000';
process.env.NTP_ALERT_THRESHOLD = '30000';
process.env.NTP_MAX_FAILURES = '3';
process.env.NTP_SCHEDULER_ENABLED = 'false';

// Configuración de idempotencia para tests
process.env.IDEMPOTENCY_CLEANUP_DAYS = '30';
process.env.IDEMPOTENCY_RETRY_DELAY = '1000';

// Configuración de resiliencia para tests
process.env.AFIP_TIMEOUT = '30000';
process.env.AFIP_MAX_RETRIES = '3';
process.env.CIRCUIT_BREAKER_THRESHOLD = '5';
process.env.CIRCUIT_BREAKER_TIMEOUT = '60000';

// Configuración de base de datos para tests
process.env.DB_PATH = ':memory:'; // SQLite en memoria para tests

// Configuración de logging para tests
process.env.LOG_LEVEL = 'error'; // Solo errores en tests
process.env.LOG_TO_FILE = 'false';

// Configuración de timezone para tests
process.env.TZ = 'America/Argentina/Buenos_Aires';
