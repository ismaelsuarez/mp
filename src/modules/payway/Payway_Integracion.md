# Integración Payway (Prisma) para Node.js + TypeScript + Electron
**Documento de diseño funcional y técnico**  
**Archivo:** `Payway_Integracion.md`  
**Estado:** Propuesta lista para implementación (MVP + Roadmap)  
**Autoría:** Ismael + Mila (GPT‑5 Thinking)  
**Fecha:** 2025‑10‑15

---

## 0) Objetivo y alcance

Agregar cobro con tarjeta vía **PayStore Terminals** (Payments / Reversals / Refunds / Settlements) sin romper el módulo actual de **facturación AFIP**, remitos, recibos, Mercado Pago, FTP, e‑mail e imágenes.  
Enfoque operativo: **`.fac` → orquestación de cobro → facturación → `.res`**.  
Sin `.env`: **configuración desde UI** (credenciales cifradas).

**Principios**  
- Mantener el stack actual (Node.js + TypeScript + Electron).  
- Evitar datos PCI: el **POS** captura la tarjeta; la app **ECR** solo orquesta.  
- **AR**: no se usa “confirmación de pago”. Flujo **request + polling** hasta estado final.  
- **Cobro primero → Factura después**. Si AFIP falla, **reversa** automática (**ALL‑OR‑NOTHING** default).  
- **Split (multi‑tarjeta)**: sesión de cobro con **varios pagos parciales**; facturar solo si `sum(aprobados) == TOTAL`.

---

## 1) Arquitectura y componentes

**ECR (nuestra app Electron)**  
- **Watcher `.fac`**: detecta archivo, parsea, valida y dispara el flujo Payway.  
- **Core Pagos (Payway Module)**:
  - `PaywayClient`: HTTP (axios) hacia APIs (Payments / Reversals / Refunds / Settlements).  
  - `PaywayService`: máquina de estados, idempotencia, split, reintentos y reversa.  
  - `SettlementJob`: cierre de lote manual y programado.
- **Facturación**: emite comprobante AFIP con datos ya contenidos en el `.fac`.  
- **UI Administración (Electron)**: **Medios de pago → Payway** (credenciales, terminales, preferencias, pruebas).  
- **Persistencia (Prisma)**: `PaymentSession`, `PaywayPayment`, `PaymentTerminal`, `PaymentProviderConfig`, `AppSecret`.

**Topología POS**
- 1 PC + 1 POS o **1 PC + N POS** (el operador del POS elige la transacción pendiente).  
- La PC **consulta** el estado de cada pago hasta resultado final.

---

## 2) Flujo end‑to‑end

1) **Entrada**: llega `.fac` con ítems/cliente/impuestos + bloque `COBRO: PAYWAY`.  
2) **Validación**: totales, IVA, receptor, política split.  
3) **Sesión**: crear `PaymentSession` (idempotente por `ID_ORDEN`).  
4) **Pagos** (uno o varios):  
   - Por cada `PAGO:` → `POST /payments` (importe parcial, cuotas, marca, plan, terminal…).  
   - **Polling** `GET /payments/{id}` (1.5 s, hasta 120 s) → `APROBADO` / `DECLINADO`.  
   - Split: acumular aprobados; si **DECLINADO** en política **ALL‑OR‑NOTHING**, revertir previos y cerrar.  
5) **Facturación**:  
   - Si `sum(aprobados) == TOTAL` → emitir factura AFIP.  
   - Si AFIP falla tras aprobados → **reversa referenciada** y marcar `ERROR_FACTURACION`.  
6) **Cierre de lote**: `POST /settlements` desde UI o cron diario.  
7) **Salida**: generar `.res` con resumen de pagos, facturación (CAE), reversas y observaciones.

---

## 3) Contrato `.fac` y `.res`

### 3.1. Extensión del `.fac` (bloque Payway)

