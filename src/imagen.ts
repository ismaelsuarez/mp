function selectPaneImagen(name: 'viewer' | 'logs') {
    const viewer = document.getElementById('pane-viewer') as HTMLElement | null;
    const logs = document.getElementById('pane-logs') as HTMLElement | null;
    if (!viewer || !logs) return;
    viewer.style.display = name === 'viewer' ? 'block' : 'none';
    logs.style.display = name === 'logs' ? 'block' : 'none';
}

function setAutoIndicatorImagen(_active: boolean, _paused: boolean = false, _dayDisabled: boolean = false) {}

function updateTimerImagen(_remaining: number, _configured: number) {}

async function refreshAutoIndicatorImagen() {
    // auto-indicator removed from UI; keep no-op to avoid errors
}

async function refreshTimerImagen() {
    // timer removed from UI; keep no-op to avoid errors
}

async function handleAutoButtonClickImagen() {
    // auto toggle removed from UI in modo imagen
}

function appendLogImagen(message: string) {
    const logsEl = document.getElementById('imagenLogs');
    if (!logsEl) return;
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.textContent = `[${timeStr}] ${message}`;
    logsEl.appendChild(logEntry);
    logsEl.scrollTop = logsEl.scrollHeight;
}

function renderTodayBadgeImagen() {
    const el = document.getElementById('todayBadgeImagen');
    if (!el) return;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth()+1).padStart(2,'0');
    const dd = String(now.getDate()).padStart(2,'0');
    el.textContent = `Hoy: ${yyyy}-${mm}-${dd}`;
}

function getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
}

function isImageFile(filename: string): boolean {
    const ext = getFileExtension(filename);
    return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp'].includes(ext);
}

function isVideoFile(filename: string): boolean {
    const ext = getFileExtension(filename);
    return ['mp4', 'avi', 'mov', 'wmv', 'mkv', 'webm'].includes(ext);
}

function isAudioFile(filename: string): boolean {
    const ext = getFileExtension(filename);
    return ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext);
}

function isPdfFile(filename: string): boolean {
    return getFileExtension(filename) === 'pdf';
}

function createContentElement(filePath: string, _contentType: string): HTMLElement {
    // Crear solo el elemento de contenido, para que el contenedor #contentViewer (400x400) lo administre
    if (isImageFile(filePath)) {
        const img = document.createElement('img');
        img.src = `file://${filePath}`;
        img.alt = 'Imagen';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        return img;
    }
    if (isVideoFile(filePath)) {
        const video = document.createElement('video');
        video.src = `file://${filePath}`;
        video.controls = true;
        video.autoplay = false;
        (video.style as any).width = '100%';
        (video.style as any).height = '100%';
        (video.style as any).objectFit = 'contain';
        return video;
    }
    if (isAudioFile(filePath)) {
        const audio = document.createElement('audio');
        audio.src = `file://${filePath}`;
        audio.controls = true;
        (audio.style as any).width = '100%';
        return audio;
    }
    if (isPdfFile(filePath)) {
        const iframe = document.createElement('iframe');
        iframe.src = `file://${filePath}`;
        (iframe.style as any).width = '100%';
        (iframe.style as any).height = '100%';
        return iframe;
    }
    const div = document.createElement('div');
    div.className = 'no-content';
    div.innerHTML = '<div>📄</div><div>Tipo de archivo no soportado</div>';
    return div;
}

function showContent(filePath: string) {
    const viewer = document.getElementById('contentViewer');
    if (!viewer) return;
    
    const filename = filePath.split('\\').pop() || filePath.split('/').pop() || '';
    let contentType = 'Archivo';
    
    if (isImageFile(filename)) contentType = 'Imagen';
    else if (isVideoFile(filename)) contentType = 'Video';
    else if (isAudioFile(filename)) contentType = 'Audio';
    else if (isPdfFile(filename)) contentType = 'PDF';
    
    const contentElement = createContentElement(filePath, contentType);
    (viewer as HTMLElement).innerHTML = '';
    (viewer as HTMLElement).appendChild(contentElement);
    
    appendLogImagen(`Mostrando ${contentType}: ${filename}`);
    // Controles: abrir externo y zoom básicos si están disponibles en contexto
    // Barra de botones deshabilitada en esta fase
    try {} catch {}
}

function showNoContent() {
    const viewer = document.getElementById('contentViewer');
    if (!viewer) return;
    
    viewer.innerHTML = `
        <div class="no-content">
            <div>📷</div>
            <div>Esperando contenido...</div>
            <div class="text-sm mt-2">El contenido aparecerá automáticamente</div>
        </div>
    `;
}

window.addEventListener('DOMContentLoaded', () => {
	// Notificaciones de nuevo contenido
	window.api.onNewImageContent?.((payload: any) => {
		if (payload && payload.filePath) {
			appendLogImagen(`Nuevo contenido detectado: ${payload.filePath}`);
			showContent(payload.filePath);
			// Mostrar info (si existiera en el futuro una barra superior)
			try {
				// En vez de superponer sobre la imagen, poner el texto como título de la ventana (ya lo hace main).
				// Por compatibilidad, aseguramos que no exista barra superpuesta:
				const old = document.getElementById('contentInfoBar');
				if (old) old.remove();
			} catch {}
		}
	});

	showNoContent();
});
