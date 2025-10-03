### NC — Registro de diferencias y plan de portado (commit 378e165 → HEAD)

#### Contexto
- Commit estable: `378e165a30bac48827c79342521264e79a002f66` (en esta versión las Notas de Crédito se emiten correctamente: CAE, CAE_Vto, QR, PDF y `.res`).
- En HEAD posterior se observó: “AFIP sin CAE” en NC (sin Observaciones), y el flujo de contingencia enviaba a `error/` o no reintentaba adecuadamente.
- Objetivo: documentar diferencias clave y el plan de portado al HEAD manteniendo el comportamiento del commit estable.

#### Resumen de diferencias funcionales clave
- Emisión por archivo `.fac` (NC incluidas):
  - Commit estable: `facProcessor.emitirAfipWithRetry` delega en `FacturacionService.emitirFacturaYGenerarPdf(params)` (servicio de UI que resuelve mapeos, CAE/QR y número), y luego `facProcessor` genera el PDF definitivo (layout) y `.res` completo, con FTP y limpieza.
  - HEAD (problemático): se llamó directo a `afipService.solicitarCAE` desde `.fac`, endureciendo validaciones y cambiando el mapeo de NC.

- Comprobantes Asociados (NC/ND):
  - Commit estable: para NC se envían sólo campos mínimos `{ Tipo, PtoVta, Nro }` (sin forzar `Cuit` ni `CbteFch`).
  - HEAD: se exigieron/enriquecieron `Cuit/CbteFch` y otras validaciones adicionales → puede derivar en “sin CAE” sin Observación.

- Moneda y política:
  - Commit estable: `MonId='PES'` con `MonCotiz=1` (no se aplica política flexible/externa).
  - HEAD: lógica de cotización y política flexible; para NC por `.fac` no aporta y puede introducir rechazos.

- Condición IVA del receptor y documento:
  - Ambos: CF → `DocTipo=99`, `DocNro=0`. RI → `DocTipo=80` y CUIT válido. Está alineado.
  - Mantener `CondicionIVAReceptorId` (CF=5 si 99/0) en el request AFIP.

- Importes NC:
  - Ambos: montos en positivo (totales e IVA por alícuota). El “signo” lo da el tipo NC + asociación.

#### Logs y trazabilidad recomendada
- Pre-cola/cola (cuando se use contingencia): `[fac.detected]`, `[fac.stable.ok]`, `[fac.stage.ok]`, `[fac.sha.ok]`, `[queue.enqueue.ok]`, `[queue.pop]`, `[fac.lock.ok]`.
- Parseo/validación NC: `[FAC][PIPE] detect:tipo`, `[FAC][PIPE] cbtesAsoc.detect|missing`, `[FAC][PIPE] parsed:totales`, `[FAC][PIPE] afip:params {..., cbtesAsoc: [...]}`.
- Emisión AFIP: `[FAC][AFIP] AFIP_EMIT_ATTEMPT/AFIP_EMIT_RETRY`, `[AFIP_NO_CAE] observaciones` (si aplica), `[afip.cae.ok]`.
- Artefactos: `[pdf.ok]`, `[res.ok]` o `.res`/PDF emitidos por el pipeline de `facProcessor`.

#### Flujo de contingencia (cola) — comportamiento esperado
- El worker usa `facProcessor.processFacturaFacFile`:
  - Genera PDF en `outLocal/outRed*` y `.res` completo junto al `.fac` bloqueado; envía `.res` por FTP y borra `.res` + `.fac` tras éxito.
  - Luego mueve a `done` (si el `.fac` aún existe) y ACK.
- Errores transitorios: red/DNS/timeouts/“AFIP sin CAE”/“Comprobante en proceso” → `nack` con backoff; el job queda en `processing/RETRY` hasta que AFIP responda.
- Errores permanentes: validación/negocio (ej.: NC sin `CbtesAsoc`, documento incompatible, `ITEMS_EMPTY`, `TOTAL_INVALID`) → `.res` de error y mover a `error/`.

#### Plan mínimo de portado al HEAD (manteniendo el comportamiento de 378e165)
1) `src/modules/facturacion/facProcessor.ts`
   - En `emitirAfipWithRetry`, delegar en `FacturacionService.emitirFacturaYGenerarPdf(params)` y retornar `{ cae, caeVto, qrData, numero }`.
   - Mantener generación de PDF final (layout) + `.res` completo (incluye CUIT empresa, PV, número, CAE, Vto, importe total) y envío FTP.
   - NC: parsear `AFECTA FACT.N: <Letra> <PtoVta>-<Nro>` y mapear a `comprobantesAsociados: [{ Tipo, PtoVta, Nro }]`.

2) `src/modules/facturacion/afipService.ts`
   - Para NC/ND, enviar sólo `{ Tipo, PtoVta, Nro }` en `CbtesAsoc` (sin forzar `Cuit/CbteFch`).
   - Mantener `CondicionIVAReceptorId` (CF=5 si 99/0); no endurecer moneda en `.fac` (usar `PES`/`MonCotiz=1`).

3) `src/contingency/ContingencyController.ts` (si se usa cola)
   - Procesar jobs con `facProcessor.processFacturaFacFile`.
   - Clasificar transitorios: `AFIP sin CAE`, `AFIP_NO_CAE`, `AFIP_NO_NUMERO`, timeouts/DNS/`en proceso` ⇒ `nack` con backoff (no mover a `error`).
   - Rehidratación en arranque: mover `PROCESSING >120s` a `RETRY`.

4) Watchers/UI
   - Único entry point por cola (+ fallback inline sólo si el enqueue falla o la cola está pausada). Evitar watchers alternos que invoquen procesadores paralelos.

#### Criterios de aceptación (NC)
- NCB con `AFECTA FACT.N: B <pv>-<nro>` ⇒ CAE y CAE_Vto presentes, QR válido y PDF en `outLocal/outRed*`.
- `.res` completo con CUIT empresa, PV, número, CAE/Vto e importe total; `.fac` borrado tras `RES_OK`.
- Reintentos automáticos ante caída de red/AFIP; sin envíos a `error/` por “sin CAE”.

#### Pruebas rápidas (manual)
1) NC B (CF, DocTipo=99/0) afectando FB existente:
   - `.fac`: TIPO=8, `AFECTA FACT.N: B <pv>-<nro>`, totales positivos.
   - Esperado: `[afip.cae.ok]` y PDF/`.res` correctos.
2) Sin internet: la NC queda en `processing` y se reintenta al volver la conectividad (no se mueve a `error/`).

#### Referencias
- Repo del proyecto (rama factura): `https://github.com/ismaelsuarez/mp/tree/factura`
- Commit estable: `378e165a30bac48827c79342521264e79a002f66`.


