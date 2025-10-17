function selectPane(name: 'home' | 'table' | 'fact') {
    const home = document.getElementById('pane-home') as HTMLElement | null;
    const table = document.getElementById('pane-table') as HTMLElement | null;
    const fact = document.getElementById('pane-fact') as HTMLElement | null;
    const badge = document.getElementById('todayBadge') as HTMLElement | null;
    const auto = document.getElementById('autoIndicatorCaja') as HTMLElement | null;
    const timer = document.getElementById('autoTimer') as HTMLElement | null;
    if (!home || !table) return;
    home.style.display = name === 'home' ? 'block' : 'none';
    table.style.display = name === 'table' ? 'block' : 'none';
    if (fact) fact.style.display = name === 'fact' ? 'block' : 'none';
    if (badge) badge.style.display = 'none';
    if (auto) auto.style.display = 'none';
    if (timer) timer.style.display = 'none';
    // Mostrar el indicador ARCA y botón Spool sólo en Inicio
    const arca = document.getElementById('arcaIndicator') as HTMLElement | null;
    if (arca) arca.style.display = name === 'home' ? 'block' : 'none';
    
    const spool = document.getElementById('btnSpoolToggle') as HTMLElement | null;
    if (spool) spool.style.display = name === 'home' ? 'block' : 'none';
}

