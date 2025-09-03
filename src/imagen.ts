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
        const numeradorContainer = document.createElement('div');
        numeradorContainer.style.position = 'relative';
        numeradorContainer.style.width = '100%';
        numeradorContainer.style.height = '100%';
        numeradorContainer.style.backgroundColor = '#000000';
        numeradorContainer.style.overflow = 'hidden'; // Evitar scroll
        
        // Agregar la imagen como fondo
        contentElement.style.width = '100%';
        contentElement.style.height = '100%';
        contentElement.style.objectFit = 'contain';
        numeradorContainer.appendChild(contentElement);
        
        // Crear un solo numerador unificado que muestre todo el contenido
        const numeradorText = document.createElement('div');
        numeradorText.setAttribute('data-type', 'numerador');
        numeradorText.textContent = numeradorValue; // Mostrar todo el valor: " 15 0"
        numeradorText.style.position = 'absolute';
        numeradorText.style.top = '45%'; // Centrado vertical
        numeradorText.style.left = '52%'; // Centrado horizontal
        numeradorText.style.transform = 'translate(-50%, -50%)';
        numeradorText.style.backgroundColor = 'transparent';
        numeradorText.style.color = '#00FF88'; // Color verde unificado
        numeradorText.style.fontWeight = '900';
        numeradorText.style.fontFamily = 'Console, Consolas, "Courier New", monospace';
        numeradorText.style.zIndex = '1000';
        numeradorText.style.textAlign = 'center';
        numeradorText.style.whiteSpace = 'nowrap';
        numeradorText.style.width = '100%'; // Tomar todo el ancho disponible
        
        // Función para calcular tamaño responsive que tome todo el ancho
        const calculateResponsiveSize = (text: string) => {
            const containerWidth = numeradorContainer.clientWidth || window.innerWidth;
            const containerHeight = numeradorContainer.clientHeight || window.innerHeight;
            
            // Tomar 85% del ancho para el numerador unificado
            const targetWidth = containerWidth * 0.80;
            
            // Calcular tamaño de fuente que haga que el texto ocupe exactamente ese ancho
            const tempSpan = document.createElement('span');
            tempSpan.style.fontFamily = 'Console, Consolas, "Courier New", monospace';
            tempSpan.style.fontWeight = '900';
            tempSpan.style.fontSize = '100px'; // Tamaño base para medir
            tempSpan.style.visibility = 'hidden';
            tempSpan.style.position = 'absolute';
            tempSpan.style.whiteSpace = 'nowrap';
            tempSpan.textContent = text;
            
            document.body.appendChild(tempSpan);
            const textWidth = tempSpan.offsetWidth;
            document.body.removeChild(tempSpan);
            
            // Calcular el factor de escala para que el texto ocupe exactamente el ancho objetivo
            const scaleFactor = targetWidth / textWidth;
            const finalFontSize = Math.floor(100 * scaleFactor);
            
            // Aplicar límites para evitar números demasiado grandes o pequeños
            const minSize = 80;
            const maxSize = Math.min(containerHeight * 0.8, containerWidth * 0.8);
            
            return Math.max(minSize, Math.min(finalFontSize, maxSize));
        };
        
        // Función para actualizar tamaño del numerador
        const updateNumeradorSize = () => {
            const fontSize = calculateResponsiveSize(numeradorValue);
            numeradorText.style.fontSize = `${fontSize}px`;
            
            // Sombra proporcional al tamaño de fuente
            const shadowSize = Math.max(2, fontSize * 0.02);
            const glowSize = Math.max(10, fontSize * 0.1);
            numeradorText.style.textShadow = `
                ${shadowSize}px ${shadowSize}px ${shadowSize * 2}px rgba(0, 0, 0, 0.9),
                -${shadowSize}px -${shadowSize}px ${shadowSize * 2}px rgba(0, 0, 0, 0.9),
                0 0 ${glowSize}px rgba(0, 255, 136, 0.4)
            `;
        };
        
        // Aplicar tamaño inicial
        updateNumeradorSize();
        
        // Observar cambios en el contenedor
        const numeradorResizeObserver = new ResizeObserver(() => {
            updateNumeradorSize();
        });
        numeradorResizeObserver.observe(numeradorContainer);
        
        // Escuchar cambios de tamaño de ventana
        const handleWindowResize = () => {
            setTimeout(() => {
                updateNumeradorSize();
            }, 100);
        };
        
        window.addEventListener('resize', handleWindowResize);
        window.addEventListener('orientationchange', handleWindowResize);
        
        numeradorContainer.appendChild(numeradorText);
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
