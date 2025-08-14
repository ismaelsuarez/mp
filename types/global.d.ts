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
	}
}

export {};
