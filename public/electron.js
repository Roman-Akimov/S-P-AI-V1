const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const userDataPath = app.getPath('userData');

let win;

function createWindow() {
    win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            sandbox: false,
            nodeIntegration: false,
        },
    });
    win.loadURL('http://localhost:3000');
}

app.whenReady().then(() => {
    ipcMain.handle('get-user-data-path', () => {
        console.log('[Main Process] Handling get-user-data-path request.');
        return userDataPath; // Возвращаем путь
    });
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });