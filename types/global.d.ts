declare global {
	interface Window {
		api: {
			getConfig(): Promise<any>;
			saveConfig(cfg: any): Promise<any>;
			generateReport(): Promise<any>;
			exportReport(): Promise<any>;
			sendReportEmail(): Promise<any>;
			onAutoNotice?(callback: (payload: any) => void): void;
			testConnection(): Promise<any>;
			openOutDir(): Promise<any>;
			listHistory(): Promise<any>;
		};
	}
}

export {};