function setAutoIndicator(active: boolean, paused: boolean = false, dayDisabled: boolean = false) {
	const el = document.getElementById('autoIndicatorCaja') as HTMLButtonElement | null;
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

function updateTimer(remaining: number, configured: number) {
	const el = document.getElementById('autoTimer') as HTMLElement | null;
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

async function refreshAutoIndicator() {
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
        
        setAutoIndicator(isActive, isPaused, dayDisabled);
    } catch {
        const cfg = await window.api.getConfig();
        setAutoIndicator(!!(cfg as any)?.AUTO_ENABLED);
    }
}

async function refreshTimer() {
    try {
        const timer = await (window.api as any).getAutoTimer?.();
        if (timer) {
            updateTimer(timer.remaining || 0, timer.configured || 0);
        }
    } catch (error) {
        console.warn('Error refreshing timer:', error);
    }
}

function setArcaIndicator(status: 'up'|'degraded'|'down') {
    const img = document.getElementById('arcaIndicator') as HTMLImageElement | null;
    if (!img) return;
    const map: any = { up: 'arca_verde.png', degraded: 'arca_amarillo.png', down: 'arca_rojo.png' };
    img.src = `./icons/${map[status] || map.up}`;
    img.title = status === 'up' ? 'ARCA/AFIP: OK' : status === 'degraded' ? 'ARCA/AFIP: Lento' : 'ARCA/AFIP: Caído';
}

async function handleAutoButtonClick() {
    try {
        const status = await (window.api as any).autoStatus?.();
        const isActive = !!(status as any)?.active;
        const isPaused = !!(status as any)?.paused;
        
        if (isActive && !isPaused) {
            // Si está activo, pausarlo
            await (window.api as any).pauseAuto?.();
            appendLog('Modo automático pausado');
        } else if (isPaused) {
            // Si está pausado, reanudarlo
            const result = await (window.api as any).resumeAuto?.();
            if (result?.ok) {
                appendLog('Modo automático reanudado');
            } else {
                appendLog(`Error al reanudar: ${result?.error || 'Error desconocido'}`);
            }
        } else {
            // Si está inactivo, mostrar mensaje
            appendLog('Modo automático no configurado. Configure en Administración.');
        }
        
        // Actualizar indicadores
        await refreshAutoIndicator();
        await refreshTimer();
    } catch (error) {
        console.error('Error handling auto button click:', error);
        appendLog('Error al cambiar estado automático');
    }
}

// Variable global para controlar auto-scroll
let autoScrollEnabled = true;

// 🚀 Sistema de batching ligero para evitar stalls en alta frecuencia
let logQueue: any[] = [];
let isProcessingQueue = false;
let lastLogTime = Date.now();

function appendLog(lineOrMessage: string | any) {
    // Agregar a la cola
    logQueue.push(lineOrMessage);
    
    // Actualizar indicador de "última actualización"
    updateLastLogIndicator();
    
    // Procesar la cola si no está procesando
    if (!isProcessingQueue) {
        processLogQueue();
    }
}

function processLogQueue() {
    if (isProcessingQueue) return;
    if (logQueue.length === 0) return;
    
    isProcessingQueue = true;
    
    // Usar requestAnimationFrame para render suave sin bloquear
    requestAnimationFrame(() => {
        const box = document.getElementById('cajaLogs') as HTMLElement | null;
        if (!box) {
            isProcessingQueue = false;
            return;
        }
        
        // Procesar hasta 20 logs por frame (balance entre latencia y performance)
        const batch = logQueue.splice(0, 20);
        
        // Crear un fragment para agregar todo de una vez (un solo reflow)
        const fragment = document.createDocumentFragment();
        
        for (const lineOrMessage of batch) {
            // Hora local de la PC (no UTC) en formato HH:MM:SS
            const timestamp = (typeof lineOrMessage === 'object' && lineOrMessage.timestamp) 
                ? new Date(lineOrMessage.timestamp) 
                : new Date();
            const hh = String(timestamp.getHours()).padStart(2,'0');
            const mm = String(timestamp.getMinutes()).padStart(2,'0');
            const ss = String(timestamp.getSeconds()).padStart(2,'0');
            const at = `${hh}:${mm}:${ss}`;
            
            // Crear un nuevo div para cada línea de log
            const logLine = document.createElement('div');
            logLine.style.whiteSpace = 'nowrap';
            logLine.style.padding = '2px 0';
            
            // Si es un objeto estructurado
            if (typeof lineOrMessage === 'object' && lineOrMessage.text) {
                const msg = lineOrMessage;
                
                // Colores según el nivel
                let color = '#94a3b8';
                switch (msg.level) {
                    case 'success': color = '#4ade80'; break;
                    case 'error': color = '#f87171'; break;
                    case 'warning': color = '#fbbf24'; break;
                    case 'process': color = '#60a5fa'; break;
                    case 'info': color = '#94a3b8'; break;
                }
                
                logLine.style.color = color;
                const icon = msg.icon || '';
                const timestampStr = `[${at}]`;
                const mainText = msg.text;
                const detail = msg.detail ? ` | ${msg.detail}` : '';
                logLine.textContent = `${timestampStr} ${icon} ${mainText}${detail}`;
            } else {
                // Retrocompatibilidad con strings simples
                logLine.style.color = '#94a3b8';
                logLine.textContent = `[${at}] ${String(lineOrMessage)}`;
            }
            
            fragment.appendChild(logLine);
        }
        
        // Agregar todo el fragment de una vez (un solo reflow)
        box.appendChild(fragment);
        
        // Limitar a las últimas 200 líneas
        const maxLines = 200;
        while (box.children.length > maxLines) {
            box.removeChild(box.firstChild!);
        }
        
        // Actualizar contador
        updateLogCounter();
        
        // Auto-scroll si está habilitado
        if (autoScrollEnabled) {
            box.scrollTop = box.scrollHeight;
        }
        
        isProcessingQueue = false;
        
        // Si hay más logs en la cola, procesar en el siguiente frame
        if (logQueue.length > 0) {
            processLogQueue();
        }
    });
}

function updateLastLogIndicator() {
    lastLogTime = Date.now();
    const indicator = document.getElementById('logLastUpdate');
    if (indicator) {
        indicator.style.color = '#4ade80'; // verde
        indicator.textContent = '●';
        indicator.title = `Última actualización: ${new Date().toLocaleTimeString()}`;
    }
}

function updateLogCounter() {
    const box = document.getElementById('cajaLogs') as HTMLElement | null;
    const counter = document.getElementById('logCounter') as HTMLElement | null;
    if (!box || !counter) return;
    
    const count = box.children.length;
    counter.textContent = `${count} log${count !== 1 ? 's' : ''}`;
}

function clearLogs() {
    const box = document.getElementById('cajaLogs') as HTMLElement | null;
    if (!box) return;
    
    box.innerHTML = '';
    updateLogCounter();
    appendLog('Logs limpiados');
}

function copyLogs() {
    const box = document.getElementById('cajaLogs') as HTMLElement | null;
    if (!box) return;
    
    const lines: string[] = [];
    for (let i = 0; i < box.children.length; i++) {
        const line = box.children[i].textContent || '';
        if (line) lines.push(line);
    }
    
    const text = lines.join('\n');
    
    // Intentar copiar al portapapeles
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            appendLog('✅ Logs copiados al portapapeles');
        }).catch(() => {
            appendLog('❌ Error al copiar');
        });
    } else {
        // Fallback para navegadores sin clipboard API
        appendLog('❌ Clipboard no disponible');
    }
}

