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
        video.autoplay = true;
        video.loop = true;
        video.muted = true; // Autoplay suele requerir muted en Chromium/Electron
        (video as any).playsInline = true;
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

function showContent(filePath: string, isNumeradorMode: boolean = false, numeradorValue: string = '') {
    const viewer = document.getElementById('contentViewer');
    if (!viewer) return;
    
    // Detener cualquier reproducción previa (evitar solapamientos)
    try {
        const prevVideo = (viewer as HTMLElement).querySelector('video') as HTMLVideoElement | null;
        if (prevVideo) {
            try { prevVideo.pause(); } catch {}
            try { prevVideo.src = ''; } catch {}
        }
        const prevAudio = (viewer as HTMLElement).querySelector('audio') as HTMLAudioElement | null;
        if (prevAudio) {
            try { prevAudio.pause(); } catch {}
            try { prevAudio.src = ''; } catch {}
        }
    } catch {}

    const filename = filePath.split('\\').pop() || filePath.split('/').pop() || '';
    let contentType = 'Archivo';
    
    if (isImageFile(filename)) contentType = 'Imagen';
    else if (isVideoFile(filename)) contentType = 'Video';
    else if (isAudioFile(filename)) contentType = 'Audio';
    else if (isPdfFile(filename)) contentType = 'PDF';
    
    const contentElement = createContentElement(filePath, contentType);
    (viewer as HTMLElement).innerHTML = '';
    
    // Si es modo numerador, crear contenedor con imagen de fondo y texto superpuesto
    if (isNumeradorMode && numeradorValue) {
        // Variable configurable para el tamaño del numerador (fácil de ajustar)
        const NUMERADOR_SIZE_MULTIPLIER = 0.35; // Aumentar este valor para números más grandes
        
        const numeradorContainer = document.createElement('div');
        numeradorContainer.style.position = 'relative';
        numeradorContainer.style.width = '100%';
        numeradorContainer.style.height = '100%';
        numeradorContainer.style.backgroundColor = '#000000'; // Fondo negro
        numeradorContainer.style.color = '#ffffff'; // Texto blanco por defecto
        
        // Agregar la imagen como fondo
        contentElement.style.width = '100%';
        contentElement.style.height = '100%';
        contentElement.style.objectFit = 'contain';
        numeradorContainer.appendChild(contentElement);
        
        // Parsear el numerador: " 15 0" → Turno: " 15", Box: " 0"
        const numeradorParts = numeradorValue.trim().split(/\s+/);
        const turnoNumber = numeradorParts[0] || ''; // " 15"
        const boxNumber = numeradorParts[1] || '';  // " 0"
        
        // Crear contenedor para el turno (número principal)
        if (turnoNumber) {
            const turnoText = document.createElement('div');
            turnoText.textContent = turnoNumber;
            turnoText.style.position = 'absolute';
            turnoText.style.top = '35%'; // Posicionado arriba del centro
            turnoText.style.left = '50%';
            turnoText.style.transform = 'translate(-50%, -50%)';
            turnoText.style.backgroundColor = 'transparent';
            turnoText.style.color = '#00FF88'; // Verde brillante
            turnoText.style.fontWeight = '900';
            turnoText.style.fontFamily = 'Impact, Arial Black, sans-serif';
            turnoText.style.zIndex = '1000';
            turnoText.style.textAlign = 'center';
            turnoText.style.whiteSpace = 'nowrap';
            
            // Tamaño más grande para el turno (número principal)
            const turnoSize = Math.min(window.innerWidth, window.innerHeight) * 0.25;
            turnoText.style.fontSize = `${Math.max(turnoSize, 100)}px`;
            
            // Sombra para el turno
            turnoText.style.textShadow = `
                4px 4px 8px rgba(0, 0, 0, 0.9),
                -4px -4px 8px rgba(0, 0, 0, 0.9),
                0 0 20px rgba(0, 255, 136, 0.4)
            `;
            
            numeradorContainer.appendChild(turnoText);
        }
        
        // Crear contenedor para el box (número secundario)
        if (boxNumber) {
            const boxText = document.createElement('div');
            boxText.textContent = boxNumber;
            boxText.style.position = 'absolute';
            boxText.style.top = '65%'; // Posicionado abajo del centro
            boxText.style.left = '50%';
            boxText.style.transform = 'translate(-50%, -50%)';
            boxText.style.backgroundColor = 'transparent';
            boxText.style.color = '#FF6B6B'; // Rojo para diferenciar del turno
            boxText.style.fontWeight = '900';
            boxText.style.fontFamily = 'Impact, Arial Black, sans-serif';
            boxText.style.zIndex = '1000';
            boxText.style.textAlign = 'center';
            boxText.style.whiteSpace = 'nowrap';
            
            // Tamaño más pequeño para el box (número secundario)
            const boxSize = Math.min(window.innerWidth, window.innerHeight) * 0.15;
            boxText.style.fontSize = `${Math.max(boxSize, 60)}px`;
            
            // Sombra para el box
            boxText.style.textShadow = `
                3px 3px 6px rgba(0, 0, 0, 0.9),
                -3px -3px 6px rgba(0, 0, 0, 0.9),
                0 0 15px rgba(255, 107, 107, 0.4)
            `;
            
            numeradorContainer.appendChild(boxText);
        }
        
        (viewer as HTMLElement).appendChild(numeradorContainer);
        
        // Asegurar que el contenedor principal tenga fondo negro
        (viewer as HTMLElement).style.backgroundColor = '#000000';
        document.body.style.backgroundColor = '#000000';
    } else {
        // Modo normal: solo el contenido
        (viewer as HTMLElement).appendChild(contentElement);
    }
    
    // Si es video, asegurar inicio inmediato (algunas plataformas requieren play() explícito)
    try {
        if (contentElement instanceof HTMLVideoElement) {
            const v = contentElement as HTMLVideoElement;
            const tryPlay = async () => {
                try { await v.play(); } catch {}
            };
            // Intento inmediato y después de 'canplay'
            tryPlay();
            v.addEventListener('canplay', () => { tryPlay(); }, { once: true });
            // Activar also fullscreen + maximized video UI si se recibió bandera 'publicidad'
            try {
                const anyWindow: any = window as any;
                const lastPayload = (anyWindow.__lastImagePayload || {}) as any;
                if (lastPayload && lastPayload.publicidad === true) {
                    // Asegurar fullscreen del elemento de video
                    const el: any = v as any;
                    const reqFs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
                    if (typeof reqFs === 'function') { try { reqFs.call(el); } catch {} }
                    // Forzar capa superior del contenedor
                    const container = document.getElementById('contentViewer') as HTMLElement | null;
                    if (container) { container.style.zIndex = '2147483647'; container.style.background = 'white'; }
                    // Intentar mantener la ventana al frente desde renderer (mejora visual en algunos entornos)
                    try { (window as any).api?.onNewImageContent && document.dispatchEvent(new Event('keep-front')); } catch {}
                }
            } catch {}
        }
    } catch {}

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
			const wasFallback = !!payload.fallback;
			appendLogImagen(`Nuevo contenido detectado: ${payload.filePath}${wasFallback ? ' (fallback)' : ''}${payload.isNumeradorMode ? ` [Numerador: ${payload.numeradorValue}]` : ''}`);
			// Aplicar estilo de "espejo" si windowMode === 'nueva12'
			try {
				const mode = String(payload.windowMode || '').toLowerCase();
				const titleEl = document.getElementById('customTitleText');
				const barEl = document.getElementById('customTitlebar');
				if (mode === 'nueva12') {
					// franja azul en body para diferenciación
					document.body.classList.add('mirror-mode');
					// si existiera barra de título personalizada, cambiar color y sufijo
					if (barEl) (barEl as HTMLElement).style.background = '#0ea5e9';
					if (titleEl && typeof (titleEl as any).textContent === 'string') {
						const t = String((titleEl as any).textContent || '').replace(/\s*\(ESPEJO\)\s*$/i,'').trim();
						(titleEl as any).textContent = t ? `${t} (ESPEJO)` : 'ESPEJO';
					}
				} else {
					document.body.classList.remove('mirror-mode');
					if (barEl) (barEl as HTMLElement).style.background = '#10b981';
				}
			} catch {}

			// Guardar último payload (para detectar bandera 'publicidad' en showContent)
			try { (window as any).__lastImagePayload = payload; } catch {}
			// Activar clase de publicidad para quitar marcos/bordes en HTML/CSS
			try {
				if (payload.publicidad === true) document.body.classList.add('publicidad');
				else document.body.classList.remove('publicidad');
			} catch {}
			showContent(payload.filePath, payload.isNumeradorMode, payload.numeradorValue);
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
