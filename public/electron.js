const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const userDataPath = app.getPath('userData');

let win;

function createWindow() {
    win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // УКАЖИТЕ ВАШ ПРАВИЛЬНЫЙ ПУТЬ!
            contextIsolation: true, // Рекомендуется true
            sandbox: false,         // Позволяет require() в preload.js
            nodeIntegration: false, // Рекомендуется false
        },
    });
    win.loadURL('http://localhost:3000');
    // win.webContents.openDevTools(); // Для отладки
}

app.whenReady().then(() => {
    // ---> ОБЯЗАТЕЛЬНЫЙ ОБРАБОТЧИК ДЛЯ ВАШЕГО preload.js <---
    ipcMain.handle('get-user-data-path', () => {
        console.log('[Main Process] Handling get-user-data-path request.');
        return userDataPath; // Возвращаем путь
    });
    // -----------------------------------------------------

    // --- Обработчики IPC для файлов УДАЛЕНЫ, т.к. preload работает напрямую ---

    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });