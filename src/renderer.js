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
	});

	document.getElementById('btnSave').addEventListener('click', async () => {
		const cfg = buildConfigFromForm();
		await window.api.saveConfig(cfg);
		renderPreview(cfg);
	});

	document.getElementById('btnGenerate').addEventListener('click', async () => {
		const res = await window.api.generateReport();
		const msg = `Generado OK. Transacciones: ${res.count}. Carpeta: ${res.outDir}`;
		alert(msg);
	});

	// Autocarga inicial
	window.api.getConfig().then((cfg) => {
		setFormFromConfig(cfg);
		renderPreview(cfg || {});
	});

	// Resultados
	const tbody = document.querySelector('#resultsTable tbody');
	function renderRows(payments) {
		const rows = payments.map((p) => {
			const id = p?.id ?? '';
			const status = p?.status ?? '';
			const amount = p?.transaction_amount ?? '';
			const date = p?.date_created ?? '';
			const method = p?.payment_method_id ?? '';
			return `<tr><td>${id}</td><td>${status}</td><td>${amount}</td><td>${date}</td><td>${method}</td></tr>`;
		}).join('');
		tbody.innerHTML = rows;
	}

	document.getElementById('btnGenerateRange').addEventListener('click', async () => {
		// Guardar temporalmente filtros en config y disparar generación (reutiliza servicio)
		const cfg = buildConfigFromForm();
		cfg.MP_DATE_FROM = document.getElementById('filter_from').value || cfg.MP_DATE_FROM;
		cfg.MP_DATE_TO = document.getElementById('filter_to').value || cfg.MP_DATE_TO;
		await window.api.saveConfig(cfg);
		const res = await window.api.generateReport();
		alert(`Generado. Transacciones: ${res.count}. Carpeta: ${res.outDir}`);
		// No tenemos los payments crudos por IPC; para la tabla, pedir export directory
		// y leer no es posible desde renderer sin exponer FS. Mostrar mensaje.
	});

	document.getElementById('btnExportCSV').addEventListener('click', async () => {
		const { outDir } = await window.api.exportReport();
		alert(`CSV en: ${outDir}`);
	});
	document.getElementById('btnExportXLSX').addEventListener('click', async () => {
		const { outDir } = await window.api.exportReport();
		alert(`XLSX en: ${outDir}`);
	});
	document.getElementById('btnExportDBF').addEventListener('click', async () => {
		const { outDir } = await window.api.exportReport();
		alert(`DBF en: ${outDir}`);
	});
	document.getElementById('btnExportJSON').addEventListener('click', async () => {
		const { outDir } = await window.api.exportReport();
		alert(`JSON en: ${outDir}`);
	});
	
	document.getElementById('btnSendEmail').addEventListener('click', async () => {
		const { sent, files } = await window.api.sendReportEmail();
		alert(sent ? `Email enviado: ${files.join(', ')}` : 'No se pudo enviar email (revisar SMTP/EMAIL_REPORT)');
	});
});


