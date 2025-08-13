window.addEventListener('DOMContentLoaded', () => {
    const tabs = Array.from(document.querySelectorAll('.tab'));
    const panes = Array.from(document.querySelectorAll('.tab-pane'));
    function activateTabByName(name) {
        for (const x of tabs)
            x.classList.toggle('active', x.dataset.tab === name);
        for (const p of panes)
            p.classList.toggle('active', p.id === `tab-${name}`);
    }
    for (const t of tabs) {
        t.addEventListener('click', async () => {
            activateTabByName(t.dataset.tab);
            try {
                const cfg = await window.api.getConfig();
                await window.api.saveConfig({ ...(cfg || {}), LAST_ACTIVE_TAB: t.dataset.tab });
            }
            catch { }
        });
    }
    const ids = [
        'MP_ACCESS_TOKEN', 'MP_USER_ID', 'MP_TZ', 'MP_WINDOW_START', 'MP_WINDOW_END', 'MP_DATE_FROM', 'MP_DATE_TO',
        'MP_NO_DATE_FILTER', 'MP_RANGE', 'MP_STATUS', 'MP_LIMIT', 'MP_MAX_PAGES', 'EMAIL_REPORT', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS',
        'FTP_IP', 'FTP_PORT', 'FTP_SECURE', 'FTP_USER', 'FTP_PASS', 'FTP_DIR', 'FTP_FILE',
        'AUTO_INTERVAL_SECONDS'
    ];
    const el = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
    const preview = document.getElementById('preview');
    function enhanceUI() {
        for (const b of Array.from(document.querySelectorAll('button'))) {
            b.classList.add('px-3', 'py-2', 'rounded-md', 'text-sm', 'font-medium', 'border', 'border-slate-600', 'hover:bg-slate-800', 'focus:outline-none', 'focus:ring-2', 'focus:ring-blue-500');
        }
        const primary = ['btnGenerate', 'btnGenerateRange'];
        for (const id of primary)
            document.getElementById(id)?.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-500', 'border-transparent');
        document.getElementById('btnSave')?.classList.add('bg-emerald-600', 'text-white', 'hover:bg-emerald-500', 'border-transparent');
        document.getElementById('btnSendEmail')?.classList.add('bg-emerald-600', 'text-white', 'hover:bg-emerald-500', 'border-transparent');
        for (const i of Array.from(document.querySelectorAll('input, select'))) {
            i.classList.add('bg-slate-800', 'border', 'border-slate-600', 'rounded-md', 'px-3', 'py-2', 'text-sm', 'text-slate-100', 'placeholder-slate-400', 'focus:outline-none', 'focus:ring-2', 'focus:ring-blue-500');
        }
        for (const r of Array.from(document.querySelectorAll('.row'))) {
            r.classList.add('flex', 'flex-wrap', 'items-center', 'gap-2');
        }
        const table = document.getElementById('resultsTable');
        if (table) {
            table.classList.add('table-auto', 'w-full', 'divide-y', 'divide-slate-700');
            const thead = table.querySelector('thead');
            if (thead)
                thead.classList.add('bg-slate-800');
            for (const th of Array.from(table.querySelectorAll('th')))
                th.classList.add('px-2', 'py-2', 'text-left');
            for (const td of Array.from(table.querySelectorAll('td')))
                td.classList.add('px-2', 'py-2');
        }
    }
    function showToast(message) {
        const toast = document.getElementById('toast');
        if (!toast)
            return;
        toast.textContent = message;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }
    async function applyTheme(theme) {
        const body = document.body;
        if (theme === 'light') {
            body.classList.remove('bg-slate-900', 'text-slate-200');
            body.classList.add('bg-slate-50', 'text-slate-900');
        }
        else {
            body.classList.remove('bg-slate-50', 'text-slate-900');
            body.classList.add('bg-slate-900', 'text-slate-200');
        }
        const cfg = await window.api.getConfig();
        await window.api.saveConfig({ ...cfg, THEME: theme });
    }
    function buildConfigFromForm() {
        return {
            MP_ACCESS_TOKEN: el.MP_ACCESS_TOKEN.value || undefined,
            MP_USER_ID: el.MP_USER_ID.value || undefined,
            MP_TZ: el.MP_TZ.value || undefined,
            MP_WINDOW_START: el.MP_WINDOW_START.value || undefined,
            MP_WINDOW_END: el.MP_WINDOW_END.value || undefined,
            MP_DATE_FROM: el.MP_DATE_FROM.value || undefined,
            MP_DATE_TO: el.MP_DATE_TO.value || undefined,
            MP_NO_DATE_FILTER: el.MP_NO_DATE_FILTER.checked || false,
            MP_RANGE: el.MP_RANGE.value || undefined,
            MP_STATUS: el.MP_STATUS.value || undefined,
            MP_LIMIT: el.MP_LIMIT.value ? Number(el.MP_LIMIT.value) : undefined,
            MP_MAX_PAGES: el.MP_MAX_PAGES.value ? Number(el.MP_MAX_PAGES.value) : undefined,
            EMAIL_REPORT: el.EMAIL_REPORT.value || undefined,
            SMTP_HOST: el.SMTP_HOST.value || undefined,
            SMTP_PORT: el.SMTP_PORT.value ? Number(el.SMTP_PORT.value) : undefined,
            SMTP_USER: el.SMTP_USER.value || undefined,
            SMTP_PASS: el.SMTP_PASS.value || undefined,
            FTP_IP: el.FTP_IP?.value || undefined,
            FTP_PORT: el.FTP_PORT?.value ? Number(el.FTP_PORT.value) : undefined,
            FTP_SECURE: el.FTP_SECURE?.checked || false,
            FTP_USER: el.FTP_USER?.value || undefined,
            FTP_PASS: el.FTP_PASS?.value || undefined,
            FTP_DIR: el.FTP_DIR?.value || undefined,
            FTP_FILE: el.FTP_FILE?.value || undefined,
            AUTO_INTERVAL_SECONDS: el.AUTO_INTERVAL_SECONDS?.value ? Number(el.AUTO_INTERVAL_SECONDS.value) : undefined,
            DEFAULT_VIEW: 'caja'
        };
    }
    function setFormFromConfig(cfg) {
        if (!cfg)
            return;
        el.MP_ACCESS_TOKEN.value = cfg.MP_ACCESS_TOKEN || '';
        el.MP_USER_ID.value = cfg.MP_USER_ID || '';
        el.MP_TZ.value = cfg.MP_TZ || '';
        el.MP_WINDOW_START.value = cfg.MP_WINDOW_START || '';
        el.MP_WINDOW_END.value = cfg.MP_WINDOW_END || '';
        el.MP_DATE_FROM.value = cfg.MP_DATE_FROM || '';
        el.MP_DATE_TO.value = cfg.MP_DATE_TO || '';
        el.MP_NO_DATE_FILTER.checked = !!cfg.MP_NO_DATE_FILTER;
        el.MP_RANGE.value = cfg.MP_RANGE || '';
        el.MP_STATUS.value = cfg.MP_STATUS || '';
        el.MP_LIMIT.value = cfg.MP_LIMIT || '';
        el.MP_MAX_PAGES.value = cfg.MP_MAX_PAGES || '';
        el.EMAIL_REPORT.value = cfg.EMAIL_REPORT || '';
        el.SMTP_HOST.value = cfg.SMTP_HOST || '';
        el.SMTP_PORT.value = cfg.SMTP_PORT || '';
        el.SMTP_USER.value = cfg.SMTP_USER || '';
        el.SMTP_PASS.value = cfg.SMTP_PASS || '';
        el.FTP_IP.value = cfg.FTP_IP || '';
        el.FTP_PORT.value = cfg.FTP_PORT || '';
        el.FTP_SECURE.checked = !!cfg.FTP_SECURE;
        el.FTP_USER.value = cfg.FTP_USER || '';
        el.FTP_PASS.value = cfg.FTP_PASS || '';
        el.FTP_DIR.value = cfg.FTP_DIR || '';
        el.FTP_FILE.value = cfg.FTP_FILE || '';
        el.AUTO_INTERVAL_SECONDS.value = cfg.AUTO_INTERVAL_SECONDS || '';
    }
    function renderPreview(cfg) {
        const safe = { ...cfg };
        if (safe.MP_ACCESS_TOKEN)
            safe.MP_ACCESS_TOKEN = '********';
        if (safe.SMTP_PASS)
            safe.SMTP_PASS = '********';
        preview.textContent = JSON.stringify(safe, null, 2);
    }
    document.getElementById('btnLoad').addEventListener('click', async () => {
        const cfg = await window.api.getConfig();
        setFormFromConfig(cfg);
        renderPreview(cfg);
        showToast('Configuración cargada');
    });
    document.getElementById('btnSave').addEventListener('click', async () => {
        const cfg = buildConfigFromForm();
        await window.api.saveConfig(cfg);
        renderPreview(cfg);
        showToast('Configuración guardada');
    });
    document.getElementById('btnGenerate').addEventListener('click', async () => {
        const res = await window.api.generateReport();
        allRows = res.rows || [];
        page = 1;
        renderRows();
        if (typeof activateTabByName === 'function')
            activateTabByName('results');
        showToast(`Reporte generado (${res.count})`);
    });
    document.getElementById('btnTestFtp')?.addEventListener('click', async () => {
        const status = document.getElementById('ftpTestStatus');
        if (status)
            status.textContent = 'Probando FTP...';
        try {
            const res = await window.api.testFtpConnection?.();
            if (res?.ok) {
                if (status)
                    status.textContent = 'FTP OK';
                status.style.color = '#10b981';
            }
            else {
                if (status) {
                    status.textContent = `Error: ${res?.error || 'ver configuración'}`;
                    status.style.color = '#ef4444';
                }
            }
        }
        catch (e) {
            if (status) {
                status.textContent = `Error: ${e?.message || e}`;
                status.style.color = '#ef4444';
            }
        }
    });
    document.getElementById('btnSendDbfFtp')?.addEventListener('click', async () => {
        try {
            const res = await window.api.sendDbfViaFtp?.();
            showToast(res?.ok ? 'DBF enviado por FTP' : `Error FTP: ${res?.error || ''}`);
        }
        catch (e) {
            showToast(`Error FTP: ${e?.message || e}`);
        }
    });
    window.api.getConfig().then((cfg) => {
        setFormFromConfig(cfg);
        renderPreview(cfg || {});
        if (cfg && cfg.THEME)
            applyTheme(cfg.THEME);
        enhanceUI();
        if (cfg && cfg.LAST_ACTIVE_TAB)
            activateTabByName(cfg.LAST_ACTIVE_TAB);
        const sel = document.getElementById('pageSize');
        if (cfg && cfg.PAGE_SIZE) {
            const n = Number(cfg.PAGE_SIZE);
            if (Number.isFinite(n) && n > 0) {
                pageSize = n;
                if (sel)
                    sel.value = String(n);
            }
        }
        const fStatus = document.getElementById('filter_status');
        const fQuery = document.getElementById('quick_search');
        const fFrom = document.getElementById('filter_from');
        const fTo = document.getElementById('filter_to');
        if (cfg && fStatus)
            fStatus.value = cfg.LAST_FILTER_STATUS || '';
        if (cfg && fQuery)
            fQuery.value = cfg.LAST_FILTER_QUERY || '';
        if (cfg && fFrom)
            fFrom.value = cfg.LAST_FILTER_FROM || '';
        if (cfg && fTo)
            fTo.value = cfg.LAST_FILTER_TO || '';
        renderRows();
    });
    document.getElementById('btnTest')?.addEventListener('click', async () => {
        const testStatus = document.getElementById('testStatus');
        testStatus.textContent = 'Probando...';
        const res = await window.api.testConnection();
        if (res.ok) {
            testStatus.textContent = 'OK';
            testStatus.style.color = '#10b981';
        }
        else {
            testStatus.textContent = `Error: ${res.error || 'ver credenciales'}`;
            testStatus.style.color = '#ef4444';
        }
    });
    document.getElementById('toggleTheme')?.addEventListener('click', async () => {
        const cfg = await window.api.getConfig();
        const next = cfg.THEME === 'light' ? 'dark' : 'light';
        applyTheme(next);
        showToast(`Tema: ${next}`);
    });
    document.getElementById('toggleThemeMobile')?.addEventListener('click', async () => {
        const cfg = await window.api.getConfig();
        const next = cfg.THEME === 'light' ? 'dark' : 'light';
        applyTheme(next);
        showToast(`Tema: ${next}`);
    });
    if (window.api.onAutoNotice) {
        window.api.onAutoNotice((payload) => {
            if (payload?.error) {
                showToast(`Auto-reporte error: ${payload.error}`);
            }
            else {
                showToast(`Auto-reporte generado (${payload?.count ?? 0})`);
                addHistoryItem({ tag: new Date().toISOString().slice(0, 10), files: [] });
            }
        });
    }
    const historyList = document.getElementById('historyList');
    function renderHistory(items) {
        if (!historyList)
            return;
        historyList.innerHTML = items.map(({ tag, files }) => {
            return `<li><strong>${tag}</strong> – ${files.join(', ')}</li>`;
        }).join('');
    }
    function addHistoryItem(_item) {
        refreshHistory();
    }
    async function refreshHistory() {
        const res = await window.api.listHistory();
        if (res?.ok)
            renderHistory(res.items || []);
    }
    document.getElementById('btnRefreshHistory')?.addEventListener('click', refreshHistory);
    document.getElementById('btnOpenOutDir')?.addEventListener('click', async () => {
        await window.api.openOutDir();
    });
    refreshHistory();
    const tbody = document.querySelector('#resultsTable tbody');
    let allRows = [];
    let page = 1;
    let pageSize = 20;
    function applyFilters() {
        const q = (document.getElementById('quick_search')?.value || '').toLowerCase();
        const status = document.getElementById('filter_status')?.value || '';
        return allRows.filter((r) => {
            const okStatus = !status || String(r.status) === status;
            const blob = `${r.id} ${r.status} ${r.amount} ${r.date} ${r.method}`.toLowerCase();
            const okQ = !q || blob.includes(q);
            return okStatus && okQ;
        });
    }
    function renderStatusBadge(status) {
        const st = String(status || '').toLowerCase();
        let cls = 'px-2 py-0.5 rounded text-xs border ';
        if (st === 'approved')
            cls += 'bg-emerald-700/30 text-emerald-300 border-emerald-600';
        else if (st === 'refunded' || st === 'cancelled' || st === 'charged_back')
            cls += 'bg-rose-700/30 text-rose-300 border-rose-600';
        else if (st === 'in_process' || st === 'pending')
            cls += 'bg-amber-700/30 text-amber-300 border-amber-600';
        else
            cls += 'bg-slate-700/30 text-slate-300 border-slate-600';
        return `<span class="${cls}">${status ?? ''}</span>`;
    }
    function renderRows() {
        const filtered = applyFilters();
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
        if (page > totalPages)
            page = totalPages;
        const start = (page - 1) * pageSize;
        const rows = filtered.slice(start, start + pageSize).map((r) => {
            const amt = (r.amount ?? '') !== '' ? Number(r.amount).toFixed(2) : '';
            return `<tr>
				<td>${r.id ?? ''}</td>
				<td>${renderStatusBadge(r.status)}</td>
				<td>${amt}</td>
				<td>${r.date ?? ''}</td>
				<td>${r.method ?? ''}</td>
			</tr>`;
        }).join('');
        tbody.innerHTML = rows;
        const info = document.getElementById('pageInfo');
        if (info)
            info.textContent = `Página ${page} / ${totalPages} (${filtered.length})`;
        const sums = filtered.reduce((acc, r) => {
            const v = Number(r.amount || 0) || 0;
            const st = String(r.status || '').toLowerCase();
            if (st === 'refunded' || st === 'cancelled' || st === 'charged_back')
                acc.refunds += Math.abs(v);
            else
                acc.incomes += v;
            return acc;
        }, { incomes: 0, refunds: 0 });
        document.getElementById('summaryIncomes').textContent = sums.incomes.toFixed(2);
        document.getElementById('summaryRefunds').textContent = sums.refunds.toFixed(2);
        document.getElementById('summaryTotal').textContent = (sums.incomes - sums.refunds).toFixed(2);
    }
    document.getElementById('btnGenerateRange').addEventListener('click', async () => {
        const cfg = buildConfigFromForm();
        cfg.MP_DATE_FROM = document.getElementById('filter_from').value || cfg.MP_DATE_FROM;
        cfg.MP_DATE_TO = document.getElementById('filter_to').value || cfg.MP_DATE_TO;
        await window.api.saveConfig(cfg);
        const res = await window.api.generateReport();
        allRows = res.rows || [];
        page = 1;
        renderRows();
        if (typeof activateTabByName === 'function')
            activateTabByName('results');
        showToast(`Reporte generado (${res.count})`);
    });
    const elQuick = document.getElementById('quick_search');
    const elStatus = document.getElementById('filter_status');
    elQuick?.addEventListener('input', () => {
        page = 1;
        renderRows();
        window.api.getConfig().then((cfg) => { window.api.saveConfig({ ...(cfg || {}), LAST_FILTER_QUERY: elQuick.value }); });
    });
    elStatus?.addEventListener('change', () => {
        page = 1;
        renderRows();
        window.api.getConfig().then((cfg) => { window.api.saveConfig({ ...(cfg || {}), LAST_FILTER_STATUS: elStatus.value }); });
    });
    document.getElementById('prevPage')?.addEventListener('click', () => { if (page > 1) {
        page -= 1;
        renderRows();
    } });
    document.getElementById('nextPage')?.addEventListener('click', () => { page += 1; renderRows(); });
    const pageSizeSelect = document.getElementById('pageSize');
    pageSizeSelect?.addEventListener('change', () => {
        const val = Number(pageSizeSelect.value || 20);
        pageSize = Number.isFinite(val) && val > 0 ? val : 20;
        page = 1;
        renderRows();
        window.api.getConfig().then((cfg) => {
            window.api.saveConfig({ ...(cfg || {}), PAGE_SIZE: pageSize });
        });
    });
    const elFrom = document.getElementById('filter_from');
    const elTo = document.getElementById('filter_to');
    elFrom?.addEventListener('change', () => {
        window.api.getConfig().then((cfg) => { window.api.saveConfig({ ...(cfg || {}), LAST_FILTER_FROM: elFrom.value }); });
    });
    elTo?.addEventListener('change', () => {
        window.api.getConfig().then((cfg) => { window.api.saveConfig({ ...(cfg || {}), LAST_FILTER_TO: elTo.value }); });
    });
    document.getElementById('btnResetFilters')?.addEventListener('click', async () => {
        const cfg = await window.api.getConfig();
        await window.api.saveConfig({ ...(cfg || {}), LAST_FILTER_STATUS: '', LAST_FILTER_QUERY: '', LAST_FILTER_FROM: '', LAST_FILTER_TO: '' });
        if (elStatus)
            elStatus.value = '';
        if (elQuick)
            elQuick.value = '';
        if (elFrom)
            elFrom.value = '';
        if (elTo)
            elTo.value = '';
        page = 1;
        renderRows();
        showToast('Filtros restablecidos');
    });
    document.getElementById('btnExportCSV').addEventListener('click', async () => {
        const { outDir } = await window.api.exportReport();
        showToast(`CSV listo en ${outDir}`);
    });
    document.getElementById('btnExportXLSX').addEventListener('click', async () => {
        const { outDir } = await window.api.exportReport();
        showToast(`XLSX listo en ${outDir}`);
    });
    document.getElementById('btnExportDBF').addEventListener('click', async () => {
        const { outDir } = await window.api.exportReport();
        showToast(`DBF listo en ${outDir}`);
    });
    document.getElementById('btnExportJSON').addEventListener('click', async () => {
        const { outDir } = await window.api.exportReport();
        showToast(`JSON listo en ${outDir}`);
    });
    document.getElementById('btnSendEmail').addEventListener('click', async () => {
        const { sent } = await window.api.sendReportEmail();
        showToast(sent ? 'Email enviado' : 'No se pudo enviar email');
    });
    document.getElementById('btnAutoStart')?.addEventListener('click', async () => {
        const cfg = buildConfigFromForm();
        await window.api.saveConfig(cfg);
        const res = await window.api.autoStart?.();
        const status = document.getElementById('autoStatus');
        if (status)
            status.textContent = res?.ok ? 'Automatización: ON' : `Error: ${res?.error || ''}`;
    });
    document.getElementById('btnAutoStop')?.addEventListener('click', async () => {
        const res = await window.api.autoStop?.();
        const status = document.getElementById('autoStatus');
        if (status)
            status.textContent = res?.ok ? 'Automatización: OFF' : `Error: ${res?.error || ''}`;
    });
    // Mostrar estado al cargar
    window.api.autoStatus?.().then((s) => {
        const status = document.getElementById('autoStatus');
        if (status)
            status.textContent = s?.active ? 'Automatización: ON' : 'Automatización: OFF';
    }).catch(() => { });
});
