# Tc‑Mp – Guía rápida para generar el instalador (.exe) en Windows

## Requisitos
- Windows 10/11 x64
- Node.js 18 o superior (recomendado LTS)
- Git (para clonar)

## 1) Clonar e instalar dependencias
```bat
git clone https://github.com/tu-org/tu-repo.git
cd tu-repo
npm install --no-fund --no-audit
```

## 2) Compilar TypeScript
```bat
npm run build:ts
```

## 3) Generar el instalador para Windows
- Opción A (usa el script del proyecto; solo Windows):
```bat
npm run build
```
- Opción B (comando directo con salida en dist2):
```bat
npx --yes electron-builder -w --config.directories.output=dist2 --publish never
```

Salidas esperadas:
- dist/Tc-Mp ver.X.Y.Z.exe (opción A)
- dist2/Tc-Mp ver.X.Y.Z.exe (opción B)

## Notas importantes
- PowerShell puede bloquear npm.ps1. Preferí CMD. Si usás PowerShell, antes ejecutá:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```
- El instalador requiere admin y se instala en C:\2_mp, creando:
  - C:\2_mp\logs (logs diarios: mp-app-YYYY-MM-DD.log)
  - C:\2_mp\reportes (CSV/XLSX/DBF/JSON)
- La app empaquetada NO usa .env. La configuración se guarda en:
  - %APPDATA%\Tc-Mp\settings.json

## Actualizar versión e identidad (opcional)
- Editar package.json:
  - version: versión de la app.
  - build.productName, build.artifactName, build.appId: metadatos del instalador.
- Ícono: colocar build/icon.ico (ideal multires, incluye 256×256).

## Problemas comunes
- PowerShell bloquea npm: usar CMD o la política temporal (ver arriba).
- Falla por icono en Linux: en Windows, compilar SOLO Windows (-w).
- "Application entry file … does not exist": falta compilar TS. Ejecutar npm run build:ts y reintentar.
- "Break signaled" durante NSIS: algún proceso interrumpió el empaquetado (Ctrl+C, antivirus, etc.).
  - Solución:
    ```bat
    rmdir /s /q dist dist2
    npm run build:ts
    npx --yes electron-builder -w --config.directories.output=dist2 --publish never
    ```
  - Si persiste, desactivar temporalmente el antivirus o ejecutar CMD como administrador.

## Post‑instalación
- Ejecutar el .exe y configurar en la pestaña Configuración.
- Botón “Abrir log de hoy” abre el log del día en C:\2_mp\logs.
- Los reportes (por defecto) usan un rango rodante de N días hacia atrás (configurable), incluyendo el día actual.