```txt
# === COBRO PAYWAY (inicia sesión de pago) ===
COBRO: PAYWAY
ID_ORDEN: YP41-251003-171032
TOTAL: 71500.00
MONEDA: ARS
POLITICA_SPLIT: ALL_OR_NOTHING   # o PARCIAL_PERMITIDO

# Un sólo pago
PAGO: TARJETA=VISA; IMPORTE=71500.00; CUOTAS=3; PLAN=NACIONAL

# (opcional) Split multi-tarjeta
# PAGO: TARJETA=VISA;        IMPORTE=40000.00; CUOTAS=3; PLAN=NACIONAL
# PAGO: TARJETA=MASTERCARD;  IMPORTE=31500.00; CUOTAS=1; PLAN=NACIONAL

# (opcional) forzar terminal
# TERMINAL_ID: 12345678
# TERMINAL_SERIAL: ABC123456
```

> `ID_ORDEN` = idempotencia/correlación. `TOTAL` debe matchear los ítems.  
> Split: la suma de `PAGO` debe alcanzar `TOTAL` (o permitir parcial según política).

### 3.2. `.res` – Casos principales

**A) Aprobado + Facturado**
```txt
DIAHORA:03/10/25 17:10:45
ARCHIVO_ORIGEN:25100317103241.fac
ID_ORDEN:YP41-251003-171032
ESTADO:OK

PAGOS_CANT:1
PAGO_1_PROVIDER:PAYWAY
PAGO_1_ESTADO:APROBADO
PAGO_1_IMPORTE:71500.00
PAGO_1_MONEDA:ARS
PAGO_1_TARJETA:VISA
PAGO_1_CUOTAS:3
PAGO_1_PLAN:NACIONAL
PAGO_1_PAYMENT_ID:PW-9F3A1C8E2
PAGO_1_AUTORIZACION:123456
PAGO_1_TICKET:9876543210
PAGO_1_LAST4:1234

FACTURA_TIPO:B
PTO_VTA:0001
NRO:0001-00001234
CAE:70456789012345
VTO_CAE:10/10/2025
IMPORTE_TOTAL:71500.00
IVA_CONTENIDO:11020.66

OBS:Medio de pago: Tarjeta (Payway) VISA 3 cuotas – Aut 123456 – Ticket 9876543210
```

**B) Aprobado pero AFIP falla → Reversa**
```txt
DIAHORA:03/10/25 17:11:12
ARCHIVO_ORIGEN:25100317103241.fac
ID_ORDEN:YP41-251003-171032
ESTADO:ERROR_FACTURACION

PAGOS_CANT:1
PAGO_1_PROVIDER:PAYWAY
PAGO_1_ESTADO:APROBADO
PAGO_1_IMPORTE:71500.00
PAGO_1_MONEDA:ARS
PAGO_1_TARJETA:VISA
PAGO_1_CUOTAS:3
PAGO_1_PLAN:NACIONAL
PAGO_1_PAYMENT_ID:PW-9F3A1C8E2
PAGO_1_AUTORIZACION:123456
PAGO_1_TICKET:9876543210
PAGO_1_LAST4:1234

REVERSA_ESTADO:OK
REVERSA_ID:PW-RV-554433
REVERSA_MOTIVO:Error al emitir comprobante AFIP (timeout/CAE no obtenido)

FACTURA_TIPO:-
PTO_VTA:-
NRO:-
CAE:-
VTO_CAE:-

OBS:Se revirtió el cobro por falla de AFIP. Reintentar operación más tarde.
```

**C) Declinado**
```txt
DIAHORA:03/10/25 17:10:58
ARCHIVO_ORIGEN:25100317103241.fac
ID_ORDEN:YP41-251003-171032
ESTADO:DECLINADO

PAGOS_CANT:1
PAGO_1_PROVIDER:PAYWAY
PAGO_1_ESTADO:DECLINADO
PAGO_1_IMPORTE:71500.00
PAGO_1_MONEDA:ARS
PAGO_1_TARJETA:VISA
PAGO_1_CUOTAS:3
PAGO_1_PLAN:NACIONAL
PAGO_1_PAYMENT_ID:PW-9F3A1C8E2
PAGO_1_ERROR_CODE:05
PAGO_1_ERROR_MSG:Operación no autorizada

FACTURA_TIPO:-
PTO_VTA:-
NRO:-
CAE:-
VTO_CAE:-

OBS:El medio de pago fue rechazado por la emisora. Ofrecer otro medio/tarjeta.
```

