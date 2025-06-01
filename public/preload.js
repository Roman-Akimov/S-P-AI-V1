// preload.js
const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs').promises; // Оставляем для файловой системы
const path = require('path');    // Оставляем для файловой системы
const fse = require('fs-extra'); // Оставляем для файловой системы

let cachedUserDataPath = null;

async function getUserDataPathInternal() {
    if (!cachedUserDataPath) {
        try {
            cachedUserDataPath = await ipcRenderer.invoke('get-user-data-path');
            if (!cachedUserDataPath) throw new Error("User data path from main is null/undefined");
        } catch (err) {
            console.error("[Preload] Failed to get user data path:", err);
            throw err;
        }
    }
    return cachedUserDataPath;
}

const fileSystemApiDefinition = {
    ensureDataDir: async () => fse.ensureDir(await getUserDataPathInternal()),
    readFile: async (filename) => {
        const filePath = path.join(await getUserDataPathInternal(), filename);
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') return null;
            throw error;
        }
    },
    writeFile: async (filename, data) => {
        const filePath = path.join(await getUserDataPathInternal(), filename);
        await fse.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }
};

// Новый API для базы данных
const dbApiDefinition = {
    registerUser: (email, name) => ipcRenderer.invoke('db-register-user', { email, name }),
    loadUserAllData: (email) => ipcRenderer.invoke('db-load-user-all-data', email),
    saveUserAllData: (data) => ipcRenderer.invoke('db-save-user-all-data', data) // data: { email, name, aiConfig, categories, schedules }
};

if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electronFs', fileSystemApiDefinition);
        contextBridge.exposeInMainWorld('dbApi', dbApiDefinition); // Добавляем новый API
        console.log('[Preload] electronFs and dbApi exposed via contextBridge.');
    } catch (error) {
        console.error('[Preload] Failed to expose APIs via contextBridge:', error);
    }
} else {
    window.electronFs = fileSystemApiDefinition;
    window.dbApi = dbApiDefinition; // Добавляем новый API
    console.warn('[Preload] contextIsolation is disabled! Exposed APIs directly to window (unsafe).');
}