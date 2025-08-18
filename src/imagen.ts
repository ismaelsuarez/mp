function selectPaneImagen(name: 'viewer' | 'logs') {
    const viewer = document.getElementById('pane-viewer') as HTMLElement | null;
    const logs = document.getElementById('pane-logs') as HTMLElement | null;
    if (!viewer || !logs) return;
    viewer.style.display = name === 'viewer' ? 'block' : 'none';
    logs.style.display = name === 'logs' ? 'block' : 'none';
}

function setAutoIndicatorImagen(active: boolean, paused: boolean = false, dayDisabled: boolean = false) {
	const el = document.getElementById('autoIndicatorImagen') as HTMLButtonElement | null;
	if (!el) return;
	
	let text, className;
	if (dayDisabled) {
		text = 'Desact.(día)';
		className = 'px-3 py-1 rounded text-sm border font-medium hover:opacity-80 transition-opacity bg-slate-700/30 text-slate-300 border-slate-600';
	} else if (paused) {
		text = 'auto:Off';
		className = 'px-3 py-1 rounded text-sm border font-medium hover:opacity-80 transition-opacity bg-rose-700/30 text-rose-300 border-rose-600';
	} else if (active) {
		text = 'auto:On';
		className = 'px-3 py-1 rounded text-sm border font-medium hover:opacity-80 transition-opacity bg-emerald-700/30 text-emerald-300 border-emerald-600';
	} else {
		text = 'auto:Desactivado';
		className = 'px-3 py-1 rounded text-sm border font-medium hover:opacity-80 transition-opacity bg-slate-700/30 text-slate-300 border-slate-600';
	}
	
	el.textContent = text;
	el.className = className;
}

function updateTimerImagen(remaining: number, configured: number) {
	const el = document.getElementById('autoTimerImagen') as HTMLElement | null;
	if (!el) return;
	
	if (remaining <= 0) {
		el.textContent = '⏱ --:--';
		return;
	}
	
	const minutes = Math.floor(remaining / 60);
	const seconds = remaining % 60;
	const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	el.textContent = `⏱ ${timeStr}`;
}

async function refreshAutoIndicatorImagen() {
    try {
        const s = await (window.api as any).autoStatus?.();
        const isActive = !!(s as any)?.active;
        const isPaused = !!(s as any)?.paused;
        
        // Verificar si el día actual está habilitado
        const cfg = await window.api.getConfig();
        const today = new Date().getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
        const dayConfigs = [
            cfg.AUTO_DAYS_SUNDAY,    // 0 = Domingo
            cfg.AUTO_DAYS_MONDAY,    // 1 = Lunes
            cfg.AUTO_DAYS_TUESDAY,   // 2 = Martes
            cfg.AUTO_DAYS_WEDNESDAY, // 3 = Miércoles
            cfg.AUTO_DAYS_THURSDAY,  // 4 = Jueves
            cfg.AUTO_DAYS_FRIDAY,    // 5 = Viernes
            cfg.AUTO_DAYS_SATURDAY   // 6 = Sábado
        ];
        const dayDisabled = dayConfigs[today] === false;
        
        setAutoIndicatorImagen(isActive, isPaused, dayDisabled);
    } catch {
        const cfg = await window.api.getConfig();
        setAutoIndicatorImagen(!!(cfg as any)?.AUTO_ENABLED);
    }
}

async function refreshTimerImagen() {
    try {
        const timer = await (window.api as any).getAutoTimer?.();
        if (timer) {
            updateTimerImagen(timer.remaining || 0, timer.configured || 0);
        }
    } catch (error) {
        console.warn('Error refreshing timer:', error);
    }
}

