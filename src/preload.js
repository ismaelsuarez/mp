const { contextBridge } = require('electron');
const Store = require('electron-store');

const store = new Store({ name: 'settings' });

contextBridge.exposeInMainWorld('api', {
	save(key, value) {
		store.set(key, value);
		return true;
	},
	read(key) {
		return store.get(key);
	},
	readAll() {
		return store.store;
	}
});


