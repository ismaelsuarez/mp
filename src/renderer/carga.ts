/**
 * Renderer script para la ventana de Carga
 * NO USAR export {} ni declare global para evitar errores con executeJavaScript
 */

type Meta = { nombre: string; extension: string; uris: string[] };
type AddedFile = { realPath?: string; realName: string; targetName: string; valid: boolean; error?: string };

(function () {
  const API = (window as any).CargaAPI;

  let meta: Meta = { nombre: '', extension: '', uris: [] };
  let files: AddedFile[] = [];

  // ***** Desbloquear drag & drop a nivel documento *****
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => {
    document.addEventListener(ev, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  const nombreEl = document.getElementById('nombre')!;
  const extEl = document.getElementById('ext')!;
  const urisEl = document.getElementById('uris')!;
  const dropzone = document.getElementById('dropzone')!;
  const fileInput = document.getElementById('fileInput') as HTMLInputElement;
  const filesBody = document.getElementById('filesBody')!;
  const tableEmpty = document.getElementById('tableEmpty')!;
  const btnCancel = document.getElementById('btnCancel')!;
  const btnProcess = document.getElementById('btnProcess')!;
  const okOverlay = document.getElementById('okOverlay')! as HTMLDivElement;

  function recomputeTargets() {
    files.forEach((f, i) => {
      const suffix = i === 0 ? '' : `-${i}`;
      f.targetName = `${meta.nombre}${suffix}.${meta.extension}`;
    });
  }

  function refreshTable() {
    filesBody.innerHTML = '';
    if (files.length === 0) {
      tableEmpty.style.display = 'block';
      btnProcess.setAttribute('disabled', 'true');
      return;
    }
    tableEmpty.style.display = 'none';
    btnProcess.toggleAttribute('disabled', !files.every(f => f.valid));

    files.forEach((f, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'border-b';
      const tdReal = document.createElement('td');
      tdReal.className = 'py-2 mono';
      tdReal.textContent = f.realName + (f.error ? `  [${f.error}]` : '');
      if (f.error) tdReal.classList.add('text-red-600');

      const tdTarget = document.createElement('td');
      tdTarget.className = 'py-2 mono';
      tdTarget.textContent = f.targetName;

      const tdDel = document.createElement('td');
      tdDel.className = 'py-2';
      const btn = document.createElement('button');
      btn.className = 'px-2 py-1 rounded bg-slate-200 hover:bg-slate-300';
      btn.textContent = 'borrar';
      btn.onclick = () => {
        files.splice(idx, 1);
        recomputeTargets();
        refreshTable();
      };
      tdDel.appendChild(btn);

      tr.appendChild(tdReal);
      tr.appendChild(tdTarget);
      tr.appendChild(tdDel);
      filesBody.appendChild(tr);
    });
  }

  function addDropped(file: File & { path?: string }) {
    const realPath = (file as any).path; // Electron agrega .path
    const realName = file.name;
    const ext = realName.split('.').pop()?.toLowerCase() || '';
    const valid = !!meta.extension && ext === meta.extension.toLowerCase();
    const error = valid ? undefined : `Extensión .${ext} ≠ .${meta.extension}`;
    files.push({ realPath, realName, targetName: '', valid, error });
    recomputeTargets();
  }

  function handleFilesList(list: FileList) {
    for (let i = 0; i < list.length; i++) addDropped(list[i] as any);
    refreshTable();
  }

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files) handleFilesList(fileInput.files);
  });

  dropzone.addEventListener('dragenter', () => dropzone.classList.add('dragover'));
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('dragover', () => dropzone.classList.add('dragover'));
  dropzone.addEventListener('drop', (e) => {
    dropzone.classList.remove('dragover');
    const dt = e.dataTransfer;
    if (!dt) return;
    if (dt.files) handleFilesList(dt.files);
  });

  btnCancel.addEventListener('click', () => API?.cancel());
  btnProcess.addEventListener('click', () => {
    const payload = files
      .filter(f => f.valid && f.realPath)
      .map(f => ({
        realPath: f.realPath!,
        targetName: f.targetName
      }));
    API?.process(payload);
  });

  API?.onDone(({ ok, ms }: { ok: boolean; ms: number }) => {
    if (!ok) return;
    okOverlay.style.display = 'flex';
    setTimeout(() => window.close(), ms);
  });
  
  API?.onError(({ message }: { message: string }) => alert('Error al procesar: ' + message));

  API?.onInit((data: Meta) => {
    meta = data;
    // Pintar meta
    nombreEl.textContent = meta.nombre;
    extEl.textContent = meta.extension;
    urisEl.innerHTML = '';
    meta.uris.forEach((u, i) => {
      const li = document.createElement('li');
      li.className = i === 0 ? 'font-semibold text-emerald-900' : 'text-emerald-800';
      li.textContent = (i === 0 ? '[OBLIGATORIA] ' : '') + u;
      urisEl.appendChild(li);
    });
  });

  window.addEventListener('DOMContentLoaded', () => {
    console.log('[carga.renderer] DOM listo; solicitando init…');
    API?.requestInit(); // Si no llega, el main hará pushInit()
  });
})();
