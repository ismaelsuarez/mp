# Samples y Scripts – Payway Watcher

## Contenido
- `samples/fac/approved_single.fac` – caso aprobado (fake).
- `samples/fac/declined_single.fac` – caso declinado (fake).
- `samples/fac/split_two_cards.fac` – split de dos tarjetas (fake).
- `scripts/simulate-payway-watcher.ts` – usa un **FakePaywayService** (no llama APIs).
- `scripts/run-payway-watcher.ts` – usa el **PaywayService** real con config JSON.
- `payway.config.sample.json` – plantilla de configuración para sandbox.

> Ambos scripts asumen que tenés los stubs en `mp/src/modules/payway/payway-stubs/src/...`.

## Simulación sin API (recomendado para probar flujo `.fac`→`.res`)
```bash
npx ts-node mp/src/modules/payway/payway-stubs/scripts/simulate-payway-watcher.ts --in mp/src/modules/payway/payway-stubs/samples/fac
```
- Genera un `.res` junto a cada `.fac` procesado.
- Reglas del fake:
  - Si `ID_ORDEN` contiene `DECLINADO` → devuelve `DECLINED`.
  - Caso contrario → `APPROVED` con auth/ticket simulados.

## Ejecución real contra sandbox/prod
1) Copiá y completá `payway.config.sample.json` → `payway.config.json` (apikey/cuit/terminal/serial/merchant).
2) Dejá `.fac` en una carpeta (ej.: `./fac-in`).
3) Ejecutá:
```bash
npx ts-node mp/src/modules/payway/payway-stubs/scripts/run-payway-watcher.ts --config ./payway.config.json --in ./fac-in
```
- Genera `.res` junto a cada `.fac`.
- Para **AFIP falla**, el watcher del proyecto debe tener conectado el módulo AFIP real que lance excepción al no emitir CAE; el flujo hará reversal.

## Notas
- Estos scripts **no** instalan dependencias ni compilan; necesitan `ts-node` si corrés TS directo:
```bash
npm i -D ts-node typescript
```
