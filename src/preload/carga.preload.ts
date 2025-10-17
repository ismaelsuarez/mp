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
  process(files: { realPath: string; targetName: string }[]) {
    ipcRenderer.send('carga:process', files);
  },
  onDone(cb: (p: { ok: boolean; ms: number }) => void) {
    ipcRenderer.on('carga:done', (_e, d) => cb(d));
  },
  onError(cb: (p: { message: string }) => void) {
    ipcRenderer.on('carga:error', (_e, d) => cb(d));
  },
});