> Para **split**, repetir bloques `PAGO_n_*`. En **ALL‑OR‑NOTHING**, si un parcial falla, revertimos todos los aprobados y el `ESTADO` final será `REVERTIDO` o `ERROR_FACTURACION` (según el motivo).

---

## 4) UI de Administración (sin `.env`)

**Ruta:** Administración → Medios de pago → **Payway**

### 4.1. Pestañas
1. **Credenciales**
   - CUIT/CUIL del comercio
   - API base (sandbox/prod)
   - API Key (oculto)
   - Sub‑adquirente / Merchant
2. **Terminales**
   - Alta/edición: `terminal_id`, `serial`, alias, sucursal
   - Habilitada / Deshabilitada
3. **Preferencias**
   - Moneda: ARS
   - `print_method`: `MOBITEF_NON_FISCAL`
   - Poll interval (ms), Poll max (s)
   - Hora cierre de lote (HH:MM)
   - Política split: ALL_OR_NOTHING / PARCIAL_PERMITIDO
   - Refund no referenciado: on/off
4. **Pruebas**
   - Probar conexión
   - Pago $1 (sandbox)
   - Cierre de lote ahora
5. **Auditoría & Roles**
   - Historial de cambios
   - Roles: AdminPagos / Caja / Lectura

### 4.2. Almacenamiento seguro
- Secrets en DB **cifrados** (AES‑256‑GCM).  
- **Master key**:
  - Preferido: **OS Keychain** (`keytar`).  
  - Alternativa: **frase maestra** (derivada con Argon2id/scrypt) ingresada por el admin al iniciar.  
- **Rotación** de claves con versionado y migración.

---

## 5) Esquema de datos (Prisma)

```prisma
enum PayStatus     { REQUESTED PROCESSING APPROVED DECLINED CANCELED UNDONE REFUNDED ERROR }
enum SessionStatus { OPEN PARTIAL COMPLETED INVOICING INVOICED REVERSED ERROR }
enum SplitPolicy   { ALL_OR_NOTHING PARCIAL_PERMITIDO }

model PaymentSession {
  id             String @id @default(cuid())
  externalRef    String @unique
  totalCents     Int
  remainingCents Int
  policy         SplitPolicy @default(ALL_OR_NOTHING)
  status         SessionStatus @default(OPEN)
  payments       PaywayPayment[]
  branchId       String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model PaywayPayment {
  id                 String   @id @default(cuid())
  sessionId          String?
  session            PaymentSession? @relation(fields: [sessionId], references: [id])
  externalRef        String
  amountCents        Int
  currency           String   @default("ARS")
  brand              String?
  installments       Int?
  plan               String?
  merchantId         String?
  terminalId         String?
  terminalSerial     String?
  providerPaymentId  String?
  status             PayStatus @default(REQUESTED)
  authCode           String?
  ticketNumber       String?
  last4              String?
  errorCode          String?
  errorMessage       String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}

model PaymentTerminal {
  id         String @id @default(cuid())
  alias      String
  merchantId String
  terminalId String
  serial     String
  branchId   String
  enabled    Boolean @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model PaymentProviderConfig {
  id               String @id @default(cuid())
  branchId         String
  cuitCuil         String
  baseUrl          String
  printMethod      String  @default("MOBITEF_NON_FISCAL")
  defaultCurrency  String  @default("ARS")
  pollIntervalMs   Int     @default(1500)
  pollMaxSeconds   Int     @default(120)
  settlementTime   String?
  allowUnrefRefund Boolean @default(false)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

model AppSecret {
  id         String  @id @default(cuid())
  provider   String  // 'PAYWAY'
  scope      String  // 'GLOBAL' | branchId
  version    Int     @default(1)
  ciphertext Bytes
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

---

## 6) Interfaces y stubs (TypeScript)

```ts
// Enums básicos
export type SplitPolicy = 'ALL_OR_NOTHING' | 'PARCIAL_PERMITIDO';
export type PayStatus   = 'REQUESTED' | 'PROCESSING' | 'APPROVED' | 'DECLINED' | 'CANCELED' | 'UNDONE' | 'REFUNDED' | 'ERROR';

