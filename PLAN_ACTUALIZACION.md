### Plan de Actualización – MP Reports

#### Objetivo
- Consolidar un plan seguro para actualizar dependencias clave (Electron, builder, store, cron, SDK MP) y asegurar compatibilidad funcional en GUI y CLI.

#### Alcance
- App de escritorio (Electron) en `src/*` y CLI en `mp-sdk/*`.
- No incluye nuevas funcionalidades; solo mantenimiento, compatibilidad y calidad.

#### Estado actual (base)
- Runtime: Node 20.19.3, npm 10.8.2.
- Electron: 30.x; electron-builder: 24.x; electron-store: 8.x; node-cron: 3.x.
- SDK Mercado Pago: 2.8.x; TypeScript 5.9.x; @types/node 24.x.
- Auditoría: 0 vulnerabilidades a la fecha.

#### Matriz de dependencias (target sugerido)
| Paquete | Actual | Target | Tipo | Impacto esperado |
|---|---:|---:|---|---|
| electron | 30.x | 37.x | dev | Cambios menores en runtime Chromium/Node; UI y preload OK con contextIsolation.
| electron-builder | 24.x | 26.x | dev | Mejoras de estabilidad; revisar configuración `build.files`.
| electron-store | 8.x | 10.x | prod | Mantiene `encryptionKey`; verificar persistencia de `config.key`.
| node-cron | 3.x | 4.x | dev | API `schedule` estable; validar expresiones y TZ del host.
| mercadopago | 2.8.x | 2.x latest | prod | Verificar `Payment.search({ options })` sin cambios.
| @types/node | 24.x | 20.x | dev | Alinear tipos con runtime de Electron.

#### Cambios propuestos
- Actualizar versiones según matriz y mantener SDK MP en 2.x estable.
- Alinear tipos de Node a 20.x para evitar desajustes en Electron.
- Revisar `build.files` de `electron-builder` para reducir superficie del binario (ver sección de empaquetado).

#### Procedimiento (paso a paso)
1) Crear rama de trabajo y actualizar dependencias
```bash
git checkout -b chore/upgrade-deps
npm i -D electron@^37 electron-builder@^26 electron-store@^10 node-cron@^4 @types/node@^20
npm i mercadopago@^2
```

2) Chequeos iniciales
```bash
npm run typecheck
npm outdated || true
npm audit || true
```

3) Pruebas rápidas GUI
```bash
npm start
# En la app: cargar config, generar reporte, exportar CSV/XLSX/DBF, enviar email (si SMTP configurado).
```

4) Pruebas rápidas CLI
```bash
npm run build:ts
MP_NO_DATE_FILTER=true MP_ACCESS_TOKEN=APP_USR_xxx npm run mp:payments:report:dist
# Verificar generación en out/: balance-YYYY-MM-DD.json, transactions-*.csv/xlsx/dbf
```

5) Build de instalador (Windows)
```powershell
npx electron-builder -w
# Salida esperada: dist/MP Reports Setup x.y.z.exe
```

6) Validación cron (automático)
- Configurar `AUTO_ENABLED=true` y `AUTO_TIMES` (por ej. `12:00,14:00`).
- Observar notificaciones en UI y archivos generados en Documentos/MP-Reportes.

7) Documentar cambios y abrir PR
```bash
git add -A
git commit -m "chore: upgrade electron/electron-builder/electron-store/node-cron + deps"
git push -u origin chore/upgrade-deps
```

#### Notas de compatibilidad
- Electron: ya se utiliza `contextIsolation: true` y `nodeIntegration: false` con `preload`, patrón recomendado para versiones recientes.
- electron-store v10: conservar `encryptionKey` derivada de `app.getPath('userData')/config.key`. Validar lectura/escritura tras el upgrade.
- node-cron v4: expresiones crontab sin cambios; confirmar TZ del sistema (WSL/host) si los horarios no coinciden.
- Mercado Pago SDK 2.x: validar `Payment.search({ options })` (paginación y filtros `range/begin_date/end_date/status`).

#### Empaquetado (revisión sugerida)
- Hoy se incluyen `src/**/*` y `dist/**/*`. Para reducir tamaño del instalador:
  - Preferir incluir sólo `dist/**/*` y `public/**/*` (mantener `mp-sdk` si la CLI se distribuye junto a la app).
  - Validar si la CLI se usará fuera del binario; de no ser necesaria, excluir `mp-sdk/**/*` del paquete.

#### Plan de pruebas
- GUI
  - Cargar/guardar configuración; cifrado persiste entre sesiones.
  - Generar reporte; ver tabla, filtros, paginación, tema.
  - Exportación CSV/XLSX/DBF; apertura de carpeta de salida.
  - Envío de email (SMTP de prueba) con adjuntos del día.
  - Auto-reporte por horario (si habilitado) y notificación en UI.
- CLI
  - Ejecución sin fechas (`MP_NO_DATE_FILTER=true`) y con ventana/rango manual.
  - Archivos generados correctos en `out/`.
  - Normalizador de “Dinero en cuenta” con salidas JSON/CSV/XLSX y email opcional.

#### Riesgos y mitigaciones
- Cambios sutiles en Chromium/Node (Electron 37):
  - Mitigar con smoke tests y verificación de UI/preload/IPC.
- Cambios de serialización en `electron-store`:
  - Validar lectura de config previa; si hay problemas, exportar/importar manualmente.
- Diferencias de TZ en cron/fechas:
  - Forzar TZ consistente (`America/Argentina/Buenos_Aires`) en config, y revisar WSLg/host.

#### Rollback
```bash
git reset --hard <commit_base>
npm ci
# Si ya se publicó binario, retirar release y volver a versión previa.
```

#### Checklist de finalización
- [ ] Dependencias actualizadas y `npm run typecheck` en verde.
- [ ] Smoke tests GUI/CLI OK.
- [ ] Email de prueba enviado con adjuntos correctos.
- [ ] Auto-reporte verificado (si aplica).
- [ ] Binario generado y probado en Windows.
- [ ] Documentación de cambios y PR aprobado.

#### Anexos – Comandos útiles
```bash
# Listar desactualizados
npm outdated

# Auditoría
npm audit

# Limpiar y reinstalar
rm -rf node_modules package-lock.json && npm ci
```


