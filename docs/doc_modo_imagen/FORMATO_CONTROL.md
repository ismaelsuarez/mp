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
- `VENTANA=comun12`
  - Variante “común” con ajuste extra (por ejemplo, un layout específico o fin/transición). Reservado para integraciones que lo requieran.

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

## Consideraciones
- La app consume (borra) el .txt tras procesarlo.
- Si la `URI` no existe, se registra el evento y el .txt se elimina igualmente.
- El contenido mostrado queda persistente hasta que llegue otro archivo de control.

---
Última actualización: 2025-08-19