// Payloads clave
export interface PayRequest {
  merchant_id: string; terminal_id: string; serial: string;
  amount: number; currency: 'ARS';
  installments?: number; brand?: string; plan?: string;
  external_reference: string; print_method: 'MOBITEF_NON_FISCAL';
}

export interface PayResult {
  id: string; status: PayStatus;
  auth_code?: string; ticket_number?: string; last4?: string;
  error_code?: string; error_message?: string;
}

// Cliente HTTP (firmas)
export interface PaywayClient {
  requestPayment(p: PayRequest): Promise<PayResult>;
  getPaymentById(id: string): Promise<PayResult>;
  cancelPayment(id: string, reason?: string): Promise<void>;
  requestReversal(paymentId: string, reason: string): Promise<{ id: string }>;
  getReversal(id: string): Promise<any>;
  requestRefundUnreferenced(params: { amount: number; currency: 'ARS'; brand: string; reason: string; external_reference: string }): Promise<{ id: string }>;
  requestSettlement(terminal_id: string, serial: string): Promise<{ id: string }>;
  getSettlement(id: string): Promise<any>;
}
```

**Axios base (ejemplo)**
```ts
import axios from 'axios';

export function makePaystoreClient(baseUrl: string, apikey: string, cuitCuil: string) {
  const http = axios.create({
    baseURL: baseUrl,
    headers: { apikey, 'Content-Type': 'application/json' },
    timeout: 15000
  });
  const params = { cuit_cuil: cuitCuil };

  return {
    async requestPayment(p: PayRequest) {
      const { data } = await http.post('/payments', p, { params });
      return data as PayResult;
    },
    async getPaymentById(id: string) {
      const { data } = await http.get(`/payments/${id}`, { params });
      return data as PayResult;
    },
    async cancelPayment(id: string, reason?: string) {
      await http.post(`/payments/${id}/cancellations`, { reason }, { params });
    },
    async requestReversal(paymentId: string, reason: string) {
      const { data } = await http.post('/reversals', { payment_id: paymentId, reason }, { params });
      return data as { id: string };
    },
    async getReversal(id: string) {
      const { data } = await http.get(`/reversals/${id}`, { params });
      return data;
    },
    async requestRefundUnreferenced(arg: { amount: number; currency: 'ARS'; brand: string; reason: string; external_reference: string }) {
      const { data } = await http.post('/refunds', arg, { params });
      return data as { id: string };
    },
    async requestSettlement(terminal_id: string, serial: string) {
      const { data } = await http.post('/settlements', { terminal_id, serial }, { params });
      return data as { id: string };
    },
    async getSettlement(id: string) {
      const { data } = await http.get(`/settlements/${id}`, { params });
      return data;
    },
  } as PaywayClient;
}
```

---

## 7) Reglas de negocio y manejo de errores

- **Sin `confirm`** en AR.  
- **Polling**: 1.5 s, máx. 120 s → si no hay resultado, cancelar/timeout.  
- **Idempotencia** por `external_reference = ID_ORDEN`.  
- **AFIP falla**: reintentos con backoff (p. ej., 5s/15s/60s). Si no hay CAE → **reversa**.  
- **Split**:
  - `ALL_OR_NOTHING` (default): ante fallo parcial o fallo AFIP, **revertir todo**.  
  - `PARCIAL_PERMITIDO`: permitir completar con otro medio; no facturar hasta TOTAL.  
- **Errores típicos**:  
  - Auth inválida → revisar `apikey`.  
  - Terminal/merchant/serial incorrectos → corregir configuración en UI.  
  - Búsquedas/listados → enviar `payment_date`/`status_date` en searches.  

---

## 8) Ciberseguridad (hardening)

**Scope PCI**: fuera de alcance pleno (datos de tarjeta no pasan por la app). Aun así:

- **Secrets**: nada en `.env`. DB cifrada (AES‑256‑GCM). Master key en **OS Keychain** o **frase maestra** (Argon2id/scrypt). Rotación y versionado.  
- **Electron**: `contextIsolation:true`, `sandbox:true`, `nodeIntegration:false`, CSP estricto, IPC whitelisting y validaciones (zod/valibot).  
- **Logs**: JSON; **nunca** PAN; solo `last4`, `auth_code`, `ticket_number`.  
- **Red**: TLS estricto; allowlist saliente hacia dominios de PayStore; backoff + circuit‑breaker en axios.  
- **Auditoría**: cambios de config (quién/cuándo); roles AdminPagos/Caja/Lectura.  
- **Backups**: cifrados; retención acorde a normativa contable.

---

## 9) Pruebas

**MVP**  
- Pago **aprobado** (VISA 1 cuota) → factura OK → `.res OK`.  
- Pago **declinado** → `.res DECLINADO`.  
- Pago **aprobado** + **AFIP falla** → reversa OK → `.res ERROR_FACTURACION`.  
- **Settlement** manual exitoso.

**Luego**  
- Cuotas (3/6/12).  
- **Split**: dos tarjetas → completar total y facturar.  
- Timeout de POS y cancelación.  
- Búsquedas por fecha/estado (conciliación).  
- Cierre de lote programado (cron).  
- Refund no referenciado (si está habilitado por cuenta).

---

## 10) Roadmap

1. **UI Admin + Secrets cifrados** (sin `.env`) + prueba de terminal.  
2. **Cliente Payments** + watcher `.fac` para **1 tarjeta** + `.res`.  
3. **Regla AFIP + reversal** automática en fallo.  
4. **Settlements**: manual + cron diario.  
5. **Split** multi‑tarjeta (sesiones, política).  
6. **Reportes** de conciliación (searches por fecha/estado).  
7. **Observabilidad** (métricas, ratio aprobación, tiempo medio).  
8. **Hardening** adicional (roles finos, rotación de claves, ZAP básico).

---

## 11) Criterios de aceptación (MVP)

- Configurable **sin `.env`** desde UI (secretos cifrados).  
- Cobro con **1 tarjeta** desde `.fac` → `.res` consistente.  
- **Reversa automática** si falla la factura; no quedan cobros sin comprobante.  
- **No** se degrada facturación/recibos/FTP/e‑mail.  
- Logs y auditoría disponibles; **sin PAN** en registros.

---

## 12) Glosario rápido

- **ECR**: Caja registradora electrónica (nuestra app).  
- **POS**: Terminal física de pagos.  
- **PayStore**: Backend de Prisma para orquestar pagos de terminales.  
- **Settlement (cierre de lote)**: consolidación y envío de las operaciones al adquirente.  
- **Reversal**: anulación/devolución referenciada, sobre un pago existente.  
- **Refund no referenciado**: devolución sin pago previo (requiere habilitación).

---

## 13) Decisiones fijadas

- Estrategia base: **Cobro primero → Factura después → Reversa si falla**.  
- Política split default: **ALL‑OR‑NOTHING**.  
- `print_method = MOBITEF_NON_FISCAL`.  
- Idempotencia por `ID_ORDEN` (external_reference).  
- Sin `.env`; UI Admin + cifrado.

---

### Anexo A — Endpoints (sandbox, a parametrizar en UI)

```
BASE: https://api-sandbox.prismamediosdepago.com/v1/paystore_terminals

Payments
  POST   /payments
  GET    /payments/{paymentId}
  POST   /payments/searches
  POST   /payments/{paymentId}/cancellations

Reversals
  POST   /reversals
  GET    /reversals/{reversalId}
  POST   /reversals/{reversalId}/cancellations

Refunds (no referenciado, si habilitado)
  POST   /refunds
  GET    /refunds/{refundId}

Settlements
  POST   /settlements
  GET    /settlements/{settlementId}
```
