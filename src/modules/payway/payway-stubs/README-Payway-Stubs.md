# Payway Stubs (Starter Kit)

Incluye:
- Prisma: `prisma/schema.payway.prisma` (mergeá con tu `schema.prisma` y migrá)
- Types: `src/payments/payway/PaywayTypes.ts`
- HTTP Client: `src/payments/payway/PaywayClient.ts`
- Service (orquestación + polling): `src/payments/payway/PaywayService.ts`
- Watcher `.fac` → `.res`: `src/watchers/fac-payway.ts`
- Parser `.fac`: `src/payments/payway/facParser.ts`
- Writer `.res`: `src/payments/payway/resWriter.ts`
- Admin UI skeleton (React): `src/ui/admin/payway/PaywayAdmin.tsx`
- Secrets util: `src/lib/crypto/secretStore.ts`
- Settlement job: `src/jobs/settlementJob.ts`
- Test ejemplo: `test/payments/payway/facParser.spec.ts`

Paso a paso:
1) Mergeá `schema.payway.prisma` → `prisma/schema.prisma` y corré `npx prisma migrate dev`.
2) Conectá la UI Admin para guardar/leer config real (OS Keychain o passphrase).
3) Instanciá PaywayService con config de Admin y usalo en `processFacWithPayway()`.
4) Probá sandbox: aprobado, declinado, reversa por AFIP.
