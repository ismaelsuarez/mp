## Automatización (config.html)

Esta guía describe el funcionamiento de la automatización configurable desde la sección "Automatización" de `public/config.html`.

## Campos configurables

- **Intervalo (segundos)**: `AUTO_INTERVAL_SECONDS`
  - Valor > 0: habilita la automatización y permite reanudación automática al iniciar la app.
  - 0 o vacío: deshabilita la automatización.
- **Días habilitados**: `AUTO_DAYS_MONDAY` … `AUTO_DAYS_SUNDAY`
  - Si un día está desmarcado, ese día no se ejecuta el ciclo automático.
- **Rangos horarios por día (opcional)**: `AUTO_FROM_*` / `AUTO_TO_*` (HH:mm)
- **Carpeta Remota**: `AUTO_REMOTE_DIR`
  - Carpeta que se revisa en cada ciclo para el modo remoto. Por defecto: `C:\\tmp`.
  - Si encuentra archivos `mp*.txt`, ejecuta el mismo flujo que "Descargar MP" y luego elimina cada archivo procesado.
- **Habilitar remoto**: `AUTO_REMOTE_ENABLED`
  - Controla si el modo remoto está activo. Si está deshabilitado, no se revisa la carpeta aunque exista intervalo.
  - Ambos vacíos: todo el día.
  - Ambos definidos y fin ≥ inicio: activo entre inicio y fin (inclusive).
  - Ambos definidos y fin < inicio: rango nocturno (p. ej., 22:00→02:00), activo si hora actual ≥ inicio o ≤ fin.
  - Solo FROM: activo desde esa hora en adelante.
  - Solo TO: activo hasta esa hora.

## Botones (UI)

- **Activar**: guarda la configuración actual y arranca el temporizador automático.
- **Desactivar**: detiene el temporizador actual (no borra la configuración guardada).
- Estado visible como “Automatización: ON/OFF”.

## Flujo de cada ejecución automática

1. Genera el reporte con la configuración de Mercado Pago vigente (equivalente a "Generar").
2. Exporta archivos (CSV/XLSX/DBF/JSON) en la carpeta de salida de la app.
3. Intenta enviar por FTP el archivo `mp.dbf` del día:
   - Si no hay cambios respecto del último envío, se omite (mensaje “sin cambios”).
   - Para forzar reenvío: “Limpiar Hash FTP”.
4. Notifica a la UI un resumen (cantidad de pagos y filas de muestra). Los errores se muestran de forma clara (p. ej., Access Token inválido) y se registran.
5. Si hay archivos remotos `mp*.txt` en `AUTO_REMOTE_DIR`, procesa uno o varios, ejecuta el flujo y muestra: `Se procesó archivo remoto: <nombreArchivo>`.
   - Este proceso es autónomo y no se pausa con los controles de pausa/reanudar del modo automático estándar.

## Persistencia y reanudación

- Si `AUTO_INTERVAL_SECONDS > 0`, al iniciar la app se intenta reanudar automáticamente.
- Internamente existe pausa/reanudación con conservación del tiempo restante; en la UI actual solo están expuestos Activar/Desactivar.
- Para deshabilitar completamente entre reinicios: establecer el intervalo en 0 (o vacío) y guardar la configuración. Si está corriendo, pulsar también Desactivar.

## Recomendaciones

- Ajustar días y rangos para limitar la ejecución a horarios deseados.
- Antes de activar con FTP, validar credenciales con “Probar FTP”. Luego usar “Limpiar Hash FTP” si necesitas forzar un próximo envío del DBF.
- Ante errores de `MP_ACCESS_TOKEN`, revisar Configuración → Mercado Pago y corregir el Access Token.

## Referencias de claves

- Intervalo: `AUTO_INTERVAL_SECONDS`
- Días: `AUTO_DAYS_MONDAY`, `AUTO_DAYS_TUESDAY`, `AUTO_DAYS_WEDNESDAY`, `AUTO_DAYS_THURSDAY`, `AUTO_DAYS_FRIDAY`, `AUTO_DAYS_SATURDAY`, `AUTO_DAYS_SUNDAY`
- Rangos: `AUTO_FROM_*` / `AUTO_TO_*` por día

Implementación técnica principal en:
- `src/main.ts`: programación, ejecución del ciclo, envíos FTP y notificaciones a la UI.
- `src/renderer.ts`: lectura/guardado del formulario y disparadores de Activar/Desactivar.
