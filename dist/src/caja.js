function selectPane(name) {
    const home = document.getElementById('pane-home');
    const table = document.getElementById('pane-table');
    if (!home || !table)
        return;
    home.style.display = name === 'home' ? 'block' : 'none';
    table.style.display = name === 'table' ? 'block' : 'none';
}
function setAutoIndicator(active) {
    const el = document.getElementById('autoIndicatorCaja');
    if (!el)
        return;
    el.textContent = active ? 'Modo automático: ON' : 'Modo automático: OFF';
    el.className = 'px-3 py-1 rounded text-sm border ' + (active ? 'bg-emerald-700/30 text-emerald-300 border-emerald-600' : 'bg-rose-700/30 text-rose-300 border-rose-600');
}
async function refreshAutoIndicator() {
    try {
        const s = await window.api.autoStatus?.();
        setAutoIndicator(!!s?.active);
    }
    catch {
        const cfg = await window.api.getConfig();
        setAutoIndicator(!!cfg?.AUTO_ENABLED);
    }
}
function appendLog(line) {
    const box = document.getElementById('cajaLogs');
    if (!box)
        return;
    const at = new Date().toISOString().slice(11, 19);
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
    const arr = rows.slice(0, 8);
    tbody.innerHTML = arr.map((r) => {
        const amt = (r.amount ?? '') !== '' ? Number(r.amount).toFixed(2) : '';
        return `<tr>
			<td class="px-3 py-2">${r.id ?? ''}</td>
			<td class="px-3 py-2">${r.status ?? ''}</td>
			<td class="px-3 py-2">${amt}</td>
		</tr>`;
    }).join('');
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
        renderLast8((res.rows || []).map((r) => ({ id: r.id, status: r.status, amount: r.amount })));
        appendLog('Enviando mp.dbf por FTP (si está configurado)...');
    });
    // Controles de tamaño removidos (mantener función por si se reintroducen)
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
                renderLast8(rows.map((r) => ({ id: r.id, status: r.status, amount: r.amount })));
            }
        }
        refreshAutoIndicator();
    });
    refreshAutoIndicator();
});
