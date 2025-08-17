declare global {
	interface Window {
		api: {
			getConfig(): Promise<any>;
			saveConfig(cfg: any): Promise<any>;
			generateReport(): Promise<any>;
			exportReport(): Promise<any>;
			sendReportEmail(): Promise<any>;
			testFtpConnection(): Promise<any>;
			sendDbfViaFtp(): Promise<any>;
			autoStart?(): Promise<any>;
			autoStop?(): Promise<any>;
			autoStatus?(): Promise<any>;
			pauseAuto?(): Promise<any>;
			resumeAuto?(): Promise<any>;
			getAutoTimer?(): Promise<any>;
			onAutoNotice?(callback: (payload: any) => void): void;
			onAutoTimerUpdate?(callback: (payload: any) => void): void;
			testConnection(): Promise<any>;
			openOutDir(): Promise<any>;
			openTodayLog(): Promise<any>;
			listHistory(): Promise<any>;
			openView(view: 'config' | 'caja'): Promise<any>;
			setWindowSize(width: number, height: number): Promise<any>;
			getAppVersion(): Promise<{ version: string }>;
			getReleaseNotes(): Promise<{ ok: boolean; path?: string; content?: string; error?: string }>;
			// Error Notifications
			getErrorNotificationConfig(): Promise<{
				enabled: boolean;
				minErrorsBeforeNotify: number;
				minTimeBetweenNotifications: number;
				maxNotificationsPerError: number;
			}>;
			updateErrorNotificationConfig(config: any): Promise<{ ok: boolean; error?: string }>;
			getErrorNotificationSummary(): Promise<{
				totalErrors: number;
				activeGroups: number;
				notificationsSent: number;
			}>;
			clearOldErrors(hours?: number): Promise<{ ok: boolean; error?: string }>;
			resetErrorNotifications(): Promise<{ ok: boolean; error?: string }>;
		};
		auth: {
			isInitialized(): Promise<boolean>;
			getPolicy(): Promise<any>;
			setup(data: { username: string; password: string; secretPhrase: string }): Promise<void>;
			login(creds: { username: string; password: string }): Promise<{ ok: boolean; reason?: string; unlockAt?: number }>;
			change(data: { current: string; newPw: string; newUser?: string; newSecret?: string }): Promise<void>;
			requestOtp(): Promise<{ masked: string; ttl: number }>;
			resetByOtp(data: { otp: string; newPw: string }): Promise<void>;
			resetBySecret(data: { secretPhrase: string; newPw: string; newUser?: string }): Promise<void>;
			openConfig(): Promise<any>;
		};
		license: {
			status(): Promise<{ ok: boolean }>;
			validate(nombreCliente: string, palabraSecreta: string, serial: string): Promise<{ ok: boolean }>;
			save(payload: { nombreCliente: string; serial: string; palabraSecreta: string }): Promise<{ ok: boolean; error?: string }>;
			load(): Promise<{ ok: boolean; data?: { nombreCliente: string; serial: string; palabraSecreta: string }; error?: string }>;
			recover(nombreCliente: string, palabraSecreta: string): Promise<{ ok: boolean; serial?: string; error?: string }>;
			openHome(): Promise<{ ok: boolean; error?: string }>;
		};
	}
}

export {};
