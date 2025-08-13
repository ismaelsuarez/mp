window.addEventListener('DOMContentLoaded', () => {
	const tabs = Array.from(document.querySelectorAll('.tab'));
	const panes = Array.from(document.querySelectorAll('.tab-pane'));
	for (const t of tabs) {
		t.addEventListener('click', () => {
			for (const x of tabs) x.classList.toggle('active', x === t);
			for (const p of panes) p.classList.toggle('active', p.id === `tab-${t.dataset.tab}`);
		});
	}

	const ids = [
		'MP_ACCESS_TOKEN','MP_USER_ID','MP_TZ','MP_WINDOW_START','MP_WINDOW_END','MP_DATE_FROM','MP_DATE_TO',
		'MP_NO_DATE_FILTER','MP_RANGE','MP_STATUS','MP_LIMIT','MP_MAX_PAGES','EMAIL_REPORT','SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS',
		'AUTO_TIMES','AUTO_ENABLED'
	];
	const el = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
	const preview = document.getElementById('preview');

	// Toast helper
	function showToast(message) {
		const toast = document.getElementById('toast');
		if (!toast) return;
		toast.textContent = message;
		toast.classList.remove('hidden');
		setTimeout(() => toast.classList.add('hidden'), 3000);
	}

	// Theme helper (persist in config)
	async function applyTheme(theme) {
		const body = document.body;
		if (theme === 'light') {
			body.classList.remove('bg-slate-900', 'text-slate-200');
			body.classList.add('bg-slate-50', 'text-slate-900');
		} else {
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
			AUTO_TIMES: el.AUTO_TIMES.value || undefined,
			AUTO_ENABLED: el.AUTO_ENABLED.checked || false
		};
	}

	function setFormFromConfig(cfg) {
		if (!cfg) return;
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
		el.AUTO_TIMES.value = cfg.AUTO_TIMES || '';
		el.AUTO_ENABLED.checked = !!cfg.AUTO_ENABLED;
	}

	function renderPreview(cfg) {
		const safe = { ...cfg };
		if (safe.MP_ACCESS_TOKEN) safe.MP_ACCESS_TOKEN = '********';
		if (safe.SMTP_PASS) safe.SMTP_PASS = '********';
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
		showToast(`Reporte generado (${res.count})`);
	});

	// Autocarga inicial
	window.api.getConfig().then((cfg) => {
		setFormFromConfig(cfg);
		renderPreview(cfg || {});
		if (cfg && cfg.THEME) applyTheme(cfg.THEME);
	});

	// Probar conexión
	document.getElementById('btnTest')?.addEventListener('click', async () => {
		const testStatus = document.getElementById('testStatus');
		testStatus.textContent = 'Probando...';
		const res = await window.api.testConnection();
		if (res.ok) {
			testStatus.textContent = 'OK';
			testStatus.style.color = '#10b981';
		} else {
			testStatus.textContent = `Error: ${res.error || 'ver credenciales'}`;
			testStatus.style.color = '#ef4444';
		}
	});

	// Theme toggles
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

	// Resultados
	const tbody = document.querySelector('#resultsTable tbody');
	let allRows = [];
	let page = 1;
	const pageSize = 20;
	function applyFilters() {
		const q = (document.getElementById('quick_search')?.value || '').toLowerCase();
		const status = document.getElementById('filter_status')?.value || '';
		return allRows.filter(r => {
			const okStatus = !status || String(r.status) === status;
			const blob = `${r.id} ${r.status} ${r.amount} ${r.date} ${r.method}`.toLowerCase();
			const okQ = !q || blob.includes(q);
			return okStatus && okQ;
		});
	}
	function renderRows() {
		const filtered = applyFilters();
		const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
		if (page > totalPages) page = totalPages;
		const start = (page - 1) * pageSize;
		const rows = filtered.slice(start, start + pageSize).map((r) => {
			return `<tr><td>${r.id ?? ''}</td><td>${r.status ?? ''}</td><td>${r.amount ?? ''}</td><td>${r.date ?? ''}</td><td>${r.method ?? ''}</td></tr>`;
		}).join('');
		tbody.innerHTML = rows;
		const info = document.getElementById('pageInfo');
		if (info) info.textContent = `Página ${page} / ${totalPages} (${filtered.length})`;
	}

	document.getElementById('btnGenerateRange').addEventListener('click', async () => {
		// Guardar temporalmente filtros en config y disparar generación (reutiliza servicio)
		const cfg = buildConfigFromForm();
		cfg.MP_DATE_FROM = document.getElementById('filter_from').value || cfg.MP_DATE_FROM;
		cfg.MP_DATE_TO = document.getElementById('filter_to').value || cfg.MP_DATE_TO;
		await window.api.saveConfig(cfg);
		const res = await window.api.generateReport();
		allRows = res.rows || [];
		page = 1;
		renderRows();
		showToast(`Reporte generado (${res.count})`);
	});

	document.getElementById('quick_search')?.addEventListener('input', () => { page = 1; renderRows(); });
	document.getElementById('filter_status')?.addEventListener('change', () => { page = 1; renderRows(); });
	document.getElementById('prevPage')?.addEventListener('click', () => { if (page > 1) { page -= 1; renderRows(); } });
	document.getElementById('nextPage')?.addEventListener('click', () => { page += 1; renderRows(); });

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
});


