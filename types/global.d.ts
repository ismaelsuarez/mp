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
	}
}

export {};
