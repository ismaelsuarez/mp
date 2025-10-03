import Store from 'electron-store';

// 🌐 Instancia GLOBAL de electron-store (única para toda la app)
let globalStore: Store | null = null;

export function initGlobalStore(storeInstance?: Store): Store {
	if (storeInstance) {
		globalStore = storeInstance;
		return storeInstance;
	}
	if (!globalStore) {
		globalStore = new Store();
	}
	return globalStore;
}

export function getGlobalStore(): Store {
	if (!globalStore) {
		throw new Error('Global store not initialized. Call initGlobalStore() first.');
	}
	return globalStore;
}