async function handleAutoButtonClickImagen() {
    try {
        const status = await (window.api as any).autoStatus?.();
        const isActive = !!(status as any)?.active;
        const isPaused = !!(status as any)?.paused;
        
        if (isActive && !isPaused) {
            // Si está activo, pausarlo
            await (window.api as any).pauseAuto?.();
            appendLogImagen('Modo automático pausado');
        } else if (isActive && isPaused) {
            // Si está pausado, reanudarlo
            await (window.api as any).resumeAuto?.();
            appendLogImagen('Modo automático reanudado');
        } else {
            // Si está inactivo, activarlo
            await (window.api as any).startAuto?.();
            appendLogImagen('Modo automático activado');
        }
        
        refreshAutoIndicatorImagen();
    } catch (error) {
        console.error('Error handling auto button:', error);
        appendLogImagen('Error al cambiar modo automático');
    }
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

function createContentElement(filePath: string, contentType: string): HTMLElement {
    const container = document.createElement('div');
    container.className = 'content-viewer';
    container.style.position = 'relative';
    
    // Info del archivo
    const info = document.createElement('div');
    info.className = 'content-info';
    info.textContent = `${contentType} - ${filePath.split('\\').pop() || filePath.split('/').pop() || 'archivo'}`;
    container.appendChild(info);
    
    if (isImageFile(filePath)) {
        const img = document.createElement('img');
        img.src = `file://${filePath}`;
        img.alt = 'Imagen';
        img.onerror = () => {
            container.innerHTML = '<div class="no-content">Error al cargar imagen</div>';
        };
        container.appendChild(img);
    } else if (isVideoFile(filePath)) {
        const video = document.createElement('video');
        video.src = `file://${filePath}`;
        video.controls = true;
        video.autoplay = false;
        video.onerror = () => {
            container.innerHTML = '<div class="no-content">Error al cargar video</div>';
        };
        container.appendChild(video);
    } else if (isAudioFile(filePath)) {
        const audio = document.createElement('audio');
        audio.src = `file://${filePath}`;
        audio.controls = true;
        audio.autoplay = false;
        audio.onerror = () => {
            container.innerHTML = '<div class="no-content">Error al cargar audio</div>';
        };
        container.appendChild(audio);
    } else if (isPdfFile(filePath)) {
        const iframe = document.createElement('iframe');
        iframe.src = `file://${filePath}`;
        iframe.onerror = () => {
            container.innerHTML = '<div class="no-content">Error al cargar PDF</div>';
        };
        container.appendChild(iframe);
    } else {
        // Para otros tipos de archivo, mostrar información
        container.innerHTML = `
            <div class="no-content">
                <div>📄</div>
                <div>Tipo de archivo no soportado</div>
                <div class="text-sm mt-2">${filePath}</div>
            </div>
        `;
    }
    
    return container;
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
    viewer.innerHTML = '';
    viewer.appendChild(contentElement);
    
    appendLogImagen(`Mostrando ${contentType}: ${filename}`);
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
	// Tabs
	const navTabs = Array.from(document.querySelectorAll('nav .tab')) as HTMLElement[];
	for (const t of navTabs) t.addEventListener('click', () => {
		const name = (t.dataset.tab as any) as 'viewer' | 'logs';
		for (const x of navTabs) x.classList.toggle('bg-slate-700', x === t);
		for (const x of navTabs) x.classList.toggle('bg-slate-800', x !== t);
		selectPaneImagen(name);
	});

	// Botón probar lectura
	document.getElementById('btnTestImage')?.addEventListener('click', async () => {
		appendLogImagen('Probando lectura de archivo de control...');
		try {
			const result = await (window.api as any).testImageControl?.();
			if (result && result.success) {
				appendLogImagen(`Archivo encontrado: ${result.filePath}`);
				showContent(result.filePath);
			} else {
				appendLogImagen('No se encontró archivo de control o error en lectura');
			}
		} catch (error) {
			appendLogImagen(`Error al probar lectura: ${error}`);
		}
	});

	// Botón automático
	document.getElementById('autoIndicatorImagen')?.addEventListener('click', handleAutoButtonClickImagen);

	// Ir a Configuración
	document.getElementById('btnGoConfig')?.addEventListener('click', async () => {
		await (window.api as any).openView?.('config');
	});

	// Notificaciones automáticas
	window.api.onAutoNotice?.((payload) => {
		if ((payload as any)?.error) {
			appendLogImagen(`Auto: ${(payload as any).error}`);
		} else if ((payload as any)?.info) {
			appendLogImagen(String((payload as any).info));
		}
		
		// Si es un mensaje de día deshabilitado, actualizar el indicador
		if ((payload as any)?.dayDisabled) {
			refreshAutoIndicatorImagen();
		}
		
		refreshAutoIndicatorImagen();
		refreshTimerImagen();
	});

	// Actualizaciones del timer
	window.api.onAutoTimerUpdate?.((payload) => {
		if (payload) {
			updateTimerImagen(payload.remaining || 0, payload.configured || 0);
		}
	});

	// Notificaciones de nuevo contenido
	window.api.onNewImageContent?.((payload) => {
		if (payload && payload.filePath) {
			appendLogImagen(`Nuevo contenido detectado: ${payload.filePath}`);
			showContent(payload.filePath);
		}
	});

	refreshAutoIndicatorImagen();
	refreshTimerImagen();
    renderTodayBadgeImagen();
    showNoContent();
});
