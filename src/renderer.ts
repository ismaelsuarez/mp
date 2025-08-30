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
        'MP_ACCESS_TOKEN','MP_USER_ID','MP_TZ','MP_WINDOW_START','MP_WINDOW_END','MP_DATE_FROM','MP_DATE_TO','MP_DAYS_BACK',
        'MP_NO_DATE_FILTER','MP_RANGE','MP_STATUS','MP_LIMIT','MP_MAX_PAGES','EMAIL_REPORT','SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS',
		'FTP_IP','FTP_PORT','FTP_SECURE','FTP_USER','FTP_PASS','FTP_DIR','FTP_FILE',
		'AUTO_INTERVAL_SECONDS','AUTO_DAYS_MONDAY','AUTO_DAYS_TUESDAY','AUTO_DAYS_WEDNESDAY','AUTO_DAYS_THURSDAY','AUTO_DAYS_FRIDAY','AUTO_DAYS_SATURDAY','AUTO_DAYS_SUNDAY',
		'AUTO_FROM_MONDAY','AUTO_TO_MONDAY','AUTO_FROM_TUESDAY','AUTO_TO_TUESDAY','AUTO_FROM_WEDNESDAY','AUTO_TO_WEDNESDAY','AUTO_FROM_THURSDAY','AUTO_TO_THURSDAY','AUTO_FROM_FRIDAY','AUTO_TO_FRIDAY','AUTO_FROM_SATURDAY','AUTO_TO_SATURDAY','AUTO_FROM_SUNDAY','AUTO_TO_SUNDAY',
		'AUTO_REMOTE_DIR','AUTO_REMOTE_MS_INTERVAL','AUTO_REMOTE_ENABLED','IMAGE_CONTROL_DIR','IMAGE_CONTROL_FILE','IMAGE_WINDOW_SEPARATE',
		'AUTO_REMOTE_WATCH','IMAGE_WATCH',
		'IMAGE_PUBLICIDAD_ALLOWED',
		'IMAGE_PRODUCTO_NUEVO_ENABLED','IMAGE_PRODUCTO_NUEVO_WAIT_SECONDS',
		'DEFAULT_VIEW',
		// FTP Server (admin)
		'FTP_SRV_HOST','FTP_SRV_PORT','FTP_SRV_USER','FTP_SRV_PASS','FTP_SRV_ROOT','FTP_SRV_ENABLED'
		,'FTP_SRV_PASV_HOST','FTP_SRV_PASV_MIN','FTP_SRV_PASV_MAX',
		// Galicia (admin)
		'GALICIA_APP_ID','GALICIA_APP_KEY','GALICIA_CERT_PATH','GALICIA_KEY_PATH','GALICIA_ENVIRONMENT'
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
            MP_DAYS_BACK: (el.MP_DAYS_BACK as HTMLInputElement)?.value ? Number((el.MP_DAYS_BACK as HTMLInputElement).value) : undefined,
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
			AUTO_DAYS_MONDAY: (el.AUTO_DAYS_MONDAY as HTMLInputElement)?.checked || false,
			AUTO_DAYS_TUESDAY: (el.AUTO_DAYS_TUESDAY as HTMLInputElement)?.checked || false,
			AUTO_DAYS_WEDNESDAY: (el.AUTO_DAYS_WEDNESDAY as HTMLInputElement)?.checked || false,
			AUTO_DAYS_THURSDAY: (el.AUTO_DAYS_THURSDAY as HTMLInputElement)?.checked || false,
			AUTO_DAYS_FRIDAY: (el.AUTO_DAYS_FRIDAY as HTMLInputElement)?.checked || false,
			AUTO_DAYS_SATURDAY: (el.AUTO_DAYS_SATURDAY as HTMLInputElement)?.checked || false,
			AUTO_DAYS_SUNDAY: (el.AUTO_DAYS_SUNDAY as HTMLInputElement)?.checked || false,
			AUTO_FROM_MONDAY: (el.AUTO_FROM_MONDAY as HTMLInputElement)?.value || undefined,
			AUTO_TO_MONDAY: (el.AUTO_TO_MONDAY as HTMLInputElement)?.value || undefined,
			AUTO_FROM_TUESDAY: (el.AUTO_FROM_TUESDAY as HTMLInputElement)?.value || undefined,
			AUTO_TO_TUESDAY: (el.AUTO_TO_TUESDAY as HTMLInputElement)?.value || undefined,
			AUTO_FROM_WEDNESDAY: (el.AUTO_FROM_WEDNESDAY as HTMLInputElement)?.value || undefined,
			AUTO_TO_WEDNESDAY: (el.AUTO_TO_WEDNESDAY as HTMLInputElement)?.value || undefined,
			AUTO_FROM_THURSDAY: (el.AUTO_FROM_THURSDAY as HTMLInputElement)?.value || undefined,
			AUTO_TO_THURSDAY: (el.AUTO_TO_THURSDAY as HTMLInputElement)?.value || undefined,
			AUTO_FROM_FRIDAY: (el.AUTO_FROM_FRIDAY as HTMLInputElement)?.value || undefined,
			AUTO_TO_FRIDAY: (el.AUTO_TO_FRIDAY as HTMLInputElement)?.value || undefined,
			AUTO_FROM_SATURDAY: (el.AUTO_FROM_SATURDAY as HTMLInputElement)?.value || undefined,
			AUTO_TO_SATURDAY: (el.AUTO_TO_SATURDAY as HTMLInputElement)?.value || undefined,
			AUTO_FROM_SUNDAY: (el.AUTO_FROM_SUNDAY as HTMLInputElement)?.value || undefined,
			AUTO_TO_SUNDAY: (el.AUTO_TO_SUNDAY as HTMLInputElement)?.value || undefined,
			AUTO_REMOTE_DIR: (el.AUTO_REMOTE_DIR as HTMLInputElement)?.value || undefined,
			AUTO_REMOTE_MS_INTERVAL: (el.AUTO_REMOTE_MS_INTERVAL as HTMLInputElement)?.value ? Number((el.AUTO_REMOTE_MS_INTERVAL as HTMLInputElement).value) : undefined,
			AUTO_REMOTE_ENABLED: (el.AUTO_REMOTE_ENABLED as HTMLInputElement)?.checked || false,
			AUTO_REMOTE_WATCH: (el.AUTO_REMOTE_WATCH as HTMLInputElement)?.checked || false,
			IMAGE_CONTROL_DIR: (el.IMAGE_CONTROL_DIR as HTMLInputElement)?.value || undefined,
			IMAGE_CONTROL_FILE: (el.IMAGE_CONTROL_FILE as HTMLInputElement)?.value || undefined,
			IMAGE_WINDOW_SEPARATE: (el.IMAGE_WINDOW_SEPARATE as HTMLInputElement)?.checked || false,
			IMAGE_WATCH: (el.IMAGE_WATCH as HTMLInputElement)?.checked || false,
			IMAGE_PUBLICIDAD_ALLOWED: (el.IMAGE_PUBLICIDAD_ALLOWED as HTMLInputElement)?.checked || false,
			IMAGE_PRODUCTO_NUEVO_ENABLED: (el.IMAGE_PRODUCTO_NUEVO_ENABLED as HTMLInputElement)?.checked || false,
			IMAGE_PRODUCTO_NUEVO_WAIT_SECONDS: (el.IMAGE_PRODUCTO_NUEVO_WAIT_SECONDS as HTMLInputElement)?.value ? Number((el.IMAGE_PRODUCTO_NUEVO_WAIT_SECONDS as HTMLInputElement).value) : undefined,
			DEFAULT_VIEW: ((): 'config'|'caja'|'imagen' => {
				try {
					const href = String(window.location.pathname || '').toLowerCase();
					if (href.includes('imagen.html')) return 'imagen';
					if (href.includes('config.html')) return 'config';
					return 'caja';
				} catch { return 'caja'; }
			})(),
			// FTP server config (persisted)
			FTP_SRV_HOST: (el.FTP_SRV_HOST as HTMLInputElement)?.value || undefined,
			FTP_SRV_PORT: (el.FTP_SRV_PORT as HTMLInputElement)?.value ? Number((el.FTP_SRV_PORT as HTMLInputElement).value) : undefined,
			FTP_SRV_USER: (el.FTP_SRV_USER as HTMLInputElement)?.value || undefined,
			FTP_SRV_PASS: (el.FTP_SRV_PASS as HTMLInputElement)?.value || undefined,
			FTP_SRV_ROOT: (el.FTP_SRV_ROOT as HTMLInputElement)?.value || undefined,
			FTP_SRV_ENABLED: (el.FTP_SRV_ENABLED as HTMLInputElement)?.checked === true,
					FTP_SRV_PASV_HOST: (el.FTP_SRV_PASV_HOST as HTMLInputElement)?.value || undefined,
		FTP_SRV_PASV_MIN: (el.FTP_SRV_PASV_MIN as HTMLInputElement)?.value ? Number((el.FTP_SRV_PASV_MIN as HTMLInputElement).value) : undefined,
		FTP_SRV_PASV_MAX: (el.FTP_SRV_PASV_MAX as HTMLInputElement)?.value ? Number((el.FTP_SRV_PASV_MAX as HTMLInputElement).value) : undefined,
		// Galicia
		GALICIA_APP_ID: (el.GALICIA_APP_ID as HTMLInputElement)?.value || undefined,
		GALICIA_APP_KEY: (el.GALICIA_APP_KEY as HTMLInputElement)?.value || undefined,
		GALICIA_CERT_PATH: (el.GALICIA_CERT_PATH as HTMLInputElement)?.value || undefined,
		GALICIA_KEY_PATH: (el.GALICIA_KEY_PATH as HTMLInputElement)?.value || undefined,
		GALICIA_ENVIRONMENT: (el.GALICIA_ENVIRONMENT as HTMLSelectElement)?.value || 'sandbox'
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
            (el.MP_DAYS_BACK as HTMLInputElement).value = cfg.MP_DAYS_BACK || '';
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
		(el.AUTO_DAYS_MONDAY as HTMLInputElement).checked = cfg.AUTO_DAYS_MONDAY !== false; // Por defecto true
		(el.AUTO_DAYS_TUESDAY as HTMLInputElement).checked = cfg.AUTO_DAYS_TUESDAY !== false;
		(el.AUTO_DAYS_WEDNESDAY as HTMLInputElement).checked = cfg.AUTO_DAYS_WEDNESDAY !== false;
		(el.AUTO_DAYS_THURSDAY as HTMLInputElement).checked = cfg.AUTO_DAYS_THURSDAY !== false;
		(el.AUTO_DAYS_FRIDAY as HTMLInputElement).checked = cfg.AUTO_DAYS_FRIDAY !== false;
		(el.AUTO_DAYS_SATURDAY as HTMLInputElement).checked = cfg.AUTO_DAYS_SATURDAY !== false;
		(el.AUTO_DAYS_SUNDAY as HTMLInputElement).checked = cfg.AUTO_DAYS_SUNDAY !== false;
		(el.AUTO_FROM_MONDAY as HTMLInputElement).value = cfg.AUTO_FROM_MONDAY || '';
		(el.AUTO_TO_MONDAY as HTMLInputElement).value = cfg.AUTO_TO_MONDAY || '';
		(el.AUTO_FROM_TUESDAY as HTMLInputElement).value = cfg.AUTO_FROM_TUESDAY || '';
		(el.AUTO_TO_TUESDAY as HTMLInputElement).value = cfg.AUTO_TO_TUESDAY || '';
		(el.AUTO_FROM_WEDNESDAY as HTMLInputElement).value = cfg.AUTO_FROM_WEDNESDAY || '';
		(el.AUTO_TO_WEDNESDAY as HTMLInputElement).value = cfg.AUTO_TO_WEDNESDAY || '';
		(el.AUTO_FROM_THURSDAY as HTMLInputElement).value = cfg.AUTO_FROM_THURSDAY || '';
		(el.AUTO_TO_THURSDAY as HTMLInputElement).value = cfg.AUTO_TO_THURSDAY || '';
		(el.AUTO_FROM_FRIDAY as HTMLInputElement).value = cfg.AUTO_FROM_FRIDAY || '';
		(el.AUTO_TO_FRIDAY as HTMLInputElement).value = cfg.AUTO_TO_FRIDAY || '';
		(el.AUTO_FROM_SATURDAY as HTMLInputElement).value = cfg.AUTO_FROM_SATURDAY || '';
		(el.AUTO_TO_SATURDAY as HTMLInputElement).value = cfg.AUTO_TO_SATURDAY || '';
		(el.AUTO_FROM_SUNDAY as HTMLInputElement).value = cfg.AUTO_FROM_SUNDAY || '';
		(el.AUTO_TO_SUNDAY as HTMLInputElement).value = cfg.AUTO_TO_SUNDAY || '';
		(el.AUTO_REMOTE_DIR as HTMLInputElement).value = cfg.AUTO_REMOTE_DIR || 'C:\\tmp';
		(el.AUTO_REMOTE_MS_INTERVAL as HTMLInputElement).value = cfg.AUTO_REMOTE_MS_INTERVAL || '';
		(el.AUTO_REMOTE_ENABLED as HTMLInputElement).checked = cfg.AUTO_REMOTE_ENABLED !== false;
		const elRemoteWatch = document.getElementById('AUTO_REMOTE_WATCH') as HTMLInputElement | null;
		if (elRemoteWatch) elRemoteWatch.checked = cfg.AUTO_REMOTE_WATCH === true;
		(el.IMAGE_CONTROL_DIR as HTMLInputElement).value = cfg.IMAGE_CONTROL_DIR || 'C:\\tmp';
		(el.IMAGE_CONTROL_FILE as HTMLInputElement).value = cfg.IMAGE_CONTROL_FILE || 'direccion.txt';
		(el.IMAGE_WINDOW_SEPARATE as HTMLInputElement).checked = cfg.IMAGE_WINDOW_SEPARATE === true;
		const elImageWatch = document.getElementById('IMAGE_WATCH') as HTMLInputElement | null;
		if (elImageWatch) elImageWatch.checked = cfg.IMAGE_WATCH === true;
		const elPubAllowed = document.getElementById('IMAGE_PUBLICIDAD_ALLOWED') as HTMLInputElement | null;
		if (elPubAllowed) elPubAllowed.checked = cfg.IMAGE_PUBLICIDAD_ALLOWED === true;
		const elPnEnabled = document.getElementById('IMAGE_PRODUCTO_NUEVO_ENABLED') as HTMLInputElement | null;
		if (elPnEnabled) elPnEnabled.checked = cfg.IMAGE_PRODUCTO_NUEVO_ENABLED === true;
		const elPnWait = document.getElementById('IMAGE_PRODUCTO_NUEVO_WAIT_SECONDS') as HTMLInputElement | null;
		if (elPnWait) elPnWait.value = cfg.IMAGE_PRODUCTO_NUEVO_WAIT_SECONDS || '';
		// FTP Server
		const ftpHostEl = document.getElementById('FTP_SRV_HOST') as HTMLInputElement | null;
		const ftpPortEl = document.getElementById('FTP_SRV_PORT') as HTMLInputElement | null;
		const ftpUserEl = document.getElementById('FTP_SRV_USER') as HTMLInputElement | null;
		const ftpPassEl = document.getElementById('FTP_SRV_PASS') as HTMLInputElement | null;
		const ftpRootEl = document.getElementById('FTP_SRV_ROOT') as HTMLInputElement | null;
		if (ftpHostEl) ftpHostEl.value = cfg.FTP_SRV_HOST || '0.0.0.0';
		if (ftpPortEl) ftpPortEl.value = String(cfg.FTP_SRV_PORT || '2121');
		if (ftpUserEl) ftpUserEl.value = cfg.FTP_SRV_USER || '';
		if (ftpPassEl) ftpPassEl.value = cfg.FTP_SRV_PASS || '';
		if (ftpRootEl) ftpRootEl.value = cfg.FTP_SRV_ROOT || 'C\\tmp\\ftp_share';
		const ftpEnabledEl = document.getElementById('FTP_SRV_ENABLED') as HTMLInputElement | null;
		if (ftpEnabledEl) ftpEnabledEl.checked = cfg.FTP_SRV_ENABLED === true;
		const ftpPasvHostEl = document.getElementById('FTP_SRV_PASV_HOST') as HTMLInputElement | null;
		const ftpPasvMinEl = document.getElementById('FTP_SRV_PASV_MIN') as HTMLInputElement | null;
		const ftpPasvMaxEl = document.getElementById('FTP_SRV_PASV_MAX') as HTMLInputElement | null;
		if (ftpPasvHostEl) ftpPasvHostEl.value = cfg.FTP_SRV_PASV_HOST || '';
		if (ftpPasvMinEl) ftpPasvMinEl.value = String(cfg.FTP_SRV_PASV_MIN || '50000');
		if (ftpPasvMaxEl) ftpPasvMaxEl.value = String(cfg.FTP_SRV_PASV_MAX || '50100');
		
		// Galicia
		const galiciaAppIdEl = document.getElementById('GALICIA_APP_ID') as HTMLInputElement | null;
		const galiciaAppKeyEl = document.getElementById('GALICIA_APP_KEY') as HTMLInputElement | null;
		const galiciaCertPathEl = document.getElementById('GALICIA_CERT_PATH') as HTMLInputElement | null;
		const galiciaKeyPathEl = document.getElementById('GALICIA_KEY_PATH') as HTMLInputElement | null;
		const galiciaEnvironmentEl = document.getElementById('GALICIA_ENVIRONMENT') as HTMLSelectElement | null;
		
		if (galiciaAppIdEl) galiciaAppIdEl.value = cfg.GALICIA_APP_ID || '';
		if (galiciaAppKeyEl) galiciaAppKeyEl.value = cfg.GALICIA_APP_KEY || '';
		if (galiciaCertPathEl) galiciaCertPathEl.value = cfg.GALICIA_CERT_PATH || '';
		if (galiciaKeyPathEl) galiciaKeyPathEl.value = cfg.GALICIA_KEY_PATH || '';
		if (galiciaEnvironmentEl) galiciaEnvironmentEl.value = cfg.GALICIA_ENVIRONMENT || 'sandbox';
	}

	function renderPreview(cfg: any) {
		const safe = { ...cfg } as any;
		if (safe.MP_ACCESS_TOKEN) safe.MP_ACCESS_TOKEN = '********';
		if (safe.SMTP_PASS) safe.SMTP_PASS = '********';
		if (safe.GALICIA_APP_KEY) safe.GALICIA_APP_KEY = '********';
		const filterEl = document.getElementById('previewFilter') as HTMLInputElement | null;
		let obj: any = safe;
		if (filterEl && filterEl.value) {
			const q = filterEl.value.toLowerCase();
			const filtered: any = {};
			Object.keys(safe || {}).forEach((k) => {
				const val = (safe as any)[k];
				if (k.toLowerCase().includes(q) || String(val).toLowerCase().includes(q)) filtered[k] = val;
			});
			obj = filtered;
		}
		preview.textContent = JSON.stringify(obj, null, 2);
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

	document.getElementById('btnClearFtpHash')?.addEventListener('click', async () => {
		try {
			const res = await (window.api as any).clearFtpHash?.();
			showToast(res?.ok ? 'Hash FTP limpiado' : `Error: ${res?.error || ''}`);
		} catch (e: any) {
			showToast(`Error: ${e?.message || e}`);
		}
	});

	// ===== FTP: Enviar archivo arbitrario =====
	(function wireFtpSendArbitrary(){
		const btnPick = document.getElementById('btnPickLocalFile') as HTMLButtonElement | null;
		const btnSend = document.getElementById('btnSendLocalFile') as HTMLButtonElement | null;
		const inputPath = document.getElementById('FTP_SEND_FILE_PATH') as HTMLInputElement | null;
		btnPick?.addEventListener('click', async () => {
			try {
				// Usar input file dinámico para obtener ruta (en Electron no siempre devuelve path directo, pero se usa como UX)
				const picker = document.createElement('input');
				picker.type = 'file';
				picker.onchange = () => {
					const f = (picker.files && picker.files[0]) || null;
					if (f && inputPath) inputPath.value = (f as any).path || f.name;
				};
				picker.click();
			} catch {}
		});
		btnSend?.addEventListener('click', async () => {
			try {
				const p = inputPath?.value || '';
				if (!p) { showToast('Seleccione un archivo primero'); return; }
				const remoteName = undefined; // usa basename por defecto
				const res = await (window.api as any).ftpSendFile?.(p, remoteName);
				if (res?.ok) showToast(`Enviado: ${res.remoteFile}`); else showToast(`Error: ${res?.error || ''}`);
			} catch (e:any) {
				showToast(`Error: ${e?.message || e}`);
			}
		});
	})();

	// ===== MANEJO DE NOTIFICACIONES DE ERROR =====
	
	// Cargar configuración de notificaciones de error
	async function loadErrorNotificationConfig() {
		try {
			const config = await (window.api as any).getErrorNotificationConfig?.();
			if (config) {
				(document.getElementById('error-notifications-enabled') as HTMLInputElement).checked = config.enabled;
				(document.getElementById('min-errors-before-notify') as HTMLInputElement).value = config.minErrorsBeforeNotify.toString();
				(document.getElementById('min-time-between-notifications') as HTMLInputElement).value = config.minTimeBetweenNotifications.toString();
			}
		} catch (e: any) {
			console.error('Error cargando configuración de notificaciones:', e);
		}
	}

	// Actualizar resumen de errores
	async function updateErrorSummary() {
		try {
			const summary = await (window.api as any).getErrorNotificationSummary?.();
			if (summary) {
				document.getElementById('total-errors')!.textContent = summary.totalErrors.toString();
				document.getElementById('active-groups')!.textContent = summary.activeGroups.toString();
				document.getElementById('notifications-sent')!.textContent = summary.notificationsSent.toString();
			}
		} catch (e: any) {
			console.error('Error actualizando resumen de errores:', e);
		}
	}

	// Guardar configuración de notificaciones de error
	document.getElementById('btnSaveErrorNotifications')?.addEventListener('click', async () => {
		try {
			const enabled = (document.getElementById('error-notifications-enabled') as HTMLInputElement).checked;
			const minErrors = parseInt((document.getElementById('min-errors-before-notify') as HTMLInputElement).value);
			const minTime = parseInt((document.getElementById('min-time-between-notifications') as HTMLInputElement).value);

			if (isNaN(minErrors) || isNaN(minTime) || minErrors < 1 || minTime < 15) {
				showToast('Error: Valores inválidos en la configuración');
				return;
			}

			const config = {
				enabled,
				minErrorsBeforeNotify: minErrors,
				minTimeBetweenNotifications: minTime,
				maxNotificationsPerError: 3
			};

			const res = await (window.api as any).updateErrorNotificationConfig?.(config);
			if (res?.ok) {
				showToast('✅ Configuración de notificaciones guardada');
				updateErrorSummary();
			} else {
				showToast(`Error: ${res?.error || 'Error desconocido'}`);
			}
		} catch (e: any) {
			showToast(`Error: ${e?.message || e}`);
		}
	});

	// Actualizar resumen de errores
	document.getElementById('btnRefreshErrorSummary')?.addEventListener('click', async () => {
		await updateErrorSummary();
		showToast('📊 Resumen actualizado');
	});

	// Limpiar errores antiguos
	document.getElementById('btnClearOldErrors')?.addEventListener('click', async () => {
		if (confirm('¿Está seguro de que desea limpiar los errores antiguos (más de 24 horas)?')) {
			try {
				const res = await (window.api as any).clearOldErrors?.(24);
				if (res?.ok) {
					showToast('🧹 Errores antiguos limpiados');
					updateErrorSummary();
				} else {
					showToast(`Error: ${res?.error || 'Error desconocido'}`);
				}
			} catch (e: any) {
				showToast(`Error: ${e?.message || e}`);
			}
		}
	});

	// Resetear todas las notificaciones
	document.getElementById('btnResetErrorNotifications')?.addEventListener('click', async () => {
		if (confirm('¿Está seguro de que desea resetear todas las notificaciones de error? Esta acción no se puede deshacer.')) {
			try {
				const res = await (window.api as any).resetErrorNotifications?.();
				if (res?.ok) {
					showToast('🔄 Notificaciones reseteadas');
					updateErrorSummary();
				} else {
					showToast(`Error: ${res?.error || 'Error desconocido'}`);
				}
			} catch (e: any) {
				showToast(`Error: ${e?.message || e}`);
			}
		}
	});

	// Cargar configuración al iniciar
	loadErrorNotificationConfig();
	updateErrorSummary();

	window.api.getConfig().then((cfg) => {
		setFormFromConfig(cfg);
		renderPreview(cfg || {});
		applyPermsFromConfig(cfg);
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
			} else if ((payload as any)?.info) {
				showToast(String((payload as any).info));
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

	function formatLocalDateTime(isoLike: any): string {
		if (!isoLike) return '';
		try {
			const d = new Date(isoLike);
			if (isNaN(d.getTime())) return String(isoLike);
			const dd = String(d.getDate()).padStart(2, '0');
			const mm = String(d.getMonth() + 1).padStart(2, '0');
			const yyyy = d.getFullYear();
			const hh = String(d.getHours()).padStart(2, '0');
			const mi = String(d.getMinutes()).padStart(2, '0');
			return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
		} catch {
			return String(isoLike);
		}
	}
	function renderRows() {
		const filtered = applyFilters();
		const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
		if (page > totalPages) page = totalPages;
		const start = (page - 1) * pageSize;
		const rows = filtered.slice(start, start + pageSize).map((r) => {
			const amt = (r.amount ?? '') !== '' ? Number(r.amount).toFixed(2) : '';
			const when = formatLocalDateTime((r as any).date);
			return `<tr>
				<td>${r.id ?? ''}</td>
				<td>${renderStatusBadge(r.status)}</td>
				<td>${amt}</td>
				<td>${when}</td>
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

	// ===== FUNCIONALIDAD DE CAMBIO DE CONTRASEÑA =====
	
	// Función para validar contraseña
	function validatePassword(password: string): { valid: boolean; message: string } {
		if (password.length < 8) {
			return { valid: false, message: 'Mínimo 8 caracteres' };
		}
		if (!/\d/.test(password)) {
			return { valid: false, message: 'Debe contener un número' };
		}
		if (!/[A-Z]/.test(password)) {
			return { valid: false, message: 'Debe contener una mayúscula' };
		}
		return { valid: true, message: 'Contraseña válida' };
	}

	// Función para mostrar errores de forma amigable
	function showAuthError(message: string) {
		const errorMessages: { [key: string]: string } = {
			'weak_password': 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número',
			'invalid_current': 'Contraseña actual incorrecta',
			'invalid_secret': 'Frase secreta incorrecta',
			'invalid_otp': 'Código OTP inválido o expirado',
			'not_initialized': 'Sistema no inicializado',
			'no_email': 'Email no configurado para envío de códigos',
			'locked': 'Cuenta bloqueada temporalmente por múltiples intentos fallidos'
		};
		
		return errorMessages[message] || message;
	}

	// Configurar validación de contraseña en tiempo real
	const newPasswordInput = document.getElementById('new-password') as HTMLInputElement;
	if (newPasswordInput) {
		newPasswordInput.addEventListener('input', () => {
			const validation = validatePassword(newPasswordInput.value);
			newPasswordInput.style.borderColor = validation.valid ? '#10b981' : '#ef4444';
		});
	}

	// Handler para cambio de contraseña
	document.getElementById('btnChangePassword')?.addEventListener('click', async () => {
		const currentPassword = (document.getElementById('current-password') as HTMLInputElement)?.value || '';
		const newPassword = (document.getElementById('new-password') as HTMLInputElement)?.value || '';
		const confirmPassword = (document.getElementById('confirm-password') as HTMLInputElement)?.value || '';
		const newUsername = (document.getElementById('new-username') as HTMLInputElement)?.value || '';
		const newSecretPhrase = (document.getElementById('new-secret-phrase') as HTMLInputElement)?.value || '';
		
		const statusElement = document.getElementById('passwordChangeStatus') as HTMLElement;
		
		try {
			// Validaciones
			if (!currentPassword) {
				statusElement.textContent = 'Error: Debe ingresar su contraseña actual';
				statusElement.className = 'text-red-400 text-sm';
				return;
			}
			
			if (!newPassword) {
				statusElement.textContent = 'Error: Debe ingresar una nueva contraseña';
				statusElement.className = 'text-red-400 text-sm';
				return;
			}
			
			if (newPassword !== confirmPassword) {
				statusElement.textContent = 'Error: Las contraseñas no coinciden';
				statusElement.className = 'text-red-400 text-sm';
				return;
			}
			
			const validation = validatePassword(newPassword);
			if (!validation.valid) {
				statusElement.textContent = `Error: ${validation.message}`;
				statusElement.className = 'text-red-400 text-sm';
				return;
			}
			
			// Cambiar contraseña
			await (window as any).auth.change({
				current: currentPassword,
				newPw: newPassword,
				newUser: newUsername || undefined,
				newSecret: newSecretPhrase || undefined
			});
			
			// Limpiar formulario
			(document.getElementById('current-password') as HTMLInputElement).value = '';
			(document.getElementById('new-password') as HTMLInputElement).value = '';
			(document.getElementById('confirm-password') as HTMLInputElement).value = '';
			(document.getElementById('new-username') as HTMLInputElement).value = '';
			(document.getElementById('new-secret-phrase') as HTMLInputElement).value = '';
			
			statusElement.textContent = 'Contraseña cambiada exitosamente';
			statusElement.className = 'text-green-400 text-sm';
			
			showToast('Contraseña actualizada correctamente');
			
		} catch (error: any) {
			const errorMessage = showAuthError(error.message);
			statusElement.textContent = `Error: ${errorMessage}`;
			statusElement.className = 'text-red-400 text-sm';
		}
	});

	// Validar carpeta remota al cargar y al editar
	async function validateRemoteDirAndShow() {
		try {
			const dir = (document.getElementById('AUTO_REMOTE_DIR') as HTMLInputElement)?.value || 'C:\\tmp';
			const res = await (window.api as any).validateRemoteDir?.(dir);
			const status = document.getElementById('autoStatus') as HTMLElement | null;
			if (res?.ok && res.exists && res.isDir) {
				if (status) status.textContent = (status.textContent ? status.textContent + ' • ' : '') + 'Remoto: OK';
				showToast('Carpeta remota: OK');
			} else {
				if (status) status.textContent = (status.textContent ? status.textContent + ' • ' : '') + 'Remoto: No encontrada';
				showToast('Advertencia: Carpeta remota no existe');
			}
		} catch {}
	}

	(document.getElementById('AUTO_REMOTE_DIR') as HTMLInputElement | null)?.addEventListener('change', () => {
		validateRemoteDirAndShow();
	});

	document.getElementById('btnTestRemote')?.addEventListener('click', async () => {
		try {
			const dir = (document.getElementById('AUTO_REMOTE_DIR') as HTMLInputElement)?.value || 'C:\\tmp';
			const val = await (window.api as any).validateRemoteDir?.(dir);
			if (!val?.ok || !val.exists || !val.isDir) {
				showToast('Error: Carpeta remota no válida');
				return;
			}
			const res = await (window.api as any).runRemoteOnce?.();
			const n = Number(res?.processed || 0);
			const status = document.getElementById('autoStatus') as HTMLElement | null;
			if (n > 0) {
				showToast(`Remoto ejecutado: ${n} archivo(s) procesado(s)`);
				if (status) status.textContent = (status.textContent ? status.textContent + ' • ' : '') + `Remoto procesó ${n}`;
			} else {
				showToast('Remoto: sin archivos para procesar');
				if (status) status.textContent = (status.textContent ? status.textContent + ' • ' : '') + 'Remoto sin archivos';
			}
		} catch (e: any) {
			showToast(`Error remoto: ${String(e?.message || e)}`);
		}
	});

	document.getElementById('btnTestImage')?.addEventListener('click', async () => {
		try {
			const result = await (window.api as any).testImageControl();
			if (result && result.success) {
				showToast(`Archivo encontrado: ${result.filePath}`);
			} else {
				showToast(`No se encontró archivo de control: ${result?.error || 'Error desconocido'}`);
			}
		} catch (error: any) {
			showToast(`Error: ${error.message || error}`);
		}
	});

	// Toggle mostrar/ocultar token
	const btnToggleToken = document.getElementById('btnToggleToken') as HTMLButtonElement | null;
	if (btnToggleToken) {
		btnToggleToken.addEventListener('click', () => {
			const inp = document.getElementById('MP_ACCESS_TOKEN') as HTMLInputElement | null;
			if (!inp) return;
			inp.type = inp.type === 'password' ? 'text' : 'password';
			btnToggleToken.textContent = inp.type === 'password' ? '👁' : '🙈';
		});
	}

	// Toggle mostrar/ocultar contraseña FTP
	const btnToggleFtpPass = document.getElementById('btnToggleFtpPass') as HTMLButtonElement | null;
	if (btnToggleFtpPass) {
		btnToggleFtpPass.addEventListener('click', () => {
			const inp = document.getElementById('FTP_PASS') as HTMLInputElement | null;
			if (!inp) return;
			inp.type = inp.type === 'password' ? 'text' : 'password';
			btnToggleFtpPass.textContent = inp.type === 'password' ? '👁' : '🙈';
		});
	}

	// Toggle mostrar/ocultar contraseña SMTP
	// Para SMTP usamos solo icono; no cambiamos textContent a 'Ocultar'
	(function adjustSmtpToggle(){
		const btn = document.getElementById('btnToggleSmtpPass') as HTMLButtonElement | null;
		const inp = document.getElementById('SMTP_PASS') as HTMLInputElement | null;
		if (!btn || !inp) return;
		btn.addEventListener('click', () => {
			inp.type = inp.type === 'password' ? 'text' : 'password';
			btn.textContent = '👁';
		});
	})();

	// Toggles de seguridad
	function attachPwToggle(btnId: string, inputId: string) {
		const btn = document.getElementById(btnId) as HTMLButtonElement | null;
		const inp = document.getElementById(inputId) as HTMLInputElement | null;
		if (!btn || !inp) return;
		btn.addEventListener('click', () => {
			inp.type = inp.type === 'password' ? 'text' : 'password';
			btn.textContent = inp.type === 'password' ? '👁' : '🙈';
		});
	}
	attachPwToggle('btnToggleCurrentPw', 'current-password');
	attachPwToggle('btnToggleNewPw', 'new-password');
	attachPwToggle('btnToggleConfirmPw', 'confirm-password');

	// Interceptar estados múltiples al momento de guardar o generar
	function readStatusesCsv(): string | undefined {
		const statusEl = document.getElementById('MP_STATUS') as HTMLSelectElement | null;
		if (!statusEl) return undefined;
		const val = String(statusEl.value || '').trim();
		return val || undefined;
	}

	function applyStatusesToSelect(csv: string | undefined) {
		const statusEl = document.getElementById('MP_STATUS') as HTMLSelectElement | null;
		if (!statusEl) return;
		const val = String(csv || '').trim();
		statusEl.value = val;
	}

	// Hook en Cargar config inicial
	window.api.getConfig().then((cfg) => {
		applyStatusesToSelect((cfg as any)?.MP_STATUS);
	});

	// Hook en Guardar configuración
	const origBtnSave = document.getElementById('btnSave');
	origBtnSave?.addEventListener('click', () => {
		const csv = readStatusesCsv();
		if (csv !== undefined) {
			try {
				const elStatusInput = document.createElement('input');
				elStatusInput.value = csv;
				// Inyectar momentáneamente para que buildConfigFromForm lo lea
				const statusHidden = document.getElementById('MP_STATUS_HIDDEN') as HTMLInputElement | null;
				if (!statusHidden) {
					elStatusInput.id = 'MP_STATUS_HIDDEN';
					elStatusInput.type = 'hidden';
					(document.body as any).appendChild(elStatusInput);
				} else {
					statusHidden.value = csv;
				}
			} catch {}
		}
	}, { once: false });

	// Hook en Generar (rango) y Generar
	document.getElementById('btnGenerateRange')?.addEventListener('click', () => {
		const csv = readStatusesCsv();
		if (csv !== undefined) (document.getElementById('MP_STATUS_HIDDEN') as HTMLInputElement | null)?.setAttribute('value', csv);
	});
	document.getElementById('btnGenerate')?.addEventListener('click', () => {
		const csv = readStatusesCsv();
		if (csv !== undefined) (document.getElementById('MP_STATUS_HIDDEN') as HTMLInputElement | null)?.setAttribute('value', csv);
	});

	// Validación simple de email
	function isValidEmail(value: string): boolean {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
	}
	const emailInput = document.getElementById('EMAIL_REPORT') as HTMLInputElement | null;
	const emailHelp = document.getElementById('EMAIL_REPORT_HELP') as HTMLElement | null;
	function updateEmailValidation() {
		if (!emailInput || !emailHelp) return;
		const ok = !emailInput.value || isValidEmail(emailInput.value);
		emailHelp.textContent = ok ? 'Destinatario que recibirá los reportes por email.' : 'Formato de email inválido';
		emailHelp.className = ok ? 'text-xs text-slate-500' : 'text-xs text-rose-400';
	}
	emailInput?.addEventListener('input', updateEmailValidation);
	updateEmailValidation();

	// Bloquear guardado con email inválido
	document.getElementById('btnSave')?.addEventListener('click', (e) => {
		if (emailInput && emailInput.value && !isValidEmail(emailInput.value)) {
			updateEmailValidation();
			showToast('Error: email inválido');
			(e as any).preventDefault?.();
		}
	});

	// Habilitar/Deshabilitar campos de notificaciones
	(function wireErrorNotifyToggles(){
		const enabled = document.getElementById('error-notifications-enabled') as HTMLInputElement | null;
		const minErrors = document.getElementById('min-errors-before-notify') as HTMLInputElement | null;
		const minTime = document.getElementById('min-time-between-notifications') as HTMLInputElement | null;
		function applyState() {
			const on = !!enabled?.checked;
			if (minErrors) { minErrors.disabled = !on; minErrors.style.opacity = on ? '1' : '0.6'; }
			if (minTime) { minTime.disabled = !on; minTime.style.opacity = on ? '1' : '0.6'; }
		}
		enabled?.addEventListener('change', applyState);
		applyState();
	})();

	// Controles de vista previa
	(function wirePreviewControls(){
		const pre = document.getElementById('preview') as HTMLPreElement | null;
		const filter = document.getElementById('previewFilter') as HTMLInputElement | null;
		const btnCopy = document.getElementById('btnPreviewCopy') as HTMLButtonElement | null;
		const btnExpand = document.getElementById('btnPreviewExpand') as HTMLButtonElement | null;
		const btnToggle = document.getElementById('btnPreviewToggle') as HTMLButtonElement | null;
		let expanded = false;
		let hidden = false;
		filter?.addEventListener('input', async () => {
			const cfg = await window.api.getConfig();
			renderPreview(cfg || {});
		});
		btnCopy?.addEventListener('click', async () => {
			try {
				await navigator.clipboard.writeText(pre?.textContent || '');
				showToast('Vista previa copiada al portapapeles');
			} catch {
				showToast('No se pudo copiar');
			}
		});
		btnExpand?.addEventListener('click', () => {
			expanded = !expanded;
			if (pre) pre.style.height = expanded ? '70vh' : '16rem';
			if (btnExpand) btnExpand.textContent = expanded ? '⤡ Contraer' : '⤢ Expandir';
		});
		btnToggle?.addEventListener('click', async () => {
			hidden = !hidden;
			if (pre) pre.style.display = hidden ? 'none' : 'block';
			if (btnToggle) btnToggle.textContent = hidden ? '👁 Mostrar' : '👁 Ocultar';
			if (!hidden) {
				const cfg = await window.api.getConfig();
				renderPreview(cfg || {});
			}
		});
	})();

	// Descargar / Restaurar JSON (vista previa)
	(function wirePreviewImportExport(){
		const pre = document.getElementById('preview') as HTMLPreElement | null;
		const btnDownload = document.getElementById('btnPreviewDownload') as HTMLButtonElement | null;
		const btnRestore = document.getElementById('btnPreviewRestore') as HTMLButtonElement | null;
		const fileInput = document.getElementById('previewRestoreFile') as HTMLInputElement | null;
		btnDownload?.addEventListener('click', async () => {
			try {
				let text = pre?.textContent || '';
				if (!text) {
					const cfg = await window.api.getConfig();
					renderPreview(cfg || {});
					text = pre?.textContent || '';
				}
				const blob = new Blob([text], { type: 'application/json' });
				const a = document.createElement('a');
				const url = URL.createObjectURL(blob);
				a.href = url;
				a.download = `config-preview-${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
				document.body.appendChild(a);
				a.click();
				setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
				showToast('Descargado config-preview.json');
			} catch { showToast('No se pudo descargar'); }
		});
		btnRestore?.addEventListener('click', () => fileInput?.click());
		fileInput?.addEventListener('change', async () => {
			try {
				const f = (fileInput.files && fileInput.files[0]) || null;
				if (!f) return;
				const text = await f.text();
				const data = JSON.parse(text);
				if (!confirm('¿Sobrescribir configuración actual con el JSON seleccionado?')) { fileInput.value=''; return; }
				const current = await window.api.getConfig();
				const merged = { ...(current||{}), ...(data||{}) };
				await window.api.saveConfig(merged);
				setFormFromConfig(merged);
				renderPreview(merged);
				showToast('Configuración restaurada desde JSON');
			} catch (e:any) {
				showToast(`Error al restaurar: ${String(e?.message||e)}`);
			} finally { if (fileInput) fileInput.value = ''; }
		});
	})();

	// ===== ACERCA DE: Notas de versión dinámicas =====
	function parseReleaseNotes(md: string): Array<{ version: string; body: string }> {
		const lines = (md || '').split(/\r?\n/);
		const entries: Array<{ version: string; body: string }> = [];
		let current: { version: string; body: string } | null = null;
		for (const line of lines) {
			const m = line.match(/^##\s+([0-9]+\.[0-9]+\.[0-9]+)/);
			if (m) {
				if (current) entries.push(current);
				current = { version: m[1], body: '' };
				continue;
			}
			if (!current) {
				// ignorar cabecera general
				continue;
			}
			current.body += (current.body ? '\n' : '') + line;
		}
		if (current) entries.push(current);
		return entries;
	}
	function renderReleaseNotesList(md: string, installedVersion: string) {
		const container = document.getElementById('release-notes-list') as HTMLElement | null;
		if (!container) return;
		const items = parseReleaseNotes(md);
		container.innerHTML = items.map(({ version, body }, idx) => {
			const isCurrent = version === installedVersion;
			const open = false;
			return `
			<details class="group border border-slate-700 rounded-md ${isCurrent ? 'ring-1 ring-emerald-600/40' : ''}" ${open ? 'open' : ''}>
				<summary class="cursor-pointer px-3 py-1.5 bg-slate-800 text-sm flex items-center justify-between">
					<span>v${version} ${isCurrent ? '<span class=\'ml-2 text-emerald-400 text-xs\'>(instalada)</span>' : ''}</span>
					<span class="text-xs text-slate-400">clic para ver</span>
				</summary>
				<pre class="p-3 text-xs whitespace-pre-wrap leading-5">${body.replace(/</g,'&lt;')}</pre>
			</details>`;
		}).join('');
	}
	async function loadReleaseNotesDynamic() {
		try {
			const res = await (window.api as any).getReleaseNotes?.();
			const v = await window.api.getAppVersion();
			if (res && res.ok) renderReleaseNotesList(String(res.content||''), String((v as any)?.version||''));
		} catch {}
	}
	(document.getElementById('btnRefreshReleaseNotes') as HTMLButtonElement | null)?.addEventListener('click', loadReleaseNotesDynamic);
	(document.getElementById('btnReleaseExpandAll') as HTMLButtonElement | null)?.addEventListener('click', () => {
		for (const d of Array.from(document.querySelectorAll('#release-notes-list details'))) (d as HTMLDetailsElement).open = true;
	});
	(document.getElementById('btnReleaseCollapseAll') as HTMLButtonElement | null)?.addEventListener('click', () => {
		for (const d of Array.from(document.querySelectorAll('#release-notes-list details'))) (d as HTMLDetailsElement).open = false;
	});
	loadReleaseNotesDynamic();

	// FTP Server toggle
	document.getElementById('btnFtpSrvToggle')?.addEventListener('click', async () => {
		try {
			const status = await (window.api as any).ftpStatus?.();
			const running = !!(status && status.running);
			if (!running) {
				// Start
				const cfg = buildConfigFromForm();
				await window.api.saveConfig(cfg);
				const res = await (window.api as any).ftpStart?.({
					host: (document.getElementById('FTP_SRV_HOST') as HTMLInputElement)?.value || '0.0.0.0',
					port: Number((document.getElementById('FTP_SRV_PORT') as HTMLInputElement)?.value || 2121),
					user: (document.getElementById('FTP_SRV_USER') as HTMLInputElement)?.value || 'user',
					pass: (document.getElementById('FTP_SRV_PASS') as HTMLInputElement)?.value || 'pass',
					root: (document.getElementById('FTP_SRV_ROOT') as HTMLInputElement)?.value || 'C:\\tmp\\ftp_share',
					pasv_host: (document.getElementById('FTP_SRV_PASV_HOST') as HTMLInputElement)?.value || undefined,
					pasv_min: Number((document.getElementById('FTP_SRV_PASV_MIN') as HTMLInputElement)?.value || 50000),
					pasv_max: Number((document.getElementById('FTP_SRV_PASV_MAX') as HTMLInputElement)?.value || 50100)
				});
				{
					const ftpStatusEl = document.getElementById('ftpSrvStatus') as HTMLElement | null;
					if (ftpStatusEl) ftpStatusEl.textContent = res?.ok ? 'FTP Server: ON' : 'Error al iniciar';
				}
				const btn = document.getElementById('btnFtpSrvToggle') as HTMLButtonElement | null;
				if (btn && res?.ok) { btn.textContent = 'Detener servidor FTP'; }
				renderPreview(await window.api.getConfig());
				refreshFtpSrvStatusLine();
			} else {
				const res = await (window.api as any).ftpStop?.();
				{
					const ftpStatusEl2 = document.getElementById('ftpSrvStatus') as HTMLElement | null;
					if (ftpStatusEl2) ftpStatusEl2.textContent = res?.ok ? 'FTP Server: OFF' : 'Error al detener';
				}
				const btn = document.getElementById('btnFtpSrvToggle') as HTMLButtonElement | null;
				if (btn && res?.ok) { btn.textContent = 'Iniciar servidor FTP'; }
				renderPreview(await window.api.getConfig());
				refreshFtpSrvStatusLine();
			}
		} catch (e: any) {
			const ftpStatusEl3 = document.getElementById('ftpSrvStatus') as HTMLElement | null;
			if (ftpStatusEl3) ftpStatusEl3.textContent = 'Error: ' + (e?.message || e);
		}
	});

	function refreshFtpSrvStatusLine() {
		const statusEl = document.getElementById('ftpSrvStatus') as HTMLElement | null;
		if (!statusEl) return;
		(window.api as any).ftpStatus?.().then((st: any) => {
			const running = !!(st && st.running);
			const host = (document.getElementById('FTP_SRV_HOST') as HTMLInputElement)?.value || '0.0.0.0';
			const port = (document.getElementById('FTP_SRV_PORT') as HTMLInputElement)?.value || '2121';
			const user = (document.getElementById('FTP_SRV_USER') as HTMLInputElement)?.value || 'user';
			const root = (document.getElementById('FTP_SRV_ROOT') as HTMLInputElement)?.value || '';
			if (running) {
				statusEl.textContent = `ON • ftp://${user}:••••@${host}:${port}  →  ${root}`;
			} else {
				statusEl.textContent = 'OFF';
			}
		}).catch(() => {});
	}

	// Botones extra: Copiar URL y Abrir carpeta raíz
	(function wireFtpHelperButtons(){
		const btnCopy = document.getElementById('btnFtpCopyUrl') as HTMLButtonElement | null;
		const btnOpen = document.getElementById('btnFtpOpenRoot') as HTMLButtonElement | null;
		btnCopy?.addEventListener('click', async () => {
			try {
				let host = (document.getElementById('FTP_SRV_HOST') as HTMLInputElement)?.value || '0.0.0.0';
				const port = (document.getElementById('FTP_SRV_PORT') as HTMLInputElement)?.value || '2121';
				const user = (document.getElementById('FTP_SRV_USER') as HTMLInputElement)?.value || 'user';
				// Si el host está en 0.0.0.0 (escuchar en todas), para conectarse local usar 127.0.0.1
				if (!host || host === '0.0.0.0') host = '127.0.0.1';
				// Windows Explorer suele funcionar mejor sin usuario en la URL (pedirá credenciales)
				const url = `ftp://${host}:${port}`;
				await navigator.clipboard.writeText(url);
				showToast(`URL copiada: ${url} (usuario: ${user})`);
			} catch { showToast('No se pudo copiar'); }
		});
		btnOpen?.addEventListener('click', async () => {
			try {
				const root = (document.getElementById('FTP_SRV_ROOT') as HTMLInputElement)?.value || '';
				if (!root) { showToast('Carpeta raíz vacía'); return; }
				const res = await (window.api as any).openPath?.(root);
				if (res && res.ok) showToast('Carpeta abierta'); else showToast('No se pudo abrir la carpeta');
			} catch { showToast('No se pudo abrir la carpeta'); }
		});
	})();

	// Facturación – Configuración AFIP y listado
	const btnAfipGuardar = document.getElementById('btnAfipGuardar') as HTMLButtonElement | null;
	const afipCfgStatus = document.getElementById('afipCfgStatus');
	btnAfipGuardar?.addEventListener('click', async () => {
		const cfg = {
			cuit: (document.getElementById('AFIP_CUIT') as HTMLInputElement)?.value?.trim(),
			pto_vta: Number((document.getElementById('AFIP_PTO_VTA') as HTMLInputElement)?.value || 0),
			cert_path: (document.getElementById('AFIP_CERT_PATH') as HTMLInputElement)?.value?.trim(),
			key_path: (document.getElementById('AFIP_KEY_PATH') as HTMLInputElement)?.value?.trim(),
			entorno: (document.getElementById('AFIP_ENTORNO') as HTMLSelectElement)?.value as any
		};
		const res = await (window.api as any).facturacion?.guardarConfig(cfg);
		if (afipCfgStatus) afipCfgStatus.textContent = res?.ok ? 'Configuración guardada' : `Error: ${res?.error || ''}`;
	});

	async function cargarListadoFacturas() {
		const desde = (document.getElementById('AFIP_FILTRO_DESDE') as HTMLInputElement)?.value?.trim();
		const hasta = (document.getElementById('AFIP_FILTRO_HASTA') as HTMLInputElement)?.value?.trim();
		const res = await (window.api as any).facturacion?.listar({ desde: desde || undefined, hasta: hasta || undefined });
		const tbody = document.querySelector('#tablaFacturasAfip tbody');
		if (!tbody) return;
		(tbody as HTMLElement).innerHTML = '';
		if (res?.ok && Array.isArray(res.rows)) {
			for (const r of res.rows) {
				const tr = document.createElement('tr');
				tr.innerHTML = `
					<td class="py-1">${r.fecha || ''}</td>
					<td class="py-1">${r.pto_vta}</td>
					<td class="py-1">${r.tipo_cbte}</td>
					<td class="py-1">${String(r.numero).padStart(8, '0')}</td>
					<td class="py-1">${r.razon_social_receptor || r.cuit_receptor || ''}</td>
					<td class="py-1">$${Number(r.total).toFixed(2)}</td>
					<td class="py-1">${r.cae}</td>
					<td class="py-1"><button data-pdf="${r.pdf_path}" class="btnVerPdf px-2 py-0.5 text-xs rounded border border-slate-600 hover:bg-slate-700">Abrir</button></td>
				`;
				(tbody as HTMLElement).appendChild(tr);
			}
			// Bind abrir PDF
			(tbody as HTMLElement).querySelectorAll('button.btnVerPdf')?.forEach((btn) => {
				btn.addEventListener('click', async () => {
					const fp = (btn as HTMLButtonElement).getAttribute('data-pdf') || '';
					if (fp) await (window.api as any).facturacion?.abrirPdf(fp);
				});
			});
		}
	}
	(document.getElementById('btnAfipBuscar') as HTMLButtonElement | null)?.addEventListener('click', cargarListadoFacturas);
	setTimeout(() => cargarListadoFacturas(), 1000);

	// Empresa – cargar/guardar
	(async () => {
		try {
			const r = await (window.api as any).facturacion?.empresaGet();
			const d = r?.data || {};
			const empR = document.getElementById('EMP_RAZON') as HTMLInputElement | null;
			const empC = document.getElementById('EMP_CUIT') as HTMLInputElement | null;
			const empD = document.getElementById('EMP_DOM') as HTMLInputElement | null;
			const empI = document.getElementById('EMP_IVA') as HTMLSelectElement | null;
			const empL = document.getElementById('EMP_LOGO') as HTMLInputElement | null;
			if (empR) empR.value = d.razon_social || '';
			if (empC) empC.value = d.cuit || '';
			if (empD) empD.value = d.domicilio || '';
			if (empI) empI.value = d.condicion_iva || 'RI';
			if (empL) empL.value = d.logo_path || '';
		} catch {}
	})();
	(document.getElementById('btnEmpresaGuardar') as HTMLButtonElement | null)?.addEventListener('click', async () => {
		const payload = {
			razon_social: (document.getElementById('EMP_RAZON') as HTMLInputElement)?.value?.trim(),
			cuit: (document.getElementById('EMP_CUIT') as HTMLInputElement)?.value?.trim(),
			domicilio: (document.getElementById('EMP_DOM') as HTMLInputElement)?.value?.trim(),
			condicion_iva: (document.getElementById('EMP_IVA') as HTMLSelectElement)?.value,
			logo_path: (document.getElementById('EMP_LOGO') as HTMLInputElement)?.value?.trim()
		};
		const res = await (window.api as any).facturacion?.empresaSave(payload);
		const el = document.getElementById('empresaStatus');
		if (el) el.textContent = res?.ok ? 'Guardado' : `Error: ${res?.error || ''}`;
	});

	// Parámetros – cargar/guardar
	(async () => {
		try {
			const r = await (window.api as any).facturacion?.paramGet();
			const p = r?.data || {};
			(document.getElementById('FAC_TIPO_DEF') as HTMLSelectElement | null)!.value = p.tipo_defecto || 'FA';
			(document.getElementById('FAC_PTO_VTA_DEF') as HTMLInputElement | null)!.value = p.pto_vta || '';
			(document.getElementById('FAC_NUM_DEF') as HTMLInputElement | null)!.value = p.numeracion || '';
		} catch {}
	})();
	(document.getElementById('btnParamGuardar') as HTMLButtonElement | null)?.addEventListener('click', async () => {
		const payload = {
			tipo_defecto: (document.getElementById('FAC_TIPO_DEF') as HTMLSelectElement)?.value,
			pto_vta: Number((document.getElementById('FAC_PTO_VTA_DEF') as HTMLInputElement)?.value || 0),
			numeracion: Number((document.getElementById('FAC_NUM_DEF') as HTMLInputElement)?.value || 0)
		};
		const res = await (window.api as any).facturacion?.paramSave(payload);
		const el = document.getElementById('paramStatus');
		if (el) el.textContent = res?.ok ? 'Guardado' : `Error: ${res?.error || ''}`;
	});

	// Historial local de PDFs
	async function renderPdfs() {
		const list = document.getElementById('listaPdfsAfip');
		if (!list) return;
		list.innerHTML = '';
		const res = await (window.api as any).facturacion?.listarPdfs();
		if (res?.ok && Array.isArray(res.rows)) {
			for (const f of res.rows) {
				const li = document.createElement('li');
				li.innerHTML = `<button data-path="${f.path}" class="px-2 py-0.5 text-xs rounded border border-slate-600 hover:bg-slate-700">Abrir</button> <span>${f.name}</span>`;
				list.appendChild(li);
			}
			list.querySelectorAll('button[data-path]')?.forEach(btn => {
				btn.addEventListener('click', async () => {
					const fp = (btn as HTMLButtonElement).getAttribute('data-path') || '';
					await (window.api as any).facturacion?.abrirPdf(fp);
				});
			});
		}
	}
	(document.getElementById('btnPdfsRefresh') as HTMLButtonElement | null)?.addEventListener('click', renderPdfs);
	setTimeout(() => renderPdfs(), 1000);

	// ====== Perfiles de Configuración (UI wiring) ======
	async function perfilesLoadList() {
		try {
			const res = await (window.api as any).perfiles?.list?.();
			const sel = document.getElementById('perfilSelect') as HTMLSelectElement | null;
			if (!sel || !res?.ok) return;
			sel.innerHTML = '';
			(res.rows || []).forEach((p: any) => {
				const opt = document.createElement('option');
				opt.value = String(p.id);
				opt.textContent = p.nombre;
				sel.appendChild(opt);
			});
			if (sel.options.length > 0) sel.selectedIndex = 0;
			perfilesRenderPreview();
		} catch {}
	}

	async function perfilesRenderPreview() {
		try {
			const sel = document.getElementById('perfilSelect') as HTMLSelectElement | null;
			if (!sel) return;
			const id = Number(sel.value || 0);
			if (!id) return;
			const res = await (window.api as any).perfiles?.get?.(id);
			const pre = document.getElementById('perfilPreview') as HTMLPreElement | null;
			if (pre) pre.textContent = res?.row ? JSON.stringify(res.row, null, 2) : '';
			const tag = document.getElementById('perfilSelectedTag') as HTMLElement | null;
			if (tag) tag.textContent = res?.row ? `Seleccionado: ${res.row.nombre} (id ${res.row.id})` : '';
		} catch {}
	}

	async function perfilesAplicarSeleccionado() {
		const sel = document.getElementById('perfilSelect') as HTMLSelectElement | null;
		if (!sel) return;
		const id = Number(sel.value || 0);
		if (!id) return;
		if (!confirm('¿Aplicar este perfil y sobrescribir la configuración actual?')) return;
		const res = await (window.api as any).perfiles?.get?.(id);
		if (res?.row) {
			const cfg = await window.api.getConfig();
			const merged = { ...(cfg||{}), ...(res.row?.parametros || {}), ACTIVE_PERFIL_ID: res.row.id, ACTIVE_PERFIL_NOMBRE: res.row.nombre, ACTIVE_PERFIL_PERMISOS: res.row.permisos };
			await window.api.saveConfig(merged);
			setFormFromConfig(merged);
			perfilesApplyUiPermissions(res.row.permisos || {});
			showToast('Perfil aplicado');
		}
	}

	async function perfilesGuardarComoNuevo() {
		const nombre = prompt('Nombre del nuevo perfil:');
		if (!nombre) return;
		const cfg = await window.api.getConfig();
		const payload = { nombre, permisos: { facturacion: true, caja: true, administracion: true, configuracion: true }, parametros: cfg };
		const res = await (window.api as any).perfiles?.save?.(payload);
		if (res?.ok) { await perfilesLoadList(); showToast('Perfil guardado'); }
	}

	async function perfilesExportar() {
		const sel = document.getElementById('perfilSelect') as HTMLSelectElement | null;
		if (!sel) return;
		const id = Number(sel.value || 0);
		const res = await (window.api as any).perfiles?.get?.(id);
		if (res?.row) {
			const blob = new Blob([JSON.stringify(res.row, null, 2)], { type: 'application/json' });
			const a = document.createElement('a');
			const url = URL.createObjectURL(blob);
			a.href = url; a.download = `perfil-${res.row.nombre.replace(/\s+/g,'_')}.json`;
			document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); },0);
		}
	}

	async function perfilesImportar() {
		const input = document.getElementById('perfilImportFile') as HTMLInputElement | null;
		if (!input) return;
		input.onchange = async () => {
			try {
				const f = (input.files && input.files[0]) || null;
				if (!f) return;
				const text = await f.text();
				const obj = JSON.parse(text);
				await (window.api as any).perfiles?.save?.({ nombre: obj.nombre || ('Perfil '+Date.now()), permisos: obj.permisos||{}, parametros: obj.parametros||{} });
				await perfilesLoadList();
				showToast('Perfil importado');
			} catch (e:any) { showToast('Error al importar'); }
			finally { input.value=''; }
		};
		input.click();
	}

	(document.getElementById('perfilSelect') as HTMLSelectElement | null)?.addEventListener('change', perfilesRenderPreview);
	(document.getElementById('btnPerfilAplicar') as HTMLButtonElement | null)?.addEventListener('click', perfilesAplicarSeleccionado);
	(document.getElementById('btnPerfilGuardarNuevo') as HTMLButtonElement | null)?.addEventListener('click', perfilesGuardarComoNuevo);
	(document.getElementById('btnPerfilExportar') as HTMLButtonElement | null)?.addEventListener('click', perfilesExportar);
	(document.getElementById('btnPerfilImportar') as HTMLButtonElement | null)?.addEventListener('click', perfilesImportar);

	// ====== Perfiles: Editar (modal) ======
	function perfilesApplyUiPermissions(permisos: any) {
		try {
			const secMp = document.getElementById('sec-mercado-pago') as HTMLDetailsElement | null;
			const secFac = document.getElementById('sec-facturacion') as HTMLDetailsElement | null;
			if (secMp) secMp.style.display = permisos?.facturacion === false ? 'none' : '';
			if (secFac) secFac.style.display = permisos?.facturacion === false ? 'none' : '';
		} catch {}
	}

	async function perfilesOpenEdit() {
		const sel = document.getElementById('perfilSelect') as HTMLSelectElement | null;
		if (!sel) return;
		const id = Number(sel.value || 0);
		if (!id) return;
		const res = await (window.api as any).perfiles?.get?.(id);
		if (!res?.row) return;
		const p = res.row;
		const modal = document.getElementById('perfilEditorModal') as HTMLDivElement | null;
		(modal as any).classList.remove('hidden');
		(modal as any).classList.add('flex');
		const title = document.getElementById('perfilEditTitle') as HTMLElement | null;
		if (title) title.textContent = `Editar perfil: ${p.nombre}`;
		(document.getElementById('perfilEditNombre') as HTMLInputElement | null)!.value = p.nombre || '';
		(document.getElementById('perm_facturacion') as HTMLInputElement | null)!.checked = !!p.permisos?.facturacion;
		(document.getElementById('perm_caja') as HTMLInputElement | null)!.checked = !!p.permisos?.caja;
		(document.getElementById('perm_administracion') as HTMLInputElement | null)!.checked = !!p.permisos?.administracion;
		(document.getElementById('perm_configuracion') as HTMLInputElement | null)!.checked = !!p.permisos?.configuracion;
		(document.getElementById('perm_consulta') as HTMLInputElement | null)!.checked = !!p.permisos?.consulta;
		(document.getElementById('perfilEditParams') as HTMLTextAreaElement | null)!.value = JSON.stringify(p.parametros || {}, null, 2);

		// helpers del modal
		(document.getElementById('perfilParamsFromConfig') as HTMLButtonElement | null)!.onclick = async () => {
			const cfg = await window.api.getConfig();
			// Solo tomar claves relevantes a Imagen + FTP Server
			const keys = [
				'IMAGE_CONTROL_DIR','IMAGE_CONTROL_FILE','IMAGE_WINDOW_SEPARATE','IMAGE_WATCH','IMAGE_PUBLICIDAD_ALLOWED',
				'IMAGE_PRODUCTO_NUEVO_ENABLED','IMAGE_PRODUCTO_NUEVO_WAIT_SECONDS',
				'FTP_SRV_HOST','FTP_SRV_PORT','FTP_SRV_USER','FTP_SRV_PASS','FTP_SRV_ROOT','FTP_SRV_ENABLED','FTP_SRV_PASV_HOST','FTP_SRV_PASV_MIN','FTP_SRV_PASV_MAX'
			];
			const subset: any = {};
			keys.forEach((k) => { if (k in (cfg||{})) (subset as any)[k] = (cfg as any)[k]; });
			(document.getElementById('perfilEditParams') as HTMLTextAreaElement | null)!.value = JSON.stringify(subset, null, 2);
		};
		(document.getElementById('perfilParamsClear') as HTMLButtonElement | null)!.onclick = () => {
			(document.getElementById('perfilEditParams') as HTMLTextAreaElement | null)!.value = '{}';
		};

		function close() {
			if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
		}
		(document.getElementById('perfilEditClose') as HTMLButtonElement | null)!.onclick = close;
		(document.getElementById('perfilEditCancel') as HTMLButtonElement | null)!.onclick = close;

		(document.getElementById('perfilEditSave') as HTMLButtonElement | null)!.onclick = async () => {
			try {
				const nombre = (document.getElementById('perfilEditNombre') as HTMLInputElement | null)!.value?.trim() || p.nombre;
				const permisos = {
					facturacion: (document.getElementById('perm_facturacion') as HTMLInputElement | null)!.checked,
					caja: (document.getElementById('perm_caja') as HTMLInputElement | null)!.checked,
					administracion: (document.getElementById('perm_administracion') as HTMLInputElement | null)!.checked,
					configuracion: (document.getElementById('perm_configuracion') as HTMLInputElement | null)!.checked,
					consulta: (document.getElementById('perm_consulta') as HTMLInputElement | null)!.checked
				};
				let parametros: any = {};
				try { parametros = JSON.parse((document.getElementById('perfilEditParams') as HTMLTextAreaElement | null)!.value || '{}'); }
				catch (e:any) { showToast('JSON de parámetros inválido'); return; }
				await (window.api as any).perfiles?.save?.({ id, nombre, permisos, parametros });
				await perfilesLoadList();
				perfilesApplyUiPermissions(permisos);
				close();
				showToast('Perfil actualizado');
			} catch (e:any) { showToast('Error al guardar perfil'); }
		};
	}

	(document.getElementById('btnPerfilEditar') as HTMLButtonElement | null)?.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); perfilesOpenEdit(); });

	// Aplicar permisos a la UI cuando se aplica un perfil
	(async function hookApplyPermsOnApply(){
		const orig = perfilesAplicarSeleccionado;
		async function wrapped() {
			const sel = document.getElementById('perfilSelect') as HTMLSelectElement | null;
			if (sel) {
				const id = Number(sel.value || 0);
				const res = await (window.api as any).perfiles?.get?.(id);
				if (res?.row) perfilesApplyUiPermissions(res.row.permisos || {});
			}
			await orig();
		}
		(document.getElementById('btnPerfilAplicar') as HTMLButtonElement | null)?.removeEventListener('click', perfilesAplicarSeleccionado as any);
		(document.getElementById('btnPerfilAplicar') as HTMLButtonElement | null)?.addEventListener('click', wrapped as any);
	})();

	function applyPermsFromConfig(cfg: any) {
		try {
			const permisos = (cfg && (cfg as any).ACTIVE_PERFIL_PERMISOS) || null;
			if (!permisos) return;
			perfilesApplyUiPermissions(permisos);
			const btnCaja = document.getElementById('btnOpenCaja') as HTMLButtonElement | null;
			if (btnCaja) { btnCaja.disabled = permisos.caja === false; btnCaja.style.opacity = permisos.caja === false ? '0.5' : '1'; }
			const btnImg = document.getElementById('btnOpenImagen') as HTMLButtonElement | null;
			if (btnImg) { btnImg.disabled = false; btnImg.style.opacity = '1'; }
			// Etiqueta de perfil activo
			const tag = document.getElementById('activePerfilTag') as HTMLSpanElement | null;
			if (tag) {
				const name = (cfg as any).ACTIVE_PERFIL_NOMBRE || '';
				tag.textContent = name ? `Perfil activo: ${name}` : '';
				if (name) tag.classList.remove('hidden'); else tag.classList.add('hidden');
				// Color segun nombre
				const base = ['border-slate-600','bg-slate-800','text-slate-200','border-emerald-700','bg-emerald-900/40','text-emerald-200','border-sky-700','bg-sky-900/40','text-sky-200','border-amber-700','bg-amber-900/40','text-amber-200'];
				(tag.classList as any).remove(...base);
				if (/admin/i.test(name)) { tag.classList.add('border-emerald-700','bg-emerald-900/40','text-emerald-200'); }
				else if (/cajero/i.test(name)) { tag.classList.add('border-sky-700','bg-sky-900/40','text-sky-200'); }
				else { tag.classList.add('border-amber-700','bg-amber-900/40','text-amber-200'); }
			}
			// Panel administración (config): si administracion=false, mostrar aviso y bloquear acciones críticas
			const warn = document.getElementById('perfilPermWarning') as HTMLDivElement | null;
			if (warn) {
				if (permisos.administracion === false || permisos.configuracion === false) {
					warn.classList.remove('hidden');
					warn.textContent = 'Este perfil limita acciones de administración/configuración. Algunas opciones pueden estar deshabilitadas.';
				} else {
					warn.classList.add('hidden');
					warn.textContent = '';
				}
			}
			// Deshabilitar guardar si configuracion=false
			const btnSave = document.getElementById('btnSave') as HTMLButtonElement | null;
			if (btnSave) { btnSave.disabled = permisos.configuracion === false; btnSave.style.opacity = permisos.configuracion === false ? '0.5' : '1'; }
			// Sólo lectura básica: inputs deshabilitados si configuracion=false
			if (permisos.configuracion === false) {
				Array.from(document.querySelectorAll('#configForm input, #configForm select, #configForm button'))
					.forEach((el) => {
						const id = (el as HTMLElement).id || '';
						// Permitir navegación básica, abrir visor, botones Perfiles
						const allowIds = new Set(['btnOpenCaja','btnOpenImagen','btnOpenLogs','btnPerfilAplicar','btnPerfilExportar','btnPerfilImportar','perfilSelect']);
						if (!allowIds.has(id)) (el as HTMLInputElement | HTMLButtonElement).disabled = true;
					});
			} else {
				Array.from(document.querySelectorAll('#configForm input, #configForm select, #configForm button'))
					.forEach((el) => { (el as HTMLInputElement | HTMLButtonElement).disabled = false; });
			}
		} catch {}
	}

	perfilesLoadList();



	// ===== PRUEBAS DE FACTURACIÓN AFIP =====
	
	// Variables para manejo de items
	let itemsPrueba: Array<{
		id: number;
		descripcion: string;
		cantidad: number;
		precioUnitario: number;
		alicuotaIva: number;
		subtotal: number;
	}> = [];
	let nextItemId = 1;
	
	// Función para agregar item a la tabla
	function agregarItemPrueba() {
		const item = {
			id: nextItemId++,
			descripcion: '',
			cantidad: 1,
			precioUnitario: 0,
			alicuotaIva: 21,
			subtotal: 0
		};
		itemsPrueba.push(item);
		renderizarItemsPrueba();
	}
	
	// Función para eliminar item
	function eliminarItemPrueba(id: number) {
		itemsPrueba = itemsPrueba.filter(item => item.id !== id);
		renderizarItemsPrueba();
	}
	
	// Función para actualizar item
	function actualizarItemPrueba(id: number, campo: string, valor: any) {
		const item = itemsPrueba.find(i => i.id === id);
		if (item) {
			(item as any)[campo] = valor;
			// Recalcular subtotal
			item.subtotal = item.cantidad * item.precioUnitario;
			renderizarItemsPrueba();
		}
	}
	
	// Función para renderizar tabla de items
	function renderizarItemsPrueba() {
		const tbody = document.getElementById('tbodyItemsPrueba');
		if (!tbody) return;
		
		tbody.innerHTML = '';
		
		itemsPrueba.forEach(item => {
			const tr = document.createElement('tr');
			tr.className = 'border-b border-slate-600';
			tr.innerHTML = `
				<td class="px-2 py-1">
					<input type="text" 
						value="${item.descripcion}" 
						placeholder="Descripción del item"
						class="w-full px-1 py-0.5 text-xs bg-slate-700 border border-slate-600 rounded text-white"
						onchange="actualizarItemPrueba(${item.id}, 'descripcion', this.value)">
				</td>
				<td class="px-2 py-1">
					<input type="number" 
						value="${item.cantidad}" 
						min="1" step="1"
						class="w-16 px-1 py-0.5 text-xs bg-slate-700 border border-slate-600 rounded text-white"
						onchange="actualizarItemPrueba(${item.id}, 'cantidad', Number(this.value))">
				</td>
				<td class="px-2 py-1">
					<input type="number" 
						value="${item.precioUnitario}" 
						min="0" step="0.01"
						class="w-20 px-1 py-0.5 text-xs bg-slate-700 border border-slate-600 rounded text-white"
						onchange="actualizarItemPrueba(${item.id}, 'precioUnitario', Number(this.value))">
				</td>
				<td class="px-2 py-1">
					<select class="w-16 px-1 py-0.5 text-xs bg-slate-700 border border-slate-600 rounded text-white"
						onchange="actualizarItemPrueba(${item.id}, 'alicuotaIva', Number(this.value))">
						<option value="21" ${item.alicuotaIva === 21 ? 'selected' : ''}>21%</option>
						<option value="10.5" ${item.alicuotaIva === 10.5 ? 'selected' : ''}>10.5%</option>
						<option value="27" ${item.alicuotaIva === 27 ? 'selected' : ''}>27%</option>
						<option value="0" ${item.alicuotaIva === 0 ? 'selected' : ''}>0%</option>
						<option value="-1" ${item.alicuotaIva === -1 ? 'selected' : ''}>Exento</option>
					</select>
				</td>
				<td class="px-2 py-1 font-semibold">$${item.subtotal.toFixed(2)}</td>
				<td class="px-2 py-1">
					<button type="button" 
						onclick="eliminarItemPrueba(${item.id})"
						class="px-2 py-0.5 text-xs rounded bg-red-600 text-white hover:bg-red-500">
						❌
					</button>
				</td>
			`;
			tbody.appendChild(tr);
		});
		
		actualizarTotalesPrueba();
	}
	
	// Función para actualizar totales
	function actualizarTotalesPrueba() {
		const totalNeto = itemsPrueba.reduce((sum, item) => sum + item.subtotal, 0);
		const totalIva = itemsPrueba.reduce((sum, item) => {
			if (item.alicuotaIva > 0) {
				return sum + (item.subtotal * (item.alicuotaIva / 100));
			}
			return sum;
		}, 0);
		const totalFinal = totalNeto + totalIva;
		
		(document.getElementById('totalNetoPrueba') as HTMLElement).textContent = `$${totalNeto.toFixed(2)}`;
		(document.getElementById('totalIvaPrueba') as HTMLElement).textContent = `$${totalIva.toFixed(2)}`;
		(document.getElementById('totalFinalPrueba') as HTMLElement).textContent = `$${totalFinal.toFixed(2)}`;
	}
	
	// Función para limpiar items
	function limpiarItemsPrueba() {
		itemsPrueba = [];
		nextItemId = 1;
		renderizarItemsPrueba();
		
		// Resetear configuración AFIP a valores por defecto
		(document.getElementById('pruebaFacturaTipoCbte') as HTMLSelectElement).value = '11';
		(document.getElementById('pruebaFacturaConcepto') as HTMLSelectElement).value = '1';
		(document.getElementById('pruebaFacturaDocTipo') as HTMLSelectElement).value = '80';
		(document.getElementById('pruebaFacturaMoneda') as HTMLSelectElement).value = 'PES';
	}
	
	// Exponer funciones globalmente para los onclick
	(window as any).actualizarItemPrueba = actualizarItemPrueba;
	(window as any).eliminarItemPrueba = eliminarItemPrueba;
	
	// Botón agregar item
	(document.getElementById('btnAgregarItem') as HTMLButtonElement | null)?.addEventListener('click', agregarItemPrueba);
	
	// Botón limpiar items
	(document.getElementById('btnLimpiarItems') as HTMLButtonElement | null)?.addEventListener('click', limpiarItemsPrueba);
	
	// Emitir factura de prueba
	(document.getElementById('btnPruebaEmitir') as HTMLButtonElement | null)?.addEventListener('click', async () => {
		try {
			// Obtener configuración AFIP
			const tipoCbte = parseInt((document.getElementById('pruebaFacturaTipoCbte') as HTMLSelectElement)?.value || '11');
			const concepto = parseInt((document.getElementById('pruebaFacturaConcepto') as HTMLSelectElement)?.value || '1');
			const docTipo = parseInt((document.getElementById('pruebaFacturaDocTipo') as HTMLSelectElement)?.value || '80');
			const moneda = (document.getElementById('pruebaFacturaMoneda') as HTMLSelectElement)?.value || 'PES';

			// Fechas de servicio (si concepto 2 o 3)
			const toYyyymmdd = (v?: string) => (v ? v.replace(/-/g, '') : undefined);
			const fServDesdeEl = document.getElementById('FchServDesde') as HTMLInputElement | null;
			const fServHastaEl = document.getElementById('FchServHasta') as HTMLInputElement | null;
			const fVtoPagoEl = document.getElementById('FchVtoPago') as HTMLInputElement | null;
			const FchServDesde = fServDesdeEl?.value ? toYyyymmdd(fServDesdeEl.value) : undefined;
			const FchServHasta = fServHastaEl?.value ? toYyyymmdd(fServHastaEl.value) : undefined;
			const FchVtoPago = fVtoPagoEl?.value ? toYyyymmdd(fVtoPagoEl.value) : undefined;

			// Obtener datos del cliente
			const cuitCliente = (document.getElementById('pruebaFacturaCuit') as HTMLInputElement)?.value?.trim() || '20300123456';
			const razonSocial = (document.getElementById('pruebaFacturaRazon') as HTMLInputElement)?.value?.trim() || 'Cliente Demo S.A.';

			// Validar datos
			if (!cuitCliente || !razonSocial) {
				const status = document.getElementById('pruebaStatus');
				if (status) status.innerHTML = '<span class="text-red-400">Error: Complete los datos del cliente</span>';
				return;
			}

			// Validación de fechas de servicio cuando corresponde
			if (concepto === 2 || concepto === 3) {
				if (!FchServDesde || !FchServHasta || !FchVtoPago) {
					const status = document.getElementById('pruebaStatus');
					if (status) status.innerHTML = '<span class="text-red-400">Error: Para Servicios debe completar FchServDesde, FchServHasta y FchVtoPago</span>';
					return;
				}
			}

			// Validar items
			if (itemsPrueba.length === 0) {
				const status = document.getElementById('pruebaStatus');
				if (status) status.innerHTML = '<span class="text-red-400">Error: Agregue al menos un item</span>';
				return;
			}

			// Validar items completos
			const itemsIncompletos = itemsPrueba.filter(item => 
				!item.descripcion || item.cantidad <= 0 || item.precioUnitario <= 0
			);
			
			if (itemsIncompletos.length > 0) {
				const status = document.getElementById('pruebaStatus');
				if (status) status.innerHTML = '<span class="text-red-400">Error: Complete todos los items (descripción, cantidad y precio)</span>';
				return;
			}
			
			// Calcular totales
			const totalNeto = itemsPrueba.reduce((sum, item) => sum + item.subtotal, 0);
			const totalIva = itemsPrueba.reduce((sum, item) => {
				if (item.alicuotaIva > 0) {
					return sum + (item.subtotal * (item.alicuotaIva / 100));
				}
				return sum;
			}, 0);
			const totalFinal = totalNeto + totalIva;
			
			const status = document.getElementById('pruebaStatus');
			if (status) status.innerHTML = '<span class="text-blue-400">🔄 Emitiendo factura de prueba...</span>';
			
			const hoy = new Date();
			const yyyy = hoy.getFullYear();
			const mm = String(hoy.getMonth()+1).padStart(2,'0');
			const dd = String(hoy.getDate()).padStart(2,'0');
			
			// Preparar detalle para AFIP
			const detalle = itemsPrueba.map(item => ({
				descripcion: item.descripcion,
				cantidad: item.cantidad,
				precioUnitario: item.precioUnitario,
				alicuotaIva: item.alicuotaIva === -1 ? 0 : item.alicuotaIva // -1 = Exento se convierte a 0
			}));

			// Comprobantes asociados (si procede NC/ND)
			const comprobantesAsociados = (window as any).__cbtesAsoc || [];

			// Tomar punto de venta desde la configuración UI
			const ptoVtaUi = Number((document.getElementById('AFIP_PTO_VTA') as HTMLInputElement)?.value || 1);
			const res = await (window.api as any).facturacion?.emitir({
				pto_vta: ptoVtaUi,
				tipo_cbte: tipoCbte,
				concepto: concepto,
				doc_tipo: docTipo,
				mon_id: moneda,
				fecha: `${yyyy}${mm}${dd}`,
				cuit_emisor: '20123456789',
				cuit_receptor: cuitCliente,
				razon_social_receptor: razonSocial,
				condicion_iva_receptor: 'RI',
				neto: totalNeto,
				iva: totalIva,
				total: totalFinal,
				detalle: detalle,
				empresa: { nombre: 'TODO-COMPUTACIÓN', cuit: '20123456789' },
				plantilla: tipoCbte === 11 ? 'factura_c' : 'factura_a',
				// Nuevos campos
				FchServDesde,
				FchServHasta,
				FchVtoPago,
				comprobantesAsociados
			});

			if (res?.ok) {
				if (status) status.innerHTML = `<span class="text-green-400">✅ Factura emitida Nº ${res.numero} - CAE: ${res.cae}</span>`;
				showToast(`Factura de prueba emitida exitosamente - CAE: ${res.cae}`);
				// Mostrar observaciones si existen
				if (Array.isArray(res.observaciones) && res.observaciones.length > 0) {
					showToast(`Observaciones AFIP: ${JSON.stringify(res.observaciones)}`);
				}
				// Abrir PDF
				if (res.pdf_path) {
					await (window.api as any).facturacion?.abrirPdf(res.pdf_path);
				}
				// Limpiar formulario
				(document.getElementById('pruebaFacturaCuit') as HTMLInputElement).value = '';
				(document.getElementById('pruebaFacturaRazon') as HTMLInputElement).value = '';
				// Resetear configuración AFIP a valores por defecto
				(document.getElementById('pruebaFacturaTipoCbte') as HTMLSelectElement).value = '11';
				(document.getElementById('pruebaFacturaConcepto') as HTMLSelectElement).value = '1';
				(document.getElementById('pruebaFacturaDocTipo') as HTMLSelectElement).value = '80';
				(document.getElementById('pruebaFacturaMoneda') as HTMLSelectElement).value = 'PES';
				limpiarItemsPrueba();
				// Recargar listado
				cargarListadoFacturas();
			} else {
				if (status) status.innerHTML = `<span class=\"text-red-400\">❌ Error: ${res?.error || 'falló emisión'}</span>`;
				showToast(`Error en factura de prueba: ${res?.error || 'Error desconocido'}`);
			}
		} catch (e: any) {
			const status = document.getElementById('pruebaStatus');
			if (status) status.innerHTML = `<span class=\"text-red-400\">❌ Error: ${e?.message || e}</span>`;
			showToast(`Error: ${e?.message || e}`);
		}
	});
	
	// Verificar estado de servidores AFIP
	(document.getElementById('btnVerificarEstado') as HTMLButtonElement | null)?.addEventListener('click', async () => {
		try {
			const status = document.getElementById('pruebaStatus');
			if (status) status.innerHTML = '<span class="text-blue-400">🔄 Verificando estado de servidores AFIP...</span>';
			
			const res = await window.api['afip:check-server-status']();
			if (res?.ok) {
				const { appserver, dbserver, authserver } = res;
				if (status) {
					status.innerHTML = `
						<span class="text-green-400">✅ Estado de servidores AFIP:</span><br>
						<span class="text-xs">AppServer: ${appserver} | DbServer: ${dbserver} | AuthServer: ${authserver}</span>
					`;
				}
				showToast('Servidores AFIP: OK');
			} else {
				if (status) status.innerHTML = `<span class="text-red-400">❌ Error verificando estado: ${res?.error || 'Error desconocido'}</span>`;
				showToast(`Error: ${res?.error || 'Error verificando servidores'}`);
			}
		} catch (e: any) {
			const status = document.getElementById('pruebaStatus');
			if (status) status.innerHTML = `<span class="text-red-400">❌ Error: ${e?.message || e}</span>`;
			showToast(`Error: ${e?.message || e}`);
		}
	});
	
	// Validar certificado
	(document.getElementById('btnValidarCertificado') as HTMLButtonElement | null)?.addEventListener('click', async () => {
		try {
			const status = document.getElementById('pruebaStatus');
			if (status) status.innerHTML = '<span class="text-blue-400">🔄 Validando certificado AFIP...</span>';
			
			const res = await window.api['afip:validar-certificado']();
			if (res?.ok && res?.valido) {
				if (status) {
					status.innerHTML = `
						<span class="text-green-400">✅ Certificado válido</span><br>
						<span class="text-xs">Expira: ${res.fechaExpiracion} | Días restantes: ${res.diasRestantes}</span>
					`;
				}
				showToast(`Certificado válido - ${res.diasRestantes} días restantes`);
			} else {
				if (status) status.innerHTML = `<span class="text-red-400">❌ Certificado inválido: ${res?.error || 'Error desconocido'}</span>`;
				showToast(`Certificado inválido: ${res?.error || 'Error'}`);
			}
		} catch (e: any) {
			const status = document.getElementById('pruebaStatus');
			if (status) status.innerHTML = `<span class="text-red-400">❌ Error: ${e?.message || e}</span>`;
			showToast(`Error: ${e?.message || e}`);
		}
	});

	// ===== FIN PRUEBAS DE FACTURACIÓN =====

	// Inicializar valores por defecto de la configuración AFIP
	function inicializarValoresPorDefectoAFIP() {
		// Asegurar que los valores por defecto estén seleccionados
		const tipoCbteSelect = document.getElementById('pruebaFacturaTipoCbte') as HTMLSelectElement;
		const conceptoSelect = document.getElementById('pruebaFacturaConcepto') as HTMLSelectElement;
		const docTipoSelect = document.getElementById('pruebaFacturaDocTipo') as HTMLSelectElement;
		const monedaSelect = document.getElementById('pruebaFacturaMoneda') as HTMLSelectElement;
		
		if (tipoCbteSelect) tipoCbteSelect.value = '11';
		if (conceptoSelect) conceptoSelect.value = '1';
		if (docTipoSelect) docTipoSelect.value = '80';
		if (monedaSelect) monedaSelect.value = 'PES';
	}

	// Inicializar con items de ejemplo para pruebas
	setTimeout(() => {
		// Inicializar valores por defecto AFIP
		inicializarValoresPorDefectoAFIP();
		
		// Agregar algunos items de ejemplo
		agregarItemPrueba();
		agregarItemPrueba();
		agregarItemPrueba();
		
		// Configurar items de ejemplo
		if (itemsPrueba.length >= 3) {
			// Item 1: Producto con IVA 21%
			actualizarItemPrueba(itemsPrueba[0].id, 'descripcion', 'Mouse inalámbrico Logitech');
			actualizarItemPrueba(itemsPrueba[0].id, 'cantidad', 2);
			actualizarItemPrueba(itemsPrueba[0].id, 'precioUnitario', 1500);
			actualizarItemPrueba(itemsPrueba[0].id, 'alicuotaIva', 21);
			
			// Item 2: Servicio con IVA 21%
			actualizarItemPrueba(itemsPrueba[1].id, 'descripcion', 'Servicio de reparación PC');
			actualizarItemPrueba(itemsPrueba[1].id, 'cantidad', 1);
			actualizarItemPrueba(itemsPrueba[1].id, 'precioUnitario', 2500);
			actualizarItemPrueba(itemsPrueba[1].id, 'alicuotaIva', 21);
			
			// Item 3: Producto con IVA 10.5%
			actualizarItemPrueba(itemsPrueba[2].id, 'descripcion', 'Libro técnico informática');
			actualizarItemPrueba(itemsPrueba[2].id, 'cantidad', 1);
			actualizarItemPrueba(itemsPrueba[2].id, 'precioUnitario', 800);
			actualizarItemPrueba(itemsPrueba[2].id, 'alicuotaIva', 10.5);
		}
	}, 1000);

	// Mostrar/ocultar fechas de servicio según concepto
	(function serviceDatesToggle(){
		const sel = document.getElementById('pruebaFacturaConcepto') as HTMLSelectElement | null;
		const cont = document.getElementById('fechasServicioContainer') as HTMLDivElement | null;
		if (!sel || !cont) return;
		const update = () => {
			const v = parseInt(sel.value || '1');
			if (v === 2 || v === 3) cont.classList.remove('hidden'); else cont.classList.add('hidden');
		};
		sel.addEventListener('change', update);
		update();
	})();

	// Mostrar botón "Asociar Comprobante" si es NC/ND y abrir modal para seleccionar factura asociada
	(function asociarCbteToggle(){
		const sel = document.getElementById('pruebaFacturaTipoCbte') as HTMLSelectElement | null;
		const btn = document.getElementById('btnAsociarComprobante') as HTMLButtonElement | null;
		if (!sel || !btn) return;
		const isNota = (t: number) => [2,7,12,3,8,13].includes(t);
		const update = () => { const t = parseInt(sel.value||'0'); if (isNota(t)) btn.classList.remove('hidden'); else btn.classList.add('hidden'); };
		sel.addEventListener('change', update);
		update();
		(window as any).__cbtesAsoc = [];

		async function openAsociarModal() {
			// Crear modal en runtime (una sola vez)
			let modal = document.getElementById('modalAsocDyn') as HTMLDivElement | null;
			if (!modal) {
				modal = document.createElement('div');
				modal.id = 'modalAsocDyn';
				modal.className = 'fixed inset-0 bg-black/60 hidden items-center justify-center z-50';
				modal.innerHTML = `
					<div class="bg-slate-800 border border-slate-700 rounded-lg shadow-xl w-full max-w-3xl p-4">
						<div class="flex items-center justify-between mb-3">
							<h3 class="text-sm font-semibold">Asociar Comprobante</h3>
							<button type="button" id="modalAsocClose" class="px-2 py-1 text-xs rounded border border-slate-600 hover:bg-slate-700">✕</button>
						</div>
						<div class="flex items-center gap-2 mb-3">
							<input id="asocSearch" placeholder="Buscar por número o razón social..." class="flex-1 px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white" />
							<button type="button" id="asocRefresh" class="px-2 py-1 text-xs rounded border border-slate-600 hover:bg-slate-700">Refrescar</button>
						</div>
						<div class="max-h-80 overflow-auto">
							<table class="w-full text-xs">
								<thead>
									<tr class="text-left text-slate-400">
										<th class="py-1">Sel</th>
										<th class="py-1">Fecha</th>
										<th class="py-1">PtoVta</th>
										<th class="py-1">Tipo</th>
										<th class="py-1">Número</th>
										<th class="py-1">Receptor</th>
										<th class="py-1">Total</th>
									</tr>
								</thead>
								<tbody id="asocTbody"></tbody>
							</table>
						</div>
						<div class="flex items-center justify-end gap-2 mt-3">
							<span id="asocCount" class="text-xs text-slate-300"></span>
							<button type="button" id="asocConfirm" class="px-3 py-1.5 text-sm rounded-md bg-emerald-600 text-white border-0 hover:bg-emerald-500">Confirmar selección</button>
						</div>
					</div>
				`;
				document.body.appendChild(modal);
				modal.addEventListener('click', (e) => { if (e.target === modal) modal?.classList.add('hidden'); });
				modal.querySelector('#modalAsocClose')?.addEventListener('click', () => modal?.classList.add('hidden'));
			}

			function updateCountLabel(selCount: number) {
				const lbl = document.getElementById('asocCount');
				if (lbl) lbl.textContent = selCount > 0 ? `${selCount} seleccionado(s)` : '';
			}

			async function loadRows() {
				const res = await (window.api as any).facturacion?.listar({});
				const tbody = modal!.querySelector('#asocTbody') as HTMLTableSectionElement | null;
				if (!tbody) return;
				tbody.innerHTML = '';
				const rows = (res?.rows || []) as any[];
				const filter = (document.getElementById('asocSearch') as HTMLInputElement | null)?.value?.toLowerCase() || '';
				const selected: Array<{ Tipo: number; PtoVta: number; Nro: number }> = Array.isArray((window as any).__cbtesAsoc) ? (window as any).__cbtesAsoc : [];
				for (const r of rows) {
					const numeroTxt = String(r.numero || '').padStart(8,'0');
					const receptor = (r.razon_social_receptor || r.cuit_receptor || '').toLowerCase();
					if (filter && !(numeroTxt.includes(filter) || receptor.includes(filter))) continue;
					const tr = document.createElement('tr');
					tr.innerHTML = `
						<td class="py-1"><input type="checkbox" class="asocChk" data-tipo="${r.tipo_cbte}" data-pto="${r.pto_vta}" data-nro="${r.numero}"></td>
						<td class="py-1">${r.fecha || ''}</td>
						<td class="py-1">${r.pto_vta}</td>
						<td class="py-1">${r.tipo_cbte}</td>
						<td class="py-1">${numeroTxt}</td>
						<td class="py-1">${r.razon_social_receptor || r.cuit_receptor || ''}</td>
						<td class="py-1">$${Number(r.total).toFixed(2)}</td>
					`;
					tbody.appendChild(tr);
					const chk = tr.querySelector('.asocChk') as HTMLInputElement | null;
					if (chk) {
						const exists = selected.some(x => Number(x.Tipo) === Number(r.tipo_cbte) && Number(x.PtoVta) === Number(r.pto_vta) && Number(x.Nro) === Number(r.numero));
						chk.checked = exists;
						chk.addEventListener('change', () => {
							const selArr: Array<{ Tipo: number; PtoVta: number; Nro: number }> = Array.isArray((window as any).__cbtesAsoc) ? (window as any).__cbtesAsoc : [];
							const entry = { Tipo: Number(r.tipo_cbte), PtoVta: Number(r.pto_vta), Nro: Number(r.numero) };
							const idx = selArr.findIndex(x => x.Tipo === entry.Tipo && x.PtoVta === entry.PtoVta && x.Nro === entry.Nro);
							if (chk.checked) { if (idx === -1) selArr.push(entry); }
							else { if (idx >= 0) selArr.splice(idx, 1); }
							(window as any).__cbtesAsoc = selArr;
							updateCountLabel(selArr.length);
						});
					}
				}
				updateCountLabel(Array.isArray((window as any).__cbtesAsoc) ? (window as any).__cbtesAsoc.length : 0);
			}

			modal.classList.remove('hidden');
			await loadRows();
			modal.querySelector('#asocRefresh')?.addEventListener('click', loadRows);
			modal.querySelector('#asocSearch')?.addEventListener('input', loadRows);
			modal.querySelector('#asocConfirm')?.addEventListener('click', () => {
				const selArr: Array<{ Tipo: number; PtoVta: number; Nro: number }> = Array.isArray((window as any).__cbtesAsoc) ? (window as any).__cbtesAsoc : [];
				showToast(selArr.length > 0 ? `Se asociaron ${selArr.length} comprobante(s).` : 'No hay comprobantes asociados.');
				modal?.classList.add('hidden');
				const count = selArr.length;
				btn.textContent = count > 0 ? `Asociar Comprobante (${count})` : 'Asociar Comprobante';
			});
		}

		btn.addEventListener('click', openAsociarModal);
	})();

	// Filtrar tipos de comprobante visibles según condición IVA de empresa
	(async function filterCbteByCondEmpresa(){
		try {
			const r = await (window.api as any).facturacion?.empresaGet();
			const cond = String(r?.data?.condicion_iva || 'RI').toUpperCase();
			const sel = document.getElementById('pruebaFacturaTipoCbte') as HTMLSelectElement | null;
			if (!sel) return;
			const allowMono = new Set(['11','12','13']);
			const allowRI = new Set(['1','2','3','6','7','8','11','12','13']);
			Array.from(sel.options).forEach(opt => {
				const val = opt.value;
				const ok = (cond === 'MT' || cond === 'MONO') ? allowMono.has(val) : allowRI.has(val);
				(opt as any).style.display = ok ? '' : 'none';
				if (!ok && opt.selected) opt.selected = false;
			});
			// Si nada seleccionado, seleccionar el primero visible
			if (!sel.value) {
				for (const opt of Array.from(sel.options)) { if ((opt as any).style.display !== 'none') { opt.selected = true; break; } }
			}
		} catch {}
	})();

	// Botón: listar puntos de venta AFIP
	(document.getElementById('btnListPtosVta') as HTMLButtonElement | null)?.addEventListener('click', async () => {
		const outEl = document.getElementById('afipPtosVtaStatus') as HTMLPreElement | null;
		if (outEl) outEl.textContent = 'Consultando puntos de venta...';
		try {
			const res = await (window.api as any).facturacion?.listarPuntosDeVenta();
			if (res?.ok) {
				const list = Array.isArray(res.puntos) ? res.puntos : [];
				const pretty = JSON.stringify(list, null, 2);
				if (outEl) outEl.textContent = pretty || '[]';
			} else {
				if (outEl) outEl.textContent = `Error: ${res?.error || 'Fallo al listar puntos de venta'}`;
			}
		} catch (e: any) {
			if (outEl) outEl.textContent = `Error: ${e?.message || e}`;
		}
	});

	// Ajustes UI segun condicion IVA de empresa
	(async function tuneUiByEmpresaIVA(){
		try {
			const r = await (window.api as any).facturacion?.empresaGet();
			const cond = String(r?.data?.condicion_iva || 'RI').toUpperCase();
			const isMono = cond === 'MT' || cond === 'MONO';
			// Deshabilitar edición de IVA en items si MONO (alícuota 0)
			if (isMono) {
				const ivaInputs = document.querySelectorAll('#tablaItemsPrueba tbody select, #tablaItemsPrueba tbody input[name="alicuotaIva"]');
				ivaInputs.forEach((el: any) => { try { el.disabled = true; } catch {} });
			}
		} catch {}
	})();

	// Adaptar tipos por defecto según condición IVA de empresa
	(async function tuneParamTiposByEmpresa(){
		try {
			const r = await (window.api as any).facturacion?.empresaGet();
			const cond = String(r?.data?.condicion_iva || 'RI').toUpperCase();
			const sel = document.getElementById('FAC_TIPO_DEF') as HTMLSelectElement | null;
			if (!sel) return;
			const mono = (cond === 'MT' || cond === 'MONO');
			Array.from(sel.options).forEach(opt => {
				const v = opt.value;
				const isC = (v === 'FC' || v === 'NC_C' || v === 'RECIBO');
				const isAB = (v === 'FA' || v === 'FB' || v === 'NC');
				(opt as any).style.display = mono ? (isC ? '' : 'none') : (isAB || v === 'FC' || v === 'RECIBO' ? '' : 'none');
			});
			// Si selección actual no es válida, elegir la primera visible
			if ((sel as any).selectedIndex === -1 || (sel.options[sel.selectedIndex] as any).style.display === 'none') {
				for (const opt of Array.from(sel.options)) { if ((opt as any).style.display !== 'none') { (opt as any).selected = true; break; } }
			}
		} catch {}
	})();

	(document.getElementById('btnAfipClearTA') as HTMLButtonElement | null)?.addEventListener('click', async () => {
		const status = document.getElementById('pruebaStatus');
		if (status) status.textContent = 'Borrando TA y reiniciando sesión...';
		try {
			const res = await (window.api as any)['afip:clear-ta']();
			if (res?.ok) {
				if (status) status.textContent = 'TA borrado. Reinicia la emisión para generar nuevo token.';
				showToast('TA borrado / Relogin OK');
			} else {
				if (status) status.textContent = `Error borrando TA: ${res?.error || ''}`;
			}
		} catch (e: any) {
			if (status) status.textContent = `Error: ${e?.message || e}`;
		}
	});

});
