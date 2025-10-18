/**
 * Renderer script para la ventana de Carga
 * NO USAR export {} ni declare global para evitar errores con executeJavaScript
 */

type Meta = { nombre: string; extensions: string[]; uris: string[] };
type AddedFile = { realPath?: string; realName: string; targetName: string; valid: boolean; error?: string };

(function () {
  const API = (window as any).CargaAPI;

  let meta: Meta = { nombre: '', extensions: [], uris: [] };
  let files: AddedFile[] = [];
  let conflictPolicy: 'skip' | 'overwrite' | 'next' = 'skip';

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
      // Elegir extensión por archivo según su realName si coincide con permitidas; si no, usar primera
      const ext = (f.realName.split('.').pop() || '').toLowerCase();
      const allowed = meta.extensions.map(e => e.toLowerCase());
      const useExt = allowed.includes(ext) ? ext : (allowed[0] || '');
      f.targetName = `${meta.nombre}${suffix}.${useExt}`;
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
    const allowed = meta.extensions.map(e => e.toLowerCase());
    const valid = allowed.includes(ext);
    const error = valid ? undefined : `Extensión .${ext} no permitida (${allowed.join(', ')})`;
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

  const policySel = document.getElementById('conflictPolicy') as HTMLSelectElement | null;
  const btnView = document.getElementById('btnView') as HTMLButtonElement | null;
  const viewModal = document.getElementById('viewModal') as HTMLDivElement | null;
  const viewBody = document.getElementById('viewBody') as HTMLDivElement | null;
  const viewClose = document.getElementById('viewClose') as HTMLButtonElement | null;
  const previewArea = document.getElementById('previewArea') as HTMLDivElement | null;
  const previewTitle = document.getElementById('previewTitle') as HTMLDivElement | null;
  const prevBtn = document.getElementById('prevBtn') as HTMLButtonElement | null;
  const nextBtn = document.getElementById('nextBtn') as HTMLButtonElement | null;

  let previewList: { name: string; path: string }[] = [];
  let previewIndex = 0;

  function renderPreview(idx: number) {
    if (!previewArea) return;
    previewArea.innerHTML = '';
    if (previewList.length === 0) {
      previewArea.innerHTML = '<div class="text-slate-400">Sin archivos para previsualizar</div>';
      return;
    }
    if (idx < 0 || idx >= previewList.length) idx = 0;
    previewIndex = idx;
    const item = previewList[idx];
    if (previewTitle) previewTitle.textContent = `${item.name} (${idx+1}/${previewList.length})`;
    const lower = item.name.toLowerCase();
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.webp')) {
      const img = document.createElement('img');
      img.src = 'file:///' + item.path.replace(/\\/g, '/');
      img.style.maxWidth = '100%';
      img.style.height = '100%';
      img.style.width = 'auto';
      img.style.objectFit = 'contain';
      previewArea.appendChild(img);
    } else if (lower.endsWith('.pdf')) {
      const embed = document.createElement('embed');
      embed.type = 'application/pdf';
      embed.src = 'file:///' + item.path.replace(/\\/g, '/');
      embed.style.width = '100%';
      embed.style.height = '100%';
      previewArea.appendChild(embed);
    } else if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.ogv') || lower.endsWith('.mov')) {
      const video = document.createElement('video');
      video.controls = true;
      video.src = 'file:///' + item.path.replace(/\\/g, '/');
      video.style.width = 'auto';
      video.style.height = '100%';
      video.style.maxWidth = '100%';
      video.style.background = '#000';
      video.style.objectFit = 'contain';
      previewArea.appendChild(video);
    } else if (lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.ogg') || lower.endsWith('.m4a') || lower.endsWith('.aac')) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = 'file:///' + item.path.replace(/\\/g, '/');
      audio.style.width = '100%';
      previewArea.appendChild(audio);
    } else {
      const box = document.createElement('div');
      box.className = 'text-slate-600 text-sm';
      box.innerHTML = `No hay vista previa para este tipo. <button class="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 openExtern">Abrir</button>`;
      previewArea.appendChild(box);
      const btn = box.querySelector('button.openExtern') as HTMLButtonElement;
      btn.onclick = async () => { try { await API.openFile(item.path); } catch {} };
    }
  }

  prevBtn?.addEventListener('click', () => {
    if (previewList.length === 0) return;
    const idx = (previewIndex - 1 + previewList.length) % previewList.length;
    renderPreview(idx);
  });
  nextBtn?.addEventListener('click', () => {
    if (previewList.length === 0) return;
    const idx = (previewIndex + 1) % previewList.length;
    renderPreview(idx);
  });

  policySel?.addEventListener('change', () => {
    conflictPolicy = (policySel.value as any) || 'skip';
  });

  btnCancel.addEventListener('click', () => API?.cancel());
  btnProcess.addEventListener('click', async () => {
    let mode: 'overwrite' | 'skip' = 'overwrite';
    let payloadFiles = files
      .filter(f => f.valid && f.realPath)
      .map(f => ({ realPath: f.realPath!, targetName: f.targetName }));

    if (conflictPolicy === 'skip') {
      mode = 'skip';
    } else if (conflictPolicy === 'overwrite') {
      mode = 'overwrite';
    } else if (conflictPolicy === 'next') {
      try {
        const baseExt = (meta.extensions[0] || '').toLowerCase();
        const { nextIndex } = await API.getNextIndex(meta.uris, meta.nombre, baseExt);
        const renamed = files
          .filter(f => f.valid && f.realPath)
          .map((f, i) => {
            let name: string;
            const originalExt = (f.realName.split('.').pop() || '').toLowerCase();
            const allowed = meta.extensions.map(e => e.toLowerCase());
            const useExt = allowed.includes(originalExt) ? originalExt : baseExt;
            if (nextIndex === 0) {
              name = `${meta.nombre}${i === 0 ? '' : `-${i}`}.${useExt}`;
            } else {
              name = `${meta.nombre}-${nextIndex + i}.${useExt}`;
            }
            return { realPath: f.realPath!, targetName: name };
          });
        payloadFiles = renamed;
        mode = 'overwrite'; // ya no colisionan
      } catch (e) {
        alert('No se pudo calcular el siguiente número: ' + (e as any)?.message || String(e));
        return;
      }
    }

    API?.process({ files: payloadFiles, mode });
  });

  btnView?.addEventListener('click', async () => {
    try {
      if (!viewModal || !viewBody) return;
      viewBody.innerHTML = `<div class="text-slate-500">Analizando destinos…</div>`;
      viewModal.classList.remove('hidden');
      viewModal.classList.add('flex');

      const res = await API.listMatching(meta.uris, meta.nombre, meta.extensions);
      // Construir lista plana de archivos para preview (orden por URI y nombre)
      previewList = ([] as { name: string; path: string }[]).concat(
        ...res.map((r: any) => (r.files || []).map((f: any) => ({ name: f.name || f, path: f.path || '' })))
      ).filter(it => it.path);
      const indexByPath = new Map<string, number>();
      previewList.forEach((it, idx) => indexByPath.set(it.path, idx));
      renderPreview(0);

      viewBody.innerHTML = res
        .map((r: any) => {
          const exists = r.exists;
          const header = `<div class="font-medium">${r.dir}</div>`;
          if (!exists) {
            return `<div class="p-3 rounded bg-amber-50 border border-amber-200">
                      ${header}
                      <div class="text-amber-700 text-sm mt-1">No existe. Se creará al procesar.</div>
                      <div class="mt-2"><button data-open="${r.dir}" class="openDir px-3 py-1 rounded bg-slate-200 hover:bg-slate-300">Abrir carpeta</button></div>
                    </div>`;
          }
          const list = r.files.length
            ? `<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-1 mt-2 mono">${r.files.map((f: any) => {
                  const n = (f.name || f);
                  const p = (f.path || '');
                  const gidx = indexByPath.get(p);
                  return `<button data-idx="${gidx ?? -1}" class="linkPreview text-blue-700 hover:underline text-left truncate">${n}</button>`;
                }).join('')}</div>`
            : `<div class="text-slate-500 mt-1">No hay archivos que comiencen con <span class="mono">${meta.nombre}*.{${meta.extensions.join(',')}}</span></div>`;
          return `<div class="p-3 rounded bg-slate-50 border border-slate-200">
                    ${header}
                    ${list}
                    <div class="mt-2"><button data-open="${r.dir}" class="openDir px-3 py-1 rounded bg-slate-200 hover:bg-slate-300">Abrir carpeta</button></div>
                  </div>`;
        })
        .join('');

      viewBody.querySelectorAll<HTMLButtonElement>('button.openDir').forEach((btn) => {
        btn.onclick = async () => {
          await API.openFolder(btn.dataset.open!);
        };
      });
      // Click en un archivo de la lista -> enfocar preview correspondiente
      viewBody.querySelectorAll<HTMLButtonElement>('button.linkPreview').forEach((btn) => {
        btn.onclick = () => {
          const idx = Number(btn.dataset.idx || '-1');
          if (idx >= 0 && idx < previewList.length) renderPreview(idx);
        };
      });
    } catch (e: any) {
      if (viewBody) viewBody.innerHTML = `<div class="text-red-600">Error: ${e?.message || e}</div>`;
    }
  });

  viewClose?.addEventListener('click', () => {
    if (!viewModal) return;
    viewModal.classList.add('hidden');
    viewModal.classList.remove('flex');
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
    extEl.textContent = (meta.extensions && meta.extensions.length ? meta.extensions.join(',') : '').toUpperCase().trim();
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
