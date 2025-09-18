# Campos impresos por tipo de documento (ejemplos reales)

Este documento resume los datos que aparecen en los PDFs de ejemplo del sistema anterior y que debemos considerar al mapear `.fac` → emisión/impresión.

Fuentes analizadas (texto extraído en `tmp/pdf-text/*.txt`):
- Factura A: `FA_0016-00009207.pdf`
- Factura B: `FB_0016-00025859.pdf`
- Nota de Crédito A: `NCA_0016-00000185.pdf`
- Nota de Crédito B: `NCB_0016-00000359.pdf`
- Recibo: `REC_0016-00002846.pdf`
- Remito: `REM_0016-00005134.pdf`

---

## Factura A
- Encabezado
  - Letra: A
  - Título: FACTURA
  - Punto de venta y número: 0016-00009207
  - Fecha: 01/09/2025
  - Referencia interna: 25090111361441
- Cliente
  - Código + Razón social: (053101) LEUCADE BUFE S. R. L.
  - Domicilio + Teléfono: “BANDERA DE LOS ANDES 2603(G.CRUZ) Tel:…"
  - CUIT: 30-71872876-9
  - Condición IVA: RESPONSABLE INSCRIPTO
- Comercial
  - Atendió: gonzalo
  - Hora: 11:37:48
  - Pago: “MC DEBIT 1”
  - Mail: (vacío en el ejemplo)
  - Nota de Recepción: 123345
  - Remito: (vacío)
- Ítems
  - Cantidad, Descripción, Alícuota, Total por renglón
  - Admite descuentos/bonificaciones (línea “BONIFICACION 21%” negativa)
- Totales
  - Neto 21%: 123,388.43
  - IVA 21%: 25,911.57
  - Total en letras: “Ciento cuarenta y nueve mil…"
  - TOTAL: 149,300.00
  - CAE: 75355394213832 – Vto: 11/09/2025
- Legales (garantía/defensa consumidor)

## Factura B
- Encabezado
  - Letra: B – FACTURA
  - PV/Número: 0016-00025859 – Fecha: 01/09/2025 – Ref. Interna
- Cliente
  - (147469) CORREA EDGAR – DNI: 12412055 – CONSUMIDOR FINAL
  - Domicilio + Teléfono
- Comercial
  - Atendió, Hora, Pago (VISA 13), Mail
- Ítems
  - Renglón con descripción y total (precios finales)
- Totales
  - TOTAL: 102,050.00
  - IVA CONTENIDO: 9,697.06 (informativo para B)
  - CAE + Vto
- Legales

## Nota de Crédito A (NCA)
- Encabezado: “NOTA DE CREDITO” – Letra A – PV/Número – Fecha – Ref. Interna
- Cliente RI (CUIT, condición)
- Afectación: línea “AFECTA FACT.N: B 0016-00020661 - TOTAL”
- Ítems: detalle/bonificación con alícuota 21%
- Totales: Neto 21%, IVA 21%, TOTAL; Total en letras; CAE + Vto
- Legales

## Nota de Crédito B (NCB)
- Encabezado: “NOTA DE CREDITO” – Letra B – PV/Número – Fecha – Ref. Interna
- Cliente CF (DNI, CONSUMIDOR FINAL)
- Afectación: “AFECTA FACT.N: B 0016-00025782 - TOTAL”
- Ítems: renglón de cargo/diagnóstico
- Totales: TOTAL (precios finales)
  - Muestra “IVA CONTENIDO” (puede ser negativo en NC)
  - CAE + Vto
- Legales

## Recibo
- Encabezado: “RECIBO” – PV/Número – Fecha – Ref. Interna (termina en Q)
- Cliente (RI/CF), CUIT/DNI, Condición IVA
- “Para ser aplicado a: …” (referencia)
- Renglones de pago: medio + referencia + importe (ej.: Depósito MP … 671100.00)
- Total en letras; TOTAL
- Leyenda: “Documento no válido como factura” + legales

## Remito
- Encabezado: “REMITO” – PV/Número – Fecha – Ref. Interna (termina en R)
- Cliente (RI), CUIT y Condición IVA
- Lista de artículos (solo descripción; sin precios ni IVA)
- Leyenda: “Documento no válido como factura” + legales

---

## Conclusiones para mapeo/impresión
- Datos transversales: letra/título, PV y número, fecha, ref. interna, cliente (código, razón social, doc, condición, domicilio), operador (atendió/hora), medios de pago (cuando figuran), observaciones y legales.
- Facturas A/B: 
  - A discrimina IVA (Neto, IVA, TOTAL, CAE y Vto). 
  - B muestra TOTAL final e “IVA CONTENIDO”.
- Notas de crédito: requieren referencia al comprobante afectado (texto “AFECTA FACT.N: …”).
- Recibo: sólo cobros; suma de pagos = TOTAL; no AFIP.
- Remito: sólo ítems; no AFIP ni importes.

Estas observaciones guiarán el parser `.fac` y la confección del PDF para cada tipo.
