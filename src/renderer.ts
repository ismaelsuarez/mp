window.addEventListener('DOMContentLoaded', () => {
	const tabs = Array.from(document.querySelectorAll('.tab')) as HTMLElement[];
	const panes = Array.from(document.querySelectorAll('.tab-pane')) as HTMLElement[];

	function activateTabByName(name: string) {
		for (const x of tabs) x.classList.toggle('active', (x as any).dataset.tab === name);
		for (const p of panes) p.classList.toggle('active', (p as any).id === `tab-${name}`);
	}

	for (const t of tabs) {
		t.addEventListener('click', async () => {
			activateTabByName((t as any).dataset.tab);
			try {
				const cfg = await window.api.getConfig();
				await window.api.saveConfig({ ...(cfg || {}), LAST_ACTIVE_TAB: (t as any).dataset.tab });
			} catch {}
		});
	}

	const ids = [
		'MP_ACCESS_TOKEN','MP_USER_ID','MP_TZ','MP_WINDOW_START','MP_WINDOW_END','MP_DATE_FROM','MP_DATE_TO',
		'MP_NO_DATE_FILTER','MP_RANGE','MP_STATUS','MP_LIMIT','MP_MAX_PAGES','EMAIL_REPORT','SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS',
		'FTP_IP','FTP_PORT','FTP_SECURE','FTP_USER','FTP_PASS','FTP_DIR','FTP_FILE',
		'AUTO_INTERVAL_SECONDS'
	];
	const el: any = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
	const preview = document.getElementById('preview') as HTMLElement;

	function enhanceUI() {
		for (const b of Array.from(document.querySelectorAll('button'))) {
			(b as any).classList.add('px-3','py-2','rounded-md','text-sm','font-medium','border','border-slate-600','hover:bg-slate-800','focus:outline-none','focus:ring-2','focus:ring-blue-500');
		}
		const primary = ['btnGenerate','btnGenerateRange'];
		for (const id of primary) document.getElementById(id)?.classList.add('bg-blue-600','text-white','hover:bg-blue-500','border-transparent');
		document.getElementById('btnSave')?.classList.add('bg-emerald-600','text-white','hover:bg-emerald-500','border-transparent');
		document.getElementById('btnSendEmail')?.classList.add('bg-emerald-600','text-white','hover:bg-emerald-500','border-transparent');

		for (const i of Array.from(document.querySelectorAll('input, select'))) {
			(i as any).classList.add('bg-slate-800','border','border-slate-600','rounded-md','px-3','py-2','text-sm','text-slate-100','placeholder-slate-400','focus:outline-none','focus:ring-2','focus:ring-blue-500');
		}

		for (const r of Array.from(document.querySelectorAll('.row'))) {
			(r as any).classList.add('flex','flex-wrap','items-center','gap-2');
		}

		const table = document.getElementById('resultsTable') as HTMLElement | null;
		if (table) {
			table.classList.add('table-auto','w-full','divide-y','divide-slate-700');
			const thead = table.querySelector('thead');
			if (thead) (thead as any).classList.add('bg-slate-800');
			for (const th of Array.from(table.querySelectorAll('th'))) (th as any).classList.add('px-2','py-2','text-left');
			for (const td of Array.from(table.querySelectorAll('td'))) (td as any).classList.add('px-2','py-2');
		}
	}

	function showToast(message: string) {
		const toast = document.getElementById('toast');
		if (!toast) return;
		toast.textContent = message;
		toast.classList.remove('hidden');
		setTimeout(() => toast.classList.add('hidden'), 3000);
	}

	async function applyTheme(theme: 'light' | 'dark') {
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
			MP_ACCESS_TOKEN: (el.MP_ACCESS_TOKEN as HTMLInputElement).value || undefined,
			MP_USER_ID: (el.MP_USER_ID as HTMLInputElement).value || undefined,
			MP_TZ: (el.MP_TZ as HTMLInputElement).value || undefined,
			MP_WINDOW_START: (el.MP_WINDOW_START as HTMLInputElement).value || undefined,
			MP_WINDOW_END: (el.MP_WINDOW_END as HTMLInputElement).value || undefined,
			MP_DATE_FROM: (el.MP_DATE_FROM as HTMLInputElement).value || undefined,
			MP_DATE_TO: (el.MP_DATE_TO as HTMLInputElement).value || undefined,
			MP_NO_DATE_FILTER: (el.MP_NO_DATE_FILTER as HTMLInputElement).checked || false,
			MP_RANGE: (el.MP_RANGE as HTMLInputElement).value || undefined,
			MP_STATUS: (el.MP_STATUS as HTMLInputElement).value || undefined,
			MP_LIMIT: (el.MP_LIMIT as HTMLInputElement).value ? Number((el.MP_LIMIT as HTMLInputElement).value) : undefined,
			MP_MAX_PAGES: (el.MP_MAX_PAGES as HTMLInputElement).value ? Number((el.MP_MAX_PAGES as HTMLInputElement).value) : undefined,
			EMAIL_REPORT: (el.EMAIL_REPORT as HTMLInputElement).value || undefined,
			SMTP_HOST: (el.SMTP_HOST as HTMLInputElement).value || undefined,
			SMTP_PORT: (el.SMTP_PORT as HTMLInputElement).value ? Number((el.SMTP_PORT as HTMLInputElement).value) : undefined,
			SMTP_USER: (el.SMTP_USER as HTMLInputElement).value || undefined,
			SMTP_PASS: (el.SMTP_PASS as HTMLInputElement).value || undefined,
			FTP_IP: (el.FTP_IP as HTMLInputElement)?.value || undefined,
			FTP_PORT: (el.FTP_PORT as HTMLInputElement)?.value ? Number((el.FTP_PORT as HTMLInputElement).value) : undefined,
			FTP_SECURE: (el.FTP_SECURE as HTMLInputElement)?.checked || false,
			FTP_USER: (el.FTP_USER as HTMLInputElement)?.value || undefined,
			FTP_PASS: (el.FTP_PASS as HTMLInputElement)?.value || undefined,
			FTP_DIR: (el.FTP_DIR as HTMLInputElement)?.value || undefined,
			FTP_FILE: (el.FTP_FILE as HTMLInputElement)?.value || undefined,
			AUTO_INTERVAL_SECONDS: (el.AUTO_INTERVAL_SECONDS as HTMLInputElement)?.value ? Number((el.AUTO_INTERVAL_SECONDS as HTMLInputElement).value) : undefined,
			DEFAULT_VIEW: 'caja'
		};
	}

	function setFormFromConfig(cfg: any) {
		if (!cfg) return;
		(el.MP_ACCESS_TOKEN as HTMLInputElement).value = cfg.MP_ACCESS_TOKEN || '';
		(el.MP_USER_ID as HTMLInputElement).value = cfg.MP_USER_ID || '';
		(el.MP_TZ as HTMLInputElement).value = cfg.MP_TZ || '';
		(el.MP_WINDOW_START as HTMLInputElement).value = cfg.MP_WINDOW_START || '';
		(el.MP_WINDOW_END as HTMLInputElement).value = cfg.MP_WINDOW_END || '';
		(el.MP_DATE_FROM as HTMLInputElement).value = cfg.MP_DATE_FROM || '';
		(el.MP_DATE_TO as HTMLInputElement).value = cfg.MP_DATE_TO || '';
		(el.MP_NO_DATE_FILTER as HTMLInputElement).checked = !!cfg.MP_NO_DATE_FILTER;
		(el.MP_RANGE as HTMLInputElement).value = cfg.MP_RANGE || '';
		(el.MP_STATUS as HTMLInputElement).value = cfg.MP_STATUS || '';
		(el.MP_LIMIT as HTMLInputElement).value = cfg.MP_LIMIT || '';
		(el.MP_MAX_PAGES as HTMLInputElement).value = cfg.MP_MAX_PAGES || '';
		(el.EMAIL_REPORT as HTMLInputElement).value = cfg.EMAIL_REPORT || '';
		(el.SMTP_HOST as HTMLInputElement).value = cfg.SMTP_HOST || '';
		(el.SMTP_PORT as HTMLInputElement).value = cfg.SMTP_PORT || '';
		(el.SMTP_USER as HTMLInputElement).value = cfg.SMTP_USER || '';
		(el.SMTP_PASS as HTMLInputElement).value = cfg.SMTP_PASS || '';
		(el.FTP_IP as HTMLInputElement).value = cfg.FTP_IP || '';
		(el.FTP_PORT as HTMLInputElement).value = cfg.FTP_PORT || '';
		(el.FTP_SECURE as HTMLInputElement).checked = !!cfg.FTP_SECURE;
		(el.FTP_USER as HTMLInputElement).value = cfg.FTP_USER || '';
		(el.FTP_PASS as HTMLInputElement).value = cfg.FTP_PASS || '';
		(el.FTP_DIR as HTMLInputElement).value = cfg.FTP_DIR || '';
		(el.FTP_FILE as HTMLInputElement).value = cfg.FTP_FILE || '';
		(el.AUTO_INTERVAL_SECONDS as HTMLInputElement).value = cfg.AUTO_INTERVAL_SECONDS || '';
	}

	function renderPreview(cfg: any) {
		const safe = { ...cfg } as any;
		if (safe.MP_ACCESS_TOKEN) safe.MP_ACCESS_TOKEN = '********';
		if (safe.SMTP_PASS) safe.SMTP_PASS = '********';
		preview.textContent = JSON.stringify(safe, null, 2);
	}

	document.getElementById('btnLoad')!.addEventListener('click', async () => {
		const cfg = await window.api.getConfig();
		setFormFromConfig(cfg);
		renderPreview(cfg);
		showToast('Configuración cargada');
	});

	document.getElementById('btnSave')!.addEventListener('click', async () => {
		const cfg = buildConfigFromForm();
		await window.api.saveConfig(cfg);
		renderPreview(cfg);
		showToast('Configuración guardada');
	});

	document.getElementById('btnGenerate')!.addEventListener('click', async () => {
		const res = await window.api.generateReport();
		allRows = res.rows || [];
		page = 1;
		renderRows();
		if (typeof activateTabByName === 'function') activateTabByName('results');
		showToast(`Reporte generado (${res.count})`);
	});

	document.getElementById('btnTestFtp')?.addEventListener('click', async () => {
		const status = document.getElementById('ftpTestStatus') as HTMLElement | null;
		if (status) status.textContent = 'Probando FTP...';
		try {
			const res = await (window.api as any).testFtpConnection?.();
			if (res?.ok) { if (status) status.textContent = 'FTP OK'; (status as any).style.color = '#10b981'; }
			else { if (status) { status.textContent = `Error: ${res?.error || 'ver configuración'}`; (status as any).style.color = '#ef4444'; } }
		} catch (e: any) {
			if (status) { status.textContent = `Error: ${e?.message || e}`; (status as any).style.color = '#ef4444'; }
		}
	});

	document.getElementById('btnSendDbfFtp')?.addEventListener('click', async () => {
		try {
			const res = await (window.api as any).sendDbfViaFtp?.();
			showToast(res?.ok ? 'DBF enviado por FTP' : `Error FTP: ${res?.error || ''}`);
		} catch (e: any) {
			showToast(`Error FTP: ${e?.message || e}`);
		}
	});

	window.api.getConfig().then((cfg) => {
		setFormFromConfig(cfg);
		renderPreview(cfg || {});
		if (cfg && (cfg as any).THEME) applyTheme((cfg as any).THEME);
		enhanceUI();
		if (cfg && (cfg as any).LAST_ACTIVE_TAB) activateTabByName((cfg as any).LAST_ACTIVE_TAB);
		const sel = document.getElementById('pageSize') as HTMLSelectElement | null;
		if (cfg && (cfg as any).PAGE_SIZE) {
			const n = Number((cfg as any).PAGE_SIZE);
			if (Number.isFinite(n) && n > 0) {
				pageSize = n;
				if (sel) sel.value = String(n);
			}
		}
		const fStatus = document.getElementById('filter_status') as HTMLSelectElement | null;
		const fQuery = document.getElementById('quick_search') as HTMLInputElement | null;
		const fFrom = document.getElementById('filter_from') as HTMLInputElement | null;
		const fTo = document.getElementById('filter_to') as HTMLInputElement | null;
		if (cfg && fStatus) fStatus.value = (cfg as any).LAST_FILTER_STATUS || '';
		if (cfg && fQuery) fQuery.value = (cfg as any).LAST_FILTER_QUERY || '';
		if (cfg && fFrom) fFrom.value = (cfg as any).LAST_FILTER_FROM || '';
		if (cfg && fTo) fTo.value = (cfg as any).LAST_FILTER_TO || '';
		renderRows();
	});

	document.getElementById('btnTest')?.addEventListener('click', async () => {
		const testStatus = document.getElementById('testStatus') as HTMLElement;
		testStatus.textContent = 'Probando...';
		const res = await window.api.testConnection();
		if (res.ok) {
			testStatus.textContent = 'OK';
			(testStatus as any).style.color = '#10b981';
		} else {
			testStatus.textContent = `Error: ${res.error || 'ver credenciales'}`;
			(testStatus as any).style.color = '#ef4444';
		}
	});

	document.getElementById('toggleTheme')?.addEventListener('click', async () => {
		const cfg = await window.api.getConfig();
		const next = (cfg as any).THEME === 'light' ? 'dark' : 'light';
		applyTheme(next as any);
		showToast(`Tema: ${next}`);
	});
	document.getElementById('toggleThemeMobile')?.addEventListener('click', async () => {
		const cfg = await window.api.getConfig();
		const next = (cfg as any).THEME === 'light' ? 'dark' : 'light';
		applyTheme(next as any);
		showToast(`Tema: ${next}`);
	});

	if (window.api.onAutoNotice) {
		window.api.onAutoNotice((payload) => {
			if ((payload as any)?.error) {
				showToast(`Auto-reporte error: ${(payload as any).error}`);
			} else {
				showToast(`Auto-reporte generado (${(payload as any)?.count ?? 0})`);
				addHistoryItem({ tag: new Date().toISOString().slice(0,10), files: [] } as any);
			}
		});
	}

	const historyList = document.getElementById('historyList');
	function renderHistory(items: Array<{ tag: string; files: string[] }>) {
		if (!historyList) return;
		(historyList as any).innerHTML = items.map(({ tag, files }) => {
			return `<li><strong>${tag}</strong> – ${files.join(', ')}</li>`;
		}).join('');
	}
	function addHistoryItem(_item: any) {
		refreshHistory();
	}
	async function refreshHistory() {
		const res = await window.api.listHistory();
		if ((res as any)?.ok) renderHistory((res as any).items || []);
	}
	
	document.getElementById('btnRefreshHistory')?.addEventListener('click', refreshHistory);
	document.getElementById('btnOpenOutDir')?.addEventListener('click', async () => {
		await window.api.openOutDir();
	});

	refreshHistory();

	const tbody = document.querySelector('#resultsTable tbody') as HTMLElement;
	let allRows: any[] = [];
	let page = 1;
	let pageSize = 20;
	function applyFilters() {
		const q = ((document.getElementById('quick_search') as HTMLInputElement)?.value || '').toLowerCase();
		const status = (document.getElementById('filter_status') as HTMLSelectElement)?.value || '';
		return allRows.filter((r) => {
			const okStatus = !status || String(r.status) === status;
			const blob = `${r.id} ${r.status} ${r.amount} ${r.date} ${r.method}`.toLowerCase();
			const okQ = !q || blob.includes(q);
			return okStatus && okQ;
		});
	}

	function renderStatusBadge(status: string) {
		const st = String(status || '').toLowerCase();
		let cls = 'px-2 py-0.5 rounded text-xs border ';
		if (st === 'approved') cls += 'bg-emerald-700/30 text-emerald-300 border-emerald-600';
		else if (st === 'refunded' || st === 'cancelled' || st === 'charged_back') cls += 'bg-rose-700/30 text-rose-300 border-rose-600';
		else if (st === 'in_process' || st === 'pending') cls += 'bg-amber-700/30 text-amber-300 border-amber-600';
		else cls += 'bg-slate-700/30 text-slate-300 border-slate-600';
		return `<span class="${cls}">${status ?? ''}</span>`;
	}
	function renderRows() {
		const filtered = applyFilters();
		const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
		if (page > totalPages) page = totalPages;
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
		const info = document.getElementById('pageInfo') as HTMLElement | null;
		if (info) info.textContent = `Página ${page} / ${totalPages} (${filtered.length})`;

		const sums = filtered.reduce((acc: any, r: any) => {
			const v = Number(r.amount || 0) || 0;
			const st = String(r.status || '').toLowerCase();
			if (st === 'refunded' || st === 'cancelled' || st === 'charged_back') acc.refunds += Math.abs(v); else acc.incomes += v;
			return acc;
		}, { incomes: 0, refunds: 0 });
		(document.getElementById('summaryIncomes') as HTMLElement).textContent = sums.incomes.toFixed(2);
		(document.getElementById('summaryRefunds') as HTMLElement).textContent = sums.refunds.toFixed(2);
		(document.getElementById('summaryTotal') as HTMLElement).textContent = (sums.incomes - sums.refunds).toFixed(2);
	}

	document.getElementById('btnGenerateRange')!.addEventListener('click', async () => {
		const cfg = buildConfigFromForm();
		(cfg as any).MP_DATE_FROM = (document.getElementById('filter_from') as HTMLInputElement).value || (cfg as any).MP_DATE_FROM;
		(cfg as any).MP_DATE_TO = (document.getElementById('filter_to') as HTMLInputElement).value || (cfg as any).MP_DATE_TO;
		await window.api.saveConfig(cfg);
		const res = await window.api.generateReport();
		allRows = res.rows || [];
		page = 1;
		renderRows();
		if (typeof activateTabByName === 'function') activateTabByName('results');
		showToast(`Reporte generado (${res.count})`);
	});

	const elQuick = document.getElementById('quick_search') as HTMLInputElement | null;
	const elStatus = document.getElementById('filter_status') as HTMLSelectElement | null;
	elQuick?.addEventListener('input', () => { 
		page = 1; renderRows(); 
		window.api.getConfig().then((cfg) => { window.api.saveConfig({ ...(cfg||{}), LAST_FILTER_QUERY: elQuick.value }); });
	});
	elStatus?.addEventListener('change', () => { 
		page = 1; renderRows(); 
		window.api.getConfig().then((cfg) => { window.api.saveConfig({ ...(cfg||{}), LAST_FILTER_STATUS: elStatus.value }); });
	});
	document.getElementById('prevPage')?.addEventListener('click', () => { if (page > 1) { page -= 1; renderRows(); } });
	document.getElementById('nextPage')?.addEventListener('click', () => { page += 1; renderRows(); });
	const pageSizeSelect = document.getElementById('pageSize') as HTMLSelectElement | null;
	pageSizeSelect?.addEventListener('change', () => {
		const val = Number((pageSizeSelect as any).value || 20);
		pageSize = Number.isFinite(val) && val > 0 ? val : 20;
		page = 1;
		renderRows();
		window.api.getConfig().then((cfg) => {
			window.api.saveConfig({ ...(cfg || {}), PAGE_SIZE: pageSize });
		});
	});

	const elFrom = document.getElementById('filter_from') as HTMLInputElement | null;
	const elTo = document.getElementById('filter_to') as HTMLInputElement | null;
	elFrom?.addEventListener('change', () => {
		window.api.getConfig().then((cfg)=>{ window.api.saveConfig({ ...(cfg||{}), LAST_FILTER_FROM: elFrom.value }); });
	});
	elTo?.addEventListener('change', () => {
		window.api.getConfig().then((cfg)=>{ window.api.saveConfig({ ...(cfg||{}), LAST_FILTER_TO: elTo.value }); });
	});

	document.getElementById('btnResetFilters')?.addEventListener('click', async () => {
		const cfg = await window.api.getConfig();
		await window.api.saveConfig({ ...(cfg||{}), LAST_FILTER_STATUS: '', LAST_FILTER_QUERY: '', LAST_FILTER_FROM: '', LAST_FILTER_TO: '' });
		if (elStatus) elStatus.value = '';
		if (elQuick) elQuick.value = '';
		if (elFrom) elFrom.value = '';
		if (elTo) elTo.value = '';
		page = 1;
		renderRows();
		showToast('Filtros restablecidos');
	});

	document.getElementById('btnExportCSV')!.addEventListener('click', async () => {
		const { outDir } = await window.api.exportReport();
		showToast(`CSV listo en ${outDir}`);
	});
	document.getElementById('btnExportXLSX')!.addEventListener('click', async () => {
		const { outDir } = await window.api.exportReport();
		showToast(`XLSX listo en ${outDir}`);
	});
	document.getElementById('btnExportDBF')!.addEventListener('click', async () => {
		const { outDir } = await window.api.exportReport();
		showToast(`DBF listo en ${outDir}`);
	});
	document.getElementById('btnExportJSON')!.addEventListener('click', async () => {
		const { outDir } = await window.api.exportReport();
		showToast(`JSON listo en ${outDir}`);
	});
	
	document.getElementById('btnSendEmail')!.addEventListener('click', async () => {
		const { sent } = await window.api.sendReportEmail();
		showToast(sent ? 'Email enviado' : 'No se pudo enviar email');
	});

	document.getElementById('btnAutoStart')?.addEventListener('click', async () => {
		const cfg = buildConfigFromForm();
		await window.api.saveConfig(cfg);
		const res = await (window.api as any).autoStart?.();
		const status = document.getElementById('autoStatus') as HTMLElement | null;
		if (status) status.textContent = res?.ok ? 'Automatización: ON' : `Error: ${res?.error || ''}`;
	});

	document.getElementById('btnAutoStop')?.addEventListener('click', async () => {
		const res = await (window.api as any).autoStop?.();
		const status = document.getElementById('autoStatus') as HTMLElement | null;
		if (status) status.textContent = res?.ok ? 'Automatización: OFF' : `Error: ${res?.error || ''}`;
	});

	// Mostrar estado al cargar
	(window.api as any).autoStatus?.().then((s: any) => {
		const status = document.getElementById('autoStatus') as HTMLElement | null;
		if (status) status.textContent = s?.active ? 'Automatización: ON' : 'Automatización: OFF';
	}).catch(()=>{});
});
