# 🚀 Guía de Lazy Loading

**Fecha**: 14 de Octubre, 2025  
**Fase**: 8 - Optimización  
**Objetivo**: Reducir startup time mediante carga diferida de módulos

---

## 🎯 Concepto

**Lazy Loading** = Cargar módulos **solo cuando se necesitan**, no al inicio de la aplicación.

**Beneficios**:
- ✅ Startup time más rápido
- ✅ Menor uso de memoria inicial
- ✅ Mejor experiencia de usuario

---

## 📊 Módulos Candidatos

### Módulos Pesados (No Críticos)

| Módulo | Tamaño | Uso | Crítico | Lazy Load |
|--------|--------|-----|---------|-----------|
| `puppeteer` | ~200 MB | Scraping BNA | ❌ | ✅ |
| `exceljs` | ~5 MB | Reportes Excel | ❌ | ✅ |
| `pdf-parse` | ~2 MB | Parsing PDFs | ❌ | ✅ |
| `jimp` | ~10 MB | Procesamiento imágenes | ❌ | ✅ |
| `better-sqlite3` | ~5 MB | Database | ✅ | ❌ |
| `soap` | ~3 MB | AFIP SOAP | ✅ | ❌ |

**Total lazy loadable**: ~220 MB

---

## 🔧 Patrón de Implementación

### Antes (Eager Loading)

```typescript
// src/services/BnaService.ts
import puppeteer from 'puppeteer';

export async function getBnaQuotes() {
  const browser = await puppeteer.launch();
  // ...
}
```

**Problema**: `puppeteer` (~200MB) se carga al inicio, aunque no se use inmediatamente.

---

### Después (Lazy Loading)

```typescript
// src/services/BnaService.ts
export async function getBnaQuotes() {
  // Lazy load puppeteer solo cuando se necesita
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch();
  // ...
}
```

**Beneficio**: `puppeteer` se carga solo cuando se llama a `getBnaQuotes()`.

---

## 📝 Ejemplos Prácticos

### Ejemplo 1: Puppeteer (Scraping)

```typescript
// apps/electron/src/services/BnaService.ts

export async function getBnaQuotes() {
  try {
    // Lazy load puppeteer
    const puppeteer = await import('puppeteer');
    
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox']
    });
    
    const page = await browser.newPage();
    await page.goto('https://www.bna.com.ar/Personas');
    
    // ... scraping logic
    
    await browser.close();
    return quotes;
  } catch (error) {
    console.error('Error scraping BNA:', error);
    throw error;
  }
}
```

---

### Ejemplo 2: ExcelJS (Reportes)

```typescript
// apps/electron/src/services/ReportService.ts

export async function generateExcelReport(data: any[]) {
  try {
    // Lazy load exceljs
    const ExcelJS = await import('exceljs');
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Report');
    
    // ... Excel generation logic
    
    await workbook.xlsx.writeFile('report.xlsx');
  } catch (error) {
    console.error('Error generating Excel:', error);
    throw error;
  }
}
```

---

### Ejemplo 3: PDF Parse (Parsing)

```typescript
// apps/electron/src/services/PdfService.ts

export async function parsePdf(pdfPath: string) {
  try {
    // Lazy load pdf-parse
    const pdfParse = await import('pdf-parse');
    const fs = await import('fs');
    
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse.default(dataBuffer);
    
    return data.text;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw error;
  }
}
```

---

### Ejemplo 4: Jimp (Imágenes)

```typescript
// apps/electron/src/services/ImageService.ts

export async function processImage(imagePath: string) {
  try {
    // Lazy load jimp
    const Jimp = await import('jimp');
    
    const image = await Jimp.default.read(imagePath);
    image.resize(256, 256);
    await image.writeAsync('output.jpg');
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
}
```

---

## ⚠️ Cuándo NO Usar Lazy Loading

### Módulos Críticos

**NO lazy load**:
- ✅ `better-sqlite3` (database crítica)
- ✅ `soap` (AFIP crítico)
- ✅ `electron-store` (config crítica)
- ✅ `winston` (logging crítico)

**Razón**: Estos módulos se necesitan **inmediatamente** al inicio.

---

### Módulos Pequeños

**NO lazy load**:
- ✅ `dayjs` (~2KB)
- ✅ `qrcode` (~50KB)
- ✅ `papaparse` (~100KB)

**Razón**: El overhead de lazy loading supera el beneficio.

---

## 📊 Impacto Estimado

### Startup Time

**Antes** (eager loading):
```
Electron ready: 1s
Load puppeteer: +2s
Load exceljs: +0.5s
Load jimp: +0.5s
Total: ~4s
```

**Después** (lazy loading):
```
Electron ready: 1s
(puppeteer, exceljs, jimp no se cargan)
Total: ~1s
```

**Mejora**: -75% startup time

---

### Memory Usage

**Antes** (eager loading):
```
Initial: 180MB (todos los módulos cargados)
```

**Después** (lazy loading):
```
Initial: 80MB (solo módulos críticos)
Peak: 180MB (cuando se usan módulos lazy)
```

**Mejora**: -55% initial memory

---

## 🎯 Checklist de Implementación

### 1. Identificar Módulos Candidatos

- [ ] ✅ Módulo es pesado (>2MB)
- [ ] ✅ Módulo no es crítico al inicio
- [ ] ✅ Módulo se usa esporádicamente

### 2. Aplicar Lazy Loading

```typescript
// Antes
import heavyModule from 'heavy-module';

// Después
const heavyModule = await import('heavy-module');
```

### 3. Manejar Errores

```typescript
try {
  const module = await import('module');
  // use module
} catch (error) {
  console.error('Failed to load module:', error);
  // fallback
}
```

### 4. Validar

- [ ] ✅ Build funcional
- [ ] ✅ Módulo se carga correctamente
- [ ] ✅ Startup time reducido

---

## 🚀 Próximos Pasos

### Fase 8 (Actual)

1. ✅ Documentar patrón de lazy loading
2. ⏭️ Identificar módulos candidatos en el código
3. ⏭️ Aplicar lazy loading a módulos no críticos
4. ⏭️ Medir mejoras en startup time

### Post-Fase 8

1. Aplicar lazy loading a más módulos
2. Automatizar detección de módulos pesados
3. Crear linter rule para prevenir eager loading

---

## 📚 Referencias

- [Dynamic Imports (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import)
- [Electron Performance](https://www.electronjs.org/docs/latest/tutorial/performance)
- [Node.js ES Modules](https://nodejs.org/api/esm.html)

---

**Generado por**: Cursor AI Agent  
**Fecha**: 14 de Octubre, 2025 12:15  
**Estado**: ✅ Guía completa  
**Próximo paso**: Aplicar lazy loading en el código

