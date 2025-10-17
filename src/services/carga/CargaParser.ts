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
  nombre: string;        // NOMBRE:
  extension: string;     // EXTENSION: (sin punto, ej "pdf")
  uris: string[];        // 1..N
};

/**
 * Parsea un archivo carga*.txt y valida su contenido
 */
export async function parseCargaTxt(txtPath: string): Promise<CargaData> {
  const raw = await fs.readFile(txtPath, 'utf8');
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  let nombre = '';
  let extension = '';
  const uris: string[] = [];

  for (const line of lines) {
    if (/^NOMBRE\s*:/i.test(line)) {
      nombre = (line.split(':')[1] ?? '').trim();
    } else if (/^EXTENSION\s*:/i.test(line)) {
      extension = (line.split(':')[1] ?? '').trim().replace(/^\./, '').toLowerCase();
    } else if (/^URI\s*=/i.test(line)) {
      const v = (line.split('=')[1] ?? '').trim();
      if (v) uris.push(v); // <-- ignorar URIs vacías
    }
  }

  // Validaciones obligatorias
  if (!nombre) throw new Error('Falta NOMBRE:');
  if (!extension) throw new Error('Falta EXTENSION:');
  if (uris.length === 0) throw new Error('Debe venir al menos un URI=');

  // Sanitizaciones básicas
  nombre = nombre.replace(/[\\/:*?"<>|]/g, '_');
  
  return { nombre, extension, uris };
}

