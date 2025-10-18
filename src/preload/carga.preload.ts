/**
 * Preload script para la ventana de Carga
 * Expone API segura para comunicación IPC
 */

import { contextBridge, ipcRenderer } from 'electron';

console.log('[carga.preload] iniciado');

contextBridge.exposeInMainWorld('CargaAPI', {
  requestInit() {
    ipcRenderer.send('carga:request-init');
  },
  onInit(cb: (d: any) => void) {
    ipcRenderer.on('carga:init', (_e, d) => cb(d));
  },
  cancel() {
    ipcRenderer.send('carga:cancel');
  },
  process(payload: { files: { realPath: string; targetName: string }[]; mode: 'overwrite' | 'skip' }) {
    ipcRenderer.send('carga:process', payload);
  },
  onDone(cb: (p: { ok: boolean; ms: number }) => void) {
    ipcRenderer.on('carga:done', (_e, d) => cb(d));
  },
  onError(cb: (p: { message: string }) => void) {
    ipcRenderer.on('carga:error', (_e, d) => cb(d));
  },
  // Nuevos helpers
  listMatching(uris: string[], base: string, ext: string) {
    return ipcRenderer.invoke('carga:list-matching', { uris, base, ext });
  },
  getNextIndex(uris: string[], base: string, ext: string) {
    return ipcRenderer.invoke('carga:get-next-index', { uris, base, ext });
  },
  openFolder(dir: string) {
    return ipcRenderer.invoke('carga:open-folder', dir);
  },
  // Para futuras acciones (abrir archivo con app del sistema)
  openFile(filePath: string) {
    return ipcRenderer.invoke('carga:open-file', filePath);
  }
});

