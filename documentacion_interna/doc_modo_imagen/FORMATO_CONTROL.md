# Formato del archivo de control (Modo Imagen)

Este documento detalla cómo se compone la línea del archivo de control que dispara la visualización en Modo Imagen y qué opciones de ventana admite.

## Estructura general

La línea completa tiene tres segmentos separados por `@`:

```
URI=RUTA@VENTANA=OPCION@INFO=DESCRIPCION
```

- `URI`: ruta completa del contenido a mostrar. Puede ser local o UNC.
  - Ejemplo: `URI=\\correo\Linksistema\FOTOSWEB\06\16G515.jpg`
- `VENTANA`: modo de visualización.
- `INFO`: texto libre descriptivo (se usa para logs/diagnóstico; no afecta el render).

## Opciones de VENTANA

- `VENTANA=comun`
  - Usa el visor normal dentro de la ventana actual.
- `VENTANA=nueva`
  - Abre el visor en una ventana separada (modal/independiente).
  - Política "Producto nuevo" (opcional): si está habilitada en Admin y la siguiente solicitud llega dentro del intervalo configurado, se reutiliza la última ventana `nueva` y solo se refresca el contenido (evita abrir múltiples ventanas en ráfaga).
- `VENTANA=comun12`
  - Variante "común" con ajuste extra (por ejemplo, un layout específico o fin/transición). Reservado para integraciones que lo requieran.
  - Con "Publicidad" activo (habilitado + tildado en bandeja), la ventana espejo se muestra en kiosco + pantalla completa + siempre‑al‑frente; el HTML del visor quita marcos/bordes.
  - **Comportamiento**: Envía contenido a ambas ventanas (principal + espejo) simultáneamente.
- `VENTANA=comun2`
  - **NUEVO**: Modo espejo independiente que NO actualiza la ventana principal.
  - **Comportamiento**: Solo actualiza la ventana espejo (secundaria) sin tocar la ventana principal.
  - **Casos de uso**: Controlar la pantalla del cliente sin interferir con la pantalla del operador.
  - **Indicador visual**: Borde naranja para diferenciarlo del espejo dual (comun12).

> Nota: si `VENTANA` no está presente, la app usa el modo por defecto configurado en administración (`IMAGE_WINDOW_SEPARATE` o la vista actual).

## Ejemplos

1) Ventana común
```
URI=\\correo\Linksistema\FOTOSWEB\06\16G515.jpg@VENTANA=comun@INFO=(16G515) NTB.ASUS X515EA I7/16G/SSD1TB/15"
```

2) Ventana nueva
```
URI=\\correo\Linksistema\FOTOSWEB\06\16G515.jpg@VENTANA=nueva@INFO=(16G515) NTB.ASUS X515EA I7/16G/SSD1TB/15"
```

3) Variante común12 (fin)
```
URI=\\correo\Linksistema\FOTOSWEB\06\16G515.jpg@VENTANA=comun12@INFO=(16G515) NTB.ASUS X515EA I7/16G/SSD1TB/15"
```

4) **NUEVO**: Espejo independiente
```
URI=\\correo\Linksistema\FOTOSWEB\06\16G515.jpg@VENTANA=comun2@INFO=(16G515) NTB.ASUS X515EA I7/16G/SSD1TB/15"
```

## Diferencias entre comun12 y comun2

| Característica | VENTANA=comun12 | VENTANA=comun2 |
|----------------|------------------|----------------|
| **Ventana Principal** | ✅ Se actualiza | ❌ NO se actualiza |
| **Ventana Espejo** | ✅ Se actualiza | ✅ Se actualiza |
| **Indicador Visual** | Borde rosado | Borde naranja |
| **Título Espejo** | "(ESPEJO)" | "(INDEPENDIENTE)" |
| **Casos de Uso** | Presentación dual | Control solo del cliente |
| **Sincronización** | Ambas ventanas | Solo espejo |

## Consideraciones
- La app consume (borra) el .txt tras procesarlo.
- Si la `URI` no existe:
  - Si terminaba en `.jpg`, se prueba automáticamente la variante `.mp4` con el mismo nombre. Si existe, se muestra el video.
  - Si tampoco existe, se registra el evento y se muestra el fallback (`public/Noimage.jpg` o `nombre_tc.png`).
- El contenido mostrado queda persistente hasta que llegue otro archivo de control.

---
Última actualización: 2025-08-19