function toggleAutoScroll() {
    autoScrollEnabled = !autoScrollEnabled;
    const btn = document.getElementById('btnPauseScroll') as HTMLButtonElement | null;
    if (!btn) return;
    
    if (autoScrollEnabled) {
        btn.textContent = '⏸️ Auto-scroll';
        btn.title = 'Pausar auto-scroll';
        appendLog('✅ Auto-scroll habilitado');
    } else {
        btn.textContent = '▶️ Auto-scroll';
        btn.title = 'Reanudar auto-scroll';
        appendLog('⏸️ Auto-scroll pausado');
    }
}

function renderLast8(rows: Array<{ id: any; status: any; amount: any; date?: any }>) {
	const tbody = document.getElementById('cajaTableBody');
	if (!tbody) return;
    // Mostrar solo 5 resultados recientes para mejor visualización
    const arr = rows.slice(0,5);
	tbody.innerHTML = arr.map((r) => {
		const amt = (r.amount ?? '') !== '' ? Number(r.amount).toFixed(2) : '';
		
		// Formatear fecha y hora
		let fechaHora = '';
		if (r.date) {
			try {
				const fecha = new Date(r.date);
				if (!isNaN(fecha.getTime())) {
					// Formato: DD/MM/YYYY HH:MM
					const dia = String(fecha.getDate()).padStart(2, '0');
					const mes = String(fecha.getMonth() + 1).padStart(2, '0');
					const año = fecha.getFullYear();
					const hora = String(fecha.getHours()).padStart(2, '0');
					const minuto = String(fecha.getMinutes()).padStart(2, '0');
					fechaHora = `${dia}/${mes}/${año} ${hora}:${minuto}`;
				}
			} catch (e) {
				// Si hay error al parsear la fecha, mostrar el valor original
				fechaHora = String(r.date);
			}
		}
		
		// Procesar estado con colores y traducción
		let estadoTexto = r.status ?? '';
		let estadoClase = '';
		
		switch (r.status?.toLowerCase()) {
			case 'approved':
				estadoTexto = 'Aprobado';
				estadoClase = 'text-green-400 font-semibold';
				break;
			case 'cancelled':
				estadoTexto = 'Cancelado';
				estadoClase = 'text-red-400 font-semibold';
				break;
			case 'refunded':
				estadoTexto = 'Reintegrada';
				estadoClase = 'text-yellow-400 font-semibold';
				break;
			default:
				// Para otros estados, mantener el texto original
				estadoClase = 'text-slate-300';
		}
		
		return `<tr>
			<td>${r.id ?? ''}</td>
			<td class="${estadoClase}">${estadoTexto}</td>
			<td>${amt}</td>
			<td>${fechaHora}</td>
		</tr>`;
	}).join('');
}

function renderTodayBadge() {
    const el = document.getElementById('todayBadge');
    if (!el) return;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth()+1).padStart(2,'0');
    const dd = String(now.getDate()).padStart(2,'0');
    el.textContent = `Hoy: ${yyyy}-${mm}-${dd}`;
}

window.addEventListener('DOMContentLoaded', () => {
    // Tabs
    const navTabs = Array.from(document.querySelectorAll('nav .tab')) as HTMLElement[];
	for (const t of navTabs) t.addEventListener('click', () => {
        const name = (t.dataset.tab as any) as 'home' | 'table' | 'fact';
		for (const x of navTabs) x.classList.toggle('bg-slate-700', x === t);
		for (const x of navTabs) x.classList.toggle('bg-slate-800', x !== t);
		selectPane(name);
	});

    // Pestaña Facturas: selector de fecha + calcular
    const factPane = document.getElementById('pane-fact');
    if (factPane) {
        const controls = document.createElement('div');
        controls.className = 'flex items-center gap-2 mb-2 text-sm';
        const inp = document.createElement('input'); inp.type = 'date'; inp.className = 'bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-slate-200 text-sm';
        const today = new Date(); inp.value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        const btn = document.createElement('button'); btn.textContent = 'Calcular'; btn.className = 'px-2.5 py-0.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 text-sm';
        const totalEl = document.createElement('div'); totalEl.className = 'ml-auto text-slate-300 font-semibold text-sm'; totalEl.id = 'factTotalGeneral';
        controls.appendChild(inp); controls.appendChild(btn); controls.appendChild(totalEl);
        factPane.insertBefore(controls, factPane.firstChild);
        
        const tbodyPesos = document.getElementById('cajaFactTableBodyPesos') as HTMLElement | null;
        const tbodyDolar = document.getElementById('cajaFactTableBodyDolar') as HTMLElement | null;
        const headerPesos = document.getElementById('factHeaderPesos') as HTMLElement | null;
        const headerDolar = document.getElementById('factHeaderDolar') as HTMLElement | null;
        const headerPesosText = document.getElementById('factHeaderPesosText') as HTMLElement | null;
        const headerDolarText = document.getElementById('factHeaderDolarText') as HTMLElement | null;
        const tablePesos = document.getElementById('factTablePesos') as HTMLElement | null;
        const tableDolar = document.getElementById('factTableDolar') as HTMLElement | null;
        
        // Toggle collapse para PESOS
        let colapsadoPesos = true;
        headerPesos?.addEventListener('click', () => {
            colapsadoPesos = !colapsadoPesos;
            if (tablePesos) tablePesos.classList.toggle('hidden', colapsadoPesos);
            if (headerPesosText) headerPesosText.textContent = headerPesosText.textContent?.replace(/^[▶▼]\s*/, colapsadoPesos ? '▶ ' : '▼ ') || '';
        });
        
        // Toggle collapse para DÓLARES
        let colapsadoDolar = true;
        headerDolar?.addEventListener('click', () => {
            colapsadoDolar = !colapsadoDolar;
            if (tableDolar) tableDolar.classList.toggle('hidden', colapsadoDolar);
            if (headerDolarText) headerDolarText.textContent = headerDolarText.textContent?.replace(/^[▶▼]\s*/, colapsadoDolar ? '▶ ' : '▼ ') || '';
        });
        
        const render = (rows: any[], totalGeneral: number, totalGeneralUSD?: number) => {
            const fmt = (n: number) => new Intl.NumberFormat('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n||0);
            
            // Separar filas por moneda
            const tiposPesos = ['FB','FA','NCB','NCA','REC','REM'];
            const tiposDolar = ['FBD','FAD','NCBD','NCAD'];
            const rowsPesos = rows.filter(r => tiposPesos.includes(r.tipo));
            const rowsDolar = rows.filter(r => tiposDolar.includes(r.tipo));
            
            // Contar comprobantes con datos
            const countPesos = rowsPesos.filter(r => r.desde || r.hasta || r.total > 0).length;
            const countDolar = rowsDolar.filter(r => r.desde || r.hasta || r.total > 0).length;
            
            // Renderizar tabla PESOS
            if (tbodyPesos) tbodyPesos.innerHTML = rowsPesos.map(r => {
                const totalDisplay = r.tipo === 'REM' ? '' : fmt(r.total||0);
                return `<tr>
                    <td>${r.tipo}</td>
                    <td>${r.desde ?? ''}</td>
                    <td>${r.hasta ?? ''}</td>
                    <td class="text-right">${totalDisplay}</td>
                </tr>`;
            }).join('');
            
            // Renderizar tabla DÓLARES
            if (tbodyDolar) tbodyDolar.innerHTML = rowsDolar.map(r => {
                const tipoSinD = r.tipo.replace('D',''); // FAD → FA, FBD → FB
                return `<tr>
                    <td>${tipoSinD}</td>
                    <td>${r.desde ?? ''}</td>
                    <td>${r.hasta ?? ''}</td>
                    <td class="text-right">${fmt(r.total||0)}</td>
                </tr>`;
            }).join('');
            
            // Actualizar headers con resumen
            if (headerPesosText) headerPesosText.textContent = `▶ Facturas en PESOS (${countPesos} comp. - Total: ${fmt(totalGeneral)})`;
            if (headerDolarText) headerDolarText.textContent = `▶ Facturas en DÓLARES 💵 (${countDolar} comp. - Total: ${fmt(totalGeneralUSD||0)})`;
            
            // Total general (arriba)
            let totalText = `Total (FA+FB): ${fmt(totalGeneral)}`;
            if (totalGeneralUSD && totalGeneralUSD > 0) {
                totalText += ` | USD: ${fmt(totalGeneralUSD)}`;
            }
            totalEl.textContent = totalText;
        };
        
        btn.addEventListener('click', async () => {
            appendLog('Calculando resumen diario...');
            const res = await (window.api as any).caja.getSummary(inp.value);
            if (res?.ok) { render(res.rows||[], res.totalGeneral||0, res.totalGeneralUSD||0); appendLog('Resumen listo'); } else { appendLog(`Error resumen: ${res?.error||'desconocido'}`); }
        });
    }

	// Función para procesar facturación automática desde archivo
	window.processAutomaticBilling = async function(data: any) {
		try {
			appendLog('📄 Procesando facturación automática...');
			
			const hoy = new Date();
			const yyyy = hoy.getFullYear();
			const mm = String(hoy.getMonth()+1).padStart(2,'0');
			const dd = String(hoy.getDate()).padStart(2,'0');
			
			const res = await (window.api as any).facturacion?.emitir({
				pto_vta: data.pto_vta || 1,
				tipo_cbte: data.tipo_cbte || 1,
				fecha: data.fecha || `${yyyy}${mm}${dd}`,
				cuit_emisor: data.cuit_emisor || '20123456789',
				cuit_receptor: data.cuit_receptor,
				razon_social_receptor: data.razon_social_receptor,
				condicion_iva_receptor: data.condicion_iva_receptor || 'RI',
				neto: data.neto,
				iva: data.iva,
				total: data.total,
				detalle: data.detalle,
				empresa: data.empresa || { nombre: 'TODO-COMPUTACIÓN', cuit: '20123456789' },
				plantilla: data.plantilla || 'factura_a'
			});
			
			if (res?.ok) {
				appendLog(`✅ Factura automática emitida Nº ${res.numero} - CAE: ${res.cae}`);
				return res;
			} else {
				appendLog(`❌ Error en facturación automática: ${res?.error || 'falló emisión'}`);
				throw new Error(res?.error || 'Error en facturación automática');
			}
		} catch (e) {
			appendLog(`❌ Error procesando facturación automática: ${e}`);
			throw e;
		}
	};

	// Botón automático
	document.getElementById('autoIndicatorCaja')?.addEventListener('click', handleAutoButtonClick);

	// Ir a Configuración
	document.getElementById('btnGoConfig')?.addEventListener('click', async () => {
		await (window.api as any).openView?.('config');
	});

	// Controles del visor de logs
	document.getElementById('btnClearLogs')?.addEventListener('click', clearLogs);
	document.getElementById('btnCopyLogs')?.addEventListener('click', copyLogs);
	document.getElementById('btnPauseScroll')?.addEventListener('click', toggleAutoScroll);

	// 🔧 Control del Spool (.fac processing)
	async function updateSpoolUI() {
		try {
			const result = await (window.api as any).caja.watcherStatus();
			const status = result?.status || { running: false, paused: false, adminEnabled: false };
			
			const btn = document.getElementById('btnSpoolToggle') as HTMLButtonElement | null;
			if (!btn) return;
			
			// Si Admin desactivó el watcher, deshabilitar botón
			if (!status.adminEnabled || !status.running) {
				btn.disabled = true;
				btn.textContent = '🔒';
				btn.title = 'Spool desactivado por administrador';
				btn.className = 'px-3 py-1.5 text-sm rounded bg-slate-700 text-slate-400 border border-slate-600 shadow cursor-not-allowed opacity-50';
				return;
			}
			
			// Si Admin está ON, permitir pausar/reanudar
			btn.disabled = false;
			if (status.paused) {
				btn.textContent = '▶️';
				btn.title = 'Reanudar Spool (procesamiento .fac)';
				btn.className = 'px-3 py-1.5 text-sm rounded bg-rose-700 hover:bg-rose-600 text-slate-200 border border-rose-600 shadow';
			} else {
				btn.textContent = '⏸️';
				btn.title = 'Pausar Spool (procesamiento .fac)';
				btn.className = 'px-3 py-1.5 text-sm rounded bg-emerald-700 hover:bg-emerald-600 text-slate-200 border border-emerald-600 shadow';
			}
		} catch (e) {
			console.error('[caja] Error updating spool UI:', e);
		}
	}
	
	async function toggleSpool() {
		try {
			const statusResult = await (window.api as any).caja.watcherStatus();
			const currentStatus = statusResult?.status || { paused: false };
			
			if (currentStatus.paused) {
				// Reanudar
				const result = await (window.api as any).caja.watcherResume();
				if (result?.ok) {
					appendLog({ level: 'success', icon: '▶️', text: 'Spool reanudado', detail: 'Procesamiento de .fac activado' });
				} else {
					appendLog({ level: 'error', icon: '❌', text: 'Error al reanudar Spool', detail: result?.error || 'Error desconocido' });
				}
			} else {
				// Pausar
				const result = await (window.api as any).caja.watcherPause();
				if (result?.ok) {
					appendLog({ level: 'warning', icon: '⏸️', text: 'Spool pausado', detail: 'No se procesarán archivos .fac nuevos' });
				} else {
					appendLog({ level: 'error', icon: '❌', text: 'Error al pausar Spool', detail: result?.error || 'Error desconocido' });
				}
			}
			
			// Actualizar UI inmediatamente
			await updateSpoolUI();
		} catch (e: any) {
			appendLog({ level: 'error', icon: '❌', text: 'Error al cambiar estado del Spool', detail: String(e?.message || e) });
		}
	}
	
	document.getElementById('btnSpoolToggle')?.addEventListener('click', toggleSpool);
	
	// Actualizar estado del spool cada 5 segundos
	updateSpoolUI();
	setInterval(updateSpoolUI, 5000);

	// Notificaciones automáticas
	window.api.onAutoNotice?.((payload) => {
		if ((payload as any)?.error) {
			appendLog(`Auto: ${(payload as any).error}`);
		} else if ((payload as any)?.info) {
			appendLog(String((payload as any).info));
		} else if ((payload as any)?.count !== undefined) {
			appendLog(`Auto-reporte generado (${(payload as any)?.count ?? 0})`);
			const rows = (payload as any)?.rows;
			if (Array.isArray(rows)) {
				renderLast8(rows.map((r: any) => ({ id: r.id, status: r.status, amount: r.amount, date: r.date })));
			}
		}
		
		// Si es un mensaje de día deshabilitado, actualizar el indicador
		if ((payload as any)?.dayDisabled) {
			refreshAutoIndicator();
		}
		
		refreshAutoIndicator();
		refreshTimer();
	});

	// Actualizaciones del timer
	window.api.onAutoTimerUpdate?.((payload) => {
		if (payload) {
			updateTimer(payload.remaining || 0, payload.configured || 0);
		}
	});

    // Suscribirse al estado de salud de WS (si backend emite)
    try {
        (window as any).api?.onWsHealth?.((p: any) => { if (p?.status) setArcaIndicator(p.status); });
    } catch {}

	// Logs de procesamiento .fac (backend → frontend)
	window.api.onCajaLog?.((message: string | any) => {
		appendLog(message);
	});
	
	// 🔄 Watchdog: detectar si los logs se "tildan" (no actualizan por >30s)
	setInterval(() => {
		const now = Date.now();
		const indicator = document.getElementById('logLastUpdate');
		if (!indicator) return;
		
		const timeSinceLastLog = now - lastLogTime;
		
		if (timeSinceLastLog > 30000) {
			// Más de 30 segundos sin logs → indicador rojo (posible problema)
			indicator.style.color = '#f87171'; // rojo
			indicator.textContent = '●';
			indicator.title = `⚠️ Sin logs desde hace ${Math.floor(timeSinceLastLog / 1000)}s`;
		} else if (timeSinceLastLog > 15000) {
			// Entre 15-30s → indicador amarillo (alerta)
			indicator.style.color = '#fbbf24'; // amarillo
			indicator.textContent = '●';
			indicator.title = `Último log hace ${Math.floor(timeSinceLastLog / 1000)}s`;
		}
		// Si es menor a 15s, el indicador ya está verde por updateLastLogIndicator()
	}, 5000); // Revisar cada 5 segundos

	// 📜 Cargar logs históricos del último día al abrir la ventana
	async function loadHistoricalLogs() {
		try {
			const result = await (window.api as any).caja.getLogs();
			if (result?.success && result?.logs?.length > 0) {
				console.log(`[Caja] Cargando ${result.logs.length} logs históricos...`);
				for (const log of result.logs) {
					// Reconstruir el mensaje con el timestamp original
					appendLog({
						level: log.level,
						icon: log.icon,
						text: log.text,
						detail: log.detail,
						timestamp: log.timestamp // Usar timestamp original del log
					});
				}
				appendLog({ level: 'info', icon: '📜', text: `${result.logs.length} logs históricos cargados`, detail: 'Últimas 24 horas' });
			}
		} catch (error) {
			console.error('[Caja] Error loading historical logs:', error);
		}
	}
	loadHistoricalLogs();

	refreshAutoIndicator();
	refreshTimer();
    renderTodayBadge();
});
