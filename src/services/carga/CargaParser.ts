/**
 * Parser de archivos carga*.txt
 * 
 * Formato esperado:
 * NOMBRE: <nombre_base>
 * EXTENSION: <ext>
 * URI= <ruta1>
 * URI= <ruta2>
 * ...
 */

import fs from 'fs/promises';

export type CargaData = {
  nombre: string;          // NOMBRE:
  extensions: string[];    // EXTENSION: una o varias separadas por coma (sin punto)
  uris: string[];          // 1..N
};

/**
 * Parsea un archivo carga*.txt y valida su contenido
 */
export async function parseCargaTxt(txtPath: string): Promise<CargaData> {
  const raw = await fs.readFile(txtPath, 'utf8');
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  let nombre = '';
  let extensions: string[] = [];
  const uris: string[] = [];

  for (const line of lines) {
    if (/^NOMBRE\s*:/i.test(line)) {
      nombre = (line.split(':')[1] ?? '').trim();
    } else if (/^EXTENSION\s*:/i.test(line)) {
      const rawExt = (line.split(':')[1] ?? '').trim();
      const parts = rawExt.split(',').map(s => s.trim()).filter(Boolean);
      extensions = Array.from(new Set(parts.map(p => p.replace(/^\./, '').toLowerCase())));
    } else if (/^URI\s*=/i.test(line)) {
      const v = (line.split('=')[1] ?? '').trim();
      if (v) uris.push(v); // <-- ignorar URIs vacías
    }
  }

  // Validaciones obligatorias
  if (!nombre) throw new Error('Falta NOMBRE:');
  if (!extensions || extensions.length === 0) throw new Error('Falta EXTENSION:');
  if (uris.length === 0) throw new Error('Debe venir al menos un URI=');

  // Sanitizaciones básicas
  nombre = nombre.replace(/[\\/:*?"<>|]/g, '_');
  
  return { nombre, extensions, uris };
}

