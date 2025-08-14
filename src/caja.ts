function selectPane(name: 'home' | 'table') {
    const home = document.getElementById('pane-home') as HTMLElement | null;
    const table = document.getElementById('pane-table') as HTMLElement | null;
    const badge = document.getElementById('todayBadge') as HTMLElement | null;
    const auto = document.getElementById('autoIndicatorCaja') as HTMLElement | null;
    if (!home || !table) return;
    home.style.display = name === 'home' ? 'block' : 'none';
    table.style.display = name === 'table' ? 'block' : 'none';
    if (badge) badge.style.display = name === 'home' ? 'inline-block' : 'none';
    if (auto) auto.style.display = name === 'home' ? 'inline-block' : 'none';
}

function setAutoIndicator(active: boolean) {
	const el = document.getElementById('autoIndicatorCaja');
	if (!el) return;
	el.textContent = active ? 'Modo automático: ON' : 'Modo automático: OFF';
	el.className = 'px-3 py-1 rounded text-sm border ' + (active ? 'bg-emerald-700/30 text-emerald-300 border-emerald-600' : 'bg-rose-700/30 text-rose-300 border-rose-600');
}

async function refreshAutoIndicator() {
    try {
        const s = await (window.api as any).autoStatus?.();
        setAutoIndicator(!!(s as any)?.active);
    } catch {
        const cfg = await window.api.getConfig();
        setAutoIndicator(!!(cfg as any)?.AUTO_ENABLED);
    }
}

function appendLog(line: string) {
    const box = document.getElementById('cajaLogs') as HTMLElement | null;
    if (!box) return;
    const at = new Date().toISOString().slice(11,19);
    const current = (box.textContent || '').split('\n').filter(Boolean);
    const maxLines = 3;
    current.push(`[${at}] ${line}`);
    const trimmed = current.slice(-maxLines);
    box.textContent = trimmed.join('\n');
    box.scrollTop = box.scrollHeight;
}

function renderLast8(rows: Array<{ id: any; status: any; amount: any; date?: any }>) {
	const tbody = document.getElementById('cajaTableBody');
	if (!tbody) return;
    // Mostrar solo 6 resultados recientes para dejar espacio a la UI
    const arr = rows.slice(0,6);
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
		
		return `<tr>
			<td>${r.id ?? ''}</td>
			<td>${r.status ?? ''}</td>
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
		const name = (t.dataset.tab as any) as 'home' | 'table';
		for (const x of navTabs) x.classList.toggle('bg-slate-700', x === t);
		for (const x of navTabs) x.classList.toggle('bg-slate-800', x !== t);
		selectPane(name);
	});

	// Botón generar reporte
	document.getElementById('btnCajaGenerate')?.addEventListener('click', async () => {
		appendLog('Generando reporte...');
		const res = await window.api.generateReport();
		appendLog(`Reporte generado: ${res.count} pagos`);
		// Render quick last 8 from returned rows
		renderLast8((res.rows || []).map((r: any) => ({ id: r.id, status: r.status, amount: r.amount, date: r.date })));
		appendLog('Enviando mp.dbf por FTP (si está configurado)...');
	});

	// Controles de tamaño removidos (mantener función por si se reintroducen)

	// Ir a Configuración
	document.getElementById('btnGoConfig')?.addEventListener('click', async () => {
		await (window.api as any).openView?.('config');
	});

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
		refreshAutoIndicator();
	});

	refreshAutoIndicator();
    renderTodayBadge();
});
