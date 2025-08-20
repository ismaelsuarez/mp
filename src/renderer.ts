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
		'DEFAULT_VIEW',
		// FTP Server (admin)
		'FTP_SRV_HOST','FTP_SRV_PORT','FTP_SRV_USER','FTP_SRV_PASS','FTP_SRV_ROOT','FTP_SRV_ENABLED'
		,'FTP_SRV_PASV_HOST','FTP_SRV_PASV_MIN','FTP_SRV_PASV_MAX'
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
			FTP_SRV_PASV_MAX: (el.FTP_SRV_PASV_MAX as HTMLInputElement)?.value ? Number((el.FTP_SRV_PASV_MAX as HTMLInputElement).value) : undefined
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
	}

	function renderPreview(cfg: any) {
		const safe = { ...cfg } as any;
		if (safe.MP_ACCESS_TOKEN) safe.MP_ACCESS_TOKEN = '********';
		if (safe.SMTP_PASS) safe.SMTP_PASS = '********';
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
});
