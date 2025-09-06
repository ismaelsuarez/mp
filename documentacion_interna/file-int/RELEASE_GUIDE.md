### Guía de build y publicación (Windows + GitHub Releases)

Esta guía explica, paso a paso, cómo generar el instalador `.exe`, cómo publicar una release en GitHub (privado) y qué tener en cuenta para que la actualización automática funcione.

---

### Requisitos previos

- Node.js 18+ y npm.
- Proyecto con `electron-builder` y `publish: [{ provider: "github", owner: "<tu_owner>", repo: "<tu_repo>", private: true }]` en `package.json`.
- Token de GitHub con scope `repo` para publicar en Releases privados: `GH_TOKEN`.

Cómo obtener el token:
- GitHub → Settings → Developer settings → Personal access tokens (classic) → Generate new token → Scope `repo` → Expiración corta.

---

### Variables de entorno (PowerShell)

- Usar en la sesión actual (recomendado para publicar):
```powershell
$env:GH_TOKEN="ghp_TU_TOKEN_CON_SCOPE_repo"
```

- Persistente (requiere abrir una nueva terminal luego):
```powershell
setx GH_TOKEN "ghp_TU_TOKEN_CON_SCOPE_repo"
```

- Si prefieres leer desde `.env` en tiempo de ejecución (no recomendado para publicar, pero posible):
```powershell
npx dotenvx run -- npm run release
```

Importante: no commitear `.env` con el token ni pegar el token en capturas/logs. Si se filtra, revoca el token y genera uno nuevo.

---

### Subir versión

El auto-updater usa `app.getVersion()`; por eso, debes incrementar `version` en `package.json` antes de publicar.

- Fijar versión exacta (ejemplo: 1.0.5):
```powershell
npm version 1.0.5 --no-git-tag-version
```

- Incremento semántico automático:
```powershell
# patch/minor/major
npm version patch --no-git-tag-version
```

---

### Generar solo el instalador local (sin publicar)

Produce `dist/Tc-Mp-<version>.exe` en tu máquina, sin subir nada a GitHub.

```powershell
# Opción A (script del proyecto)
npm run build

# Opción B (comando directo)
npx electron-builder -w --publish never
```

Cuándo usarlo:
- Para pruebas internas o para entregar el instalador manualmente sin activar el auto-update.

---

### Publicar release en GitHub (genera instalador y publica)

Hace ambas cosas: construye el `.exe` y publica la release con `latest.yml` (necesario para auto-update).

```powershell
$env:GH_TOKEN="ghp_TU_TOKEN_CON_SCOPE_repo"
npm run release
```

Qué verificar al finalizar:
- En GitHub → Releases del repo hay una nueva `vX.Y.Z` con:
  - `Tc-Mp-X.Y.Z.exe`
  - `Tc-Mp-X.Y.Z.exe.blockmap`
  - `latest.yml`

Notas:
- La guía está preparada para publicar como "Release" (no draft). Si no ves la release, revisa el log y permisos del token.

---

### Flujo de actualización automática en clientes

Condiciones para que el cliente vea el aviso al abrir la app instalada:
- La app está empaquetada/instalada (no `npm start`).
- Existe una release nueva en GitHub con `latest.yml` y `.exe` para Windows.
- El repo es privado y el equipo cliente define `GH_TOKEN` en su entorno (mismo alcance `repo`).
- Conexión a Internet y sin bloqueo a GitHub.

Experiencia:
- Al iniciar: “Se encontró una nueva versión (X.Y.Z). ¿Desea instalarla ahora?” → “Actualizar ahora” / “Más tarde”.
- Tras descarga: “La actualización está lista. ¿Desea reiniciar la aplicación para instalarla?” → “Reiniciar y actualizar” / “Después”.
- Si eligen “Más tarde/Después”, la app sigue normal y volverá a avisar en próximos inicios.

Confirmación:
- En `Configuración → Acerca de` verás “Versión instalada: X.Y.Z”.

---

### Instalador (NSIS) – carpeta de instalación y estructura

- El asistente permite elegir la carpeta de instalación (no se fuerza ruta fija).
- Al instalar se crean dentro de la carpeta elegida:
  - `logs/`
  - `reportes/`
  - Archivos del programa (ejecutable, dependencias, etc.).
- Se conceden permisos de escritura a Usuarios sobre la carpeta de instalación para logs/reportes.

---

### Troubleshooting

- Error: “GitHub Personal Access Token is not set…”
  - Define `GH_TOKEN` en la terminal antes de `npm run release`.
- No veo la release en GitHub
  - Verifica que no quedó en Draft, que el token tiene scope `repo` y que el `owner/repo` en `package.json` sean correctos.
- El cliente no descarga la actualización
  - En repos privados, el cliente también necesita `GH_TOKEN` en su entorno.
- EBUSY o archivos bloqueados en `node_modules`
  - Cierra editores/procesos de Electron, reinicia la terminal, y reintenta. En casos extremos: `rmdir /S /Q node_modules && npm ci`.
- “Skip checkForUpdates because application is not packed”
  - Es normal en desarrollo (`npm start`). Prueba con el instalador.

---

### Resumen de comandos

Solo build local:
```powershell
npm run build
# o
npx electron-builder -w --publish never
```

Publicar release (build + subida a GitHub):
```powershell
$env:GH_TOKEN="ghp_TU_TOKEN_CON_SCOPE_repo"
npm version 1.0.5 --no-git-tag-version   # o npm version patch --no-git-tag-version
npm run release
```


