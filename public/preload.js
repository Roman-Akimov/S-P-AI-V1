// preload.js (Revised for sandbox: false and timing issues)
const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const fse = require('fs-extra');

let userDataPath = null; // Кэш для пути

// Асинхронная функция для получения/кэширования пути
async function getUserDataPath() {
    if (!userDataPath) {
        try {
            console.log('[Preload] Requesting user data path via IPC...');
            userDataPath = await ipcRenderer.invoke('get-user-data-path');
            if (!userDataPath) {
                throw new Error("Main process returned null/undefined user data path");
            }
            console.log('[Preload] User data path received:', userDataPath);
        } catch (err) {
            console.error("[Preload] Failed to get user data path:", err);
            // Пробрасываем ошибку, чтобы операции с файлами не выполнялись без пути
            throw err;
        }
    }
    return userDataPath;
}

// Сразу определяем API, которое будет экспортировано
const fileSystemApiDefinition = {
    async ensureDataDir() {
        const dir = await getUserDataPath(); // Получаем путь при вызове
        console.log('[electronFs API] ensureDataDir called for:', dir);
        await fse.ensureDir(dir);
        console.log('[electronFs API] ensureDataDir finished.');
    },
    async readFile(filename) {
        const dir = await getUserDataPath();
        const filePath = path.join(dir, filename);
        console.log('[electronFs API] readFile called for:', filePath);
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            console.log(`[electronFs API] readFile ${filename} success.`);
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log(`[electronFs API] readFile: File ${filename} not found.`);
                return null; // Файл не найден - это нормально
            }
            console.error(`[electronFs API] Error reading file ${filename}:`, error);
            throw error; // Другие ошибки пробрасываем
        }
    },
    async writeFile(filename, data) {
        const dir = await getUserDataPath();
        const filePath = path.join(dir, filename);
        console.log('[electronFs API] writeFile called for:', filePath);
        try {
            await fse.ensureDir(dir); // Гарантируем наличие папки перед записью
            await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
            console.log(`[electronFs API] writeFile ${filename} success.`);
        } catch (error) {
            console.error(`[electronFs API] Error writing file ${filename}:`, error);
            throw error;
        }
    }
};

// Экспонируем API через contextBridge, если изоляция включена
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electronFs', fileSystemApiDefinition);
        console.log('[Preload] electronFs API exposed via contextBridge.');
    } catch (error) {
        console.error('[Preload] Failed to expose electronFs API via contextBridge:', error);
    }
} else {
    // ВАЖНО: Если contextIsolation ОТКЛЮЧЕН (contextIsolation: false в main.js)
    // и sandbox: false, можно добавить напрямую, НО ЭТО ОЧЕНЬ НЕ РЕКОМЕНДУЕТСЯ.
    console.warn('[Preload] contextIsolation is disabled! Exposing API directly to window (unsafe).');
    window.electronFs = fileSystemApiDefinition;
}