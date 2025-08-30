function selectPane(name) {
    const home = document.getElementById('pane-home');
    const table = document.getElementById('pane-table');
    const badge = document.getElementById('todayBadge');
    const auto = document.getElementById('autoIndicatorCaja');
    const timer = document.getElementById('autoTimer');
    if (!home || !table)
        return;
    home.style.display = name === 'home' ? 'block' : 'none';
    table.style.display = name === 'table' ? 'block' : 'none';
    if (badge)
        badge.style.display = name === 'home' ? 'inline-block' : 'none';
    if (auto)
        auto.style.display = name === 'home' ? 'inline-block' : 'none';
    if (timer)
        timer.style.display = name === 'home' ? 'block' : 'none';
}
function setAutoIndicator(active, paused = false, dayDisabled = false) {
    const el = document.getElementById('autoIndicatorCaja');
    if (!el)
        return;
    let text, className;
    if (dayDisabled) {
        text = 'Desact.(día)';
        className = 'px-3 py-1 rounded text-sm border font-medium hover:opacity-80 transition-opacity bg-slate-700/30 text-slate-300 border-slate-600';
    }
    else if (paused) {
        text = 'auto:Off';
        className = 'px-3 py-1 rounded text-sm border font-medium hover:opacity-80 transition-opacity bg-rose-700/30 text-rose-300 border-rose-600';
    }
    else if (active) {
        text = 'auto:On';
        className = 'px-3 py-1 rounded text-sm border font-medium hover:opacity-80 transition-opacity bg-emerald-700/30 text-emerald-300 border-emerald-600';
    }
    else {
        text = 'auto:Desactivado';
        className = 'px-3 py-1 rounded text-sm border font-medium hover:opacity-80 transition-opacity bg-slate-700/30 text-slate-300 border-slate-600';
    }
    el.textContent = text;
    el.className = className;
}
function updateTimer(remaining, configured) {
    const el = document.getElementById('autoTimer');
    if (!el)
        return;
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
        const s = await window.api.autoStatus?.();
        const isActive = !!s?.active;
        const isPaused = !!s?.paused;
        // Verificar si el día actual está habilitado
        const cfg = await window.api.getConfig();
        const today = new Date().getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
        const dayConfigs = [
            cfg.AUTO_DAYS_SUNDAY, // 0 = Domingo
            cfg.AUTO_DAYS_MONDAY, // 1 = Lunes
            cfg.AUTO_DAYS_TUESDAY, // 2 = Martes
            cfg.AUTO_DAYS_WEDNESDAY, // 3 = Miércoles
            cfg.AUTO_DAYS_THURSDAY, // 4 = Jueves
            cfg.AUTO_DAYS_FRIDAY, // 5 = Viernes
            cfg.AUTO_DAYS_SATURDAY // 6 = Sábado
        ];
        const dayDisabled = dayConfigs[today] === false;
        setAutoIndicator(isActive, isPaused, dayDisabled);
    }
    catch {
        const cfg = await window.api.getConfig();
        setAutoIndicator(!!cfg?.AUTO_ENABLED);
    }
}
async function refreshTimer() {
    try {
        const timer = await window.api.getAutoTimer?.();
        if (timer) {
            updateTimer(timer.remaining || 0, timer.configured || 0);
        }
    }
    catch (error) {
        console.warn('Error refreshing timer:', error);
    }
}
async function handleAutoButtonClick() {
    try {
        const status = await window.api.autoStatus?.();
        const isActive = !!status?.active;
        const isPaused = !!status?.paused;
        if (isActive && !isPaused) {
            // Si está activo, pausarlo
            await window.api.pauseAuto?.();
            appendLog('Modo automático pausado');
        }
        else if (isPaused) {
            // Si está pausado, reanudarlo
            const result = await window.api.resumeAuto?.();
            if (result?.ok) {
                appendLog('Modo automático reanudado');
            }
            else {
                appendLog(`Error al reanudar: ${result?.error || 'Error desconocido'}`);
            }
        }
        else {
            // Si está inactivo, mostrar mensaje
            appendLog('Modo automático no configurado. Configure en Administración.');
        }
        // Actualizar indicadores
        await refreshAutoIndicator();
        await refreshTimer();
    }
    catch (error) {
        console.error('Error handling auto button click:', error);
        appendLog('Error al cambiar estado automático');
    }
}
function appendLog(line) {
    const box = document.getElementById('cajaLogs');
    if (!box)
        return;
    // Hora local de la PC (no UTC) en formato HH:MM:SS
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const at = `${hh}:${mm}:${ss}`;
    const current = (box.textContent || '').split('\n').filter(Boolean);
    const maxLines = 3;
    current.push(`[${at}] ${line}`);
    const trimmed = current.slice(-maxLines);
    box.textContent = trimmed.join('\n');
    box.scrollTop = box.scrollHeight;
}
function renderLast8(rows) {
    const tbody = document.getElementById('cajaTableBody');
    if (!tbody)
        return;
    // Mostrar solo 5 resultados recientes para mejor visualización
    const arr = rows.slice(0, 5);
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
            }
            catch (e) {
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
    if (!el)
        return;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    el.textContent = `Hoy: ${yyyy}-${mm}-${dd}`;
}
window.addEventListener('DOMContentLoaded', () => {
    // Tabs
    const navTabs = Array.from(document.querySelectorAll('nav .tab'));
    for (const t of navTabs)
        t.addEventListener('click', () => {
            const name = t.dataset.tab;
            for (const x of navTabs)
                x.classList.toggle('bg-slate-700', x === t);
            for (const x of navTabs)
                x.classList.toggle('bg-slate-800', x !== t);
            selectPane(name);
        });
    // Botón generar reporte
    document.getElementById('btnCajaGenerate')?.addEventListener('click', async () => {
        appendLog('Generando reporte...');
        const res = await window.api.generateReport();
        appendLog(`Reporte generado: ${res.count} pagos`);
        // Render quick last 8 from returned rows
        renderLast8((res.rows || []).map((r) => ({ id: r.id, status: r.status, amount: r.amount, date: r.date })));
    });
    // Función para procesar facturación automática desde archivo
    window.processAutomaticBilling = async function (data) {
        try {
            appendLog('📄 Procesando facturación automática...');
            const hoy = new Date();
            const yyyy = hoy.getFullYear();
            const mm = String(hoy.getMonth() + 1).padStart(2, '0');
            const dd = String(hoy.getDate()).padStart(2, '0');
            const res = await window.api.facturacion?.emitir({
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
            }
            else {
                appendLog(`❌ Error en facturación automática: ${res?.error || 'falló emisión'}`);
                throw new Error(res?.error || 'Error en facturación automática');
            }
        }
        catch (e) {
            appendLog(`❌ Error procesando facturación automática: ${e}`);
            throw e;
        }
    };
    // Botón automático
    document.getElementById('autoIndicatorCaja')?.addEventListener('click', handleAutoButtonClick);
    // Ir a Configuración
    document.getElementById('btnGoConfig')?.addEventListener('click', async () => {
        await window.api.openView?.('config');
    });
    // Notificaciones automáticas
    window.api.onAutoNotice?.((payload) => {
        if (payload?.error) {
            appendLog(`Auto: ${payload.error}`);
        }
        else if (payload?.info) {
            appendLog(String(payload.info));
        }
        else if (payload?.count !== undefined) {
            appendLog(`Auto-reporte generado (${payload?.count ?? 0})`);
            const rows = payload?.rows;
            if (Array.isArray(rows)) {
                renderLast8(rows.map((r) => ({ id: r.id, status: r.status, amount: r.amount, date: r.date })));
            }
        }
        // Si es un mensaje de día deshabilitado, actualizar el indicador
        if (payload?.dayDisabled) {
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
    refreshAutoIndicator();
    refreshTimer();
    renderTodayBadge();
});
