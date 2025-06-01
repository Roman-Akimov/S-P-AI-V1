const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url'); // Добавлен для формирования URL для продакшена
const isDev = require('electron-is-dev');
const mysql = require('mysql2/promise');

const dbConfig = {
    host: "localhost",
    user: "root",
    database: "AIDB",
    password: "qwerty"
};

let dbConnection;
let mainWindow;

async function connectToDB() {
    try {
        if (dbConnection && (dbConnection.connection._closing || dbConnection.connection._fatalError)) {
            console.log("MySQL connection is closing or has a fatal error, attempting to clear.");
            try { await dbConnection.end(); } catch (e) { /* ignore errors on close */ }
            dbConnection = null;
        }
        if (!dbConnection) {
            console.log("Attempting to create new MySQL connection...");
            dbConnection = await mysql.createConnection(dbConfig);
            console.log("Подключение к серверу MySQL успешно установлено (Main Process)");
        }
        await ensureTablesExist();
    } catch (err) {
        console.error("Ошибка подключения/проверки таблиц MySQL (Main Process): ", err);
        if (dbConnection) {
            try { await dbConnection.end(); } catch (e) { console.error("Error closing problematic DB connection:", e); }
        }
        dbConnection = null;
    }
}

async function ensureTablesExist() {
    if (!dbConnection) throw new Error("Нет соединения с БД для создания таблиц");
    try {
        await dbConnection.execute(`
            CREATE TABLE IF NOT EXISTS user_data (
                email VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255),
                ai_config JSON,
                categories JSON,
                schedules JSON,
                last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log("Таблица user_data проверена/создана.");
    } catch (error) {
        console.error("Ошибка при создании/проверке таблицы user_data:", error);
        throw error;
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // __dirname указывает на текущую папку (где main.js)
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false // Если preload.js требует доступ к fs или другим модулям Node, sandbox лучше false
        },
        // Установка иконки окна приложения
        // Предполагается, что иконка logotype.png лежит в корне проекта (рядом с main.js)
        // или в папке public для разработки и в корне build для продакшена.
        // Для Electron Builder иконки для дистрибутива настраиваются в package.json.
        // Эта иконка - для окна запущенного приложения.
        icon: path.join(__dirname, 'logotype.png') // Укажите правильный путь к вашей иконке окна
                                                   // Если иконка в папке assets: path.join(__dirname, 'assets', 'logotype.png')
    });

    // Определяем URL для загрузки
    const startUrl = isDev
        ? 'http://localhost:3000' // URL для React Dev Server
        : url.format({ // URL для собранного приложения
            pathname: path.join(__dirname, '../build/index.html'), // Путь к index.html после сборки React
            protocol: 'file:',
            slashes: true,
        });

    mainWindow.loadURL(startUrl);

    if (isDev) {
        mainWindow.webContents.openDevTools(); // Открывать DevTools только в режиме разработки
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(async () => {
    await connectToDB();
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', async () => {
    if (process.platform !== 'darwin') {
        if (dbConnection) {
            try {
                await dbConnection.end();
                console.log("Соединение с MySQL закрыто.");
            } catch (err) {
                console.error("Ошибка при закрытии соединения MySQL:", err.message);
            }
        }
        app.quit();
    }
});

// IPC обработчики (без изменений, они уже были корректны)
ipcMain.handle('get-user-data-path', async () => app.getPath('userData'));

ipcMain.handle('db-register-user', async (event, { email, name }) => {
    if (!dbConnection) { await connectToDB(); }
    if (!dbConnection) return { success: false, error: "Нет подключения к БД" };
    try {
        const [rows] = await dbConnection.execute('SELECT email FROM user_data WHERE email = ?', [email]);
        if (rows.length > 0) {
            if (name) {
                await dbConnection.execute('UPDATE user_data SET name = ? WHERE email = ?', [name, email]);
            }
            return { success: true, exists: true, message: "Пользователь уже существует." };
        } else {
            await dbConnection.execute('INSERT INTO user_data (email, name, ai_config, categories, schedules) VALUES (?, ?, ?, ?, ?)',
                [email, name, JSON.stringify({}), JSON.stringify([]), JSON.stringify([])]);
            return { success: true, exists: false, message: "Новый пользователь зарегистрирован в БД." };
        }
    } catch (error) {
        console.error("Ошибка регистрации пользователя в БД:", error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('db-load-user-all-data', async (event, email) => {
    if (!dbConnection) { await connectToDB(); }
    if (!dbConnection) return { success: false, error: "Нет подключения к БД", data: null };
    try {
        const [rows] = await dbConnection.execute(
            `SELECT name, ai_config, categories, schedules FROM user_data WHERE email = ?`,
            [email]
        );
        if (rows.length > 0) {
            const ud = rows[0];
            return {
                success: true,
                data: {
                    name: ud.name,
                    aiConfig: ud.ai_config,
                    categories: ud.categories,
                    schedules: ud.schedules
                }
            };
        }
        return { success: false, error: "Данные пользователя не найдены в БД.", data: null };
    } catch (error) {
        console.error("Ошибка загрузки данных пользователя из БД:", error);
        return { success: false, error: error.message, data: null };
    }
});

ipcMain.handle('db-save-user-all-data', async (event, { email, name, aiConfig, categories, schedules }) => {
    if (!dbConnection) { await connectToDB(); }
    if (!dbConnection) return { success: false, error: "Нет подключения к БД" };
    try {
        await dbConnection.execute(
            `INSERT INTO user_data (email, name, ai_config, categories, schedules) 
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
                name = VALUES(name), 
                ai_config = VALUES(ai_config), 
                categories = VALUES(categories), 
                schedules = VALUES(schedules),
                last_synced = CURRENT_TIMESTAMP`,
            [
                email,
                name,
                JSON.stringify(aiConfig || {}),
                JSON.stringify(categories || []),
                JSON.stringify(schedules || [])
            ]
        );
        return { success: true, message: "Данные пользователя синхронизированы с БД." };
    } catch (error) {
        console.error("Ошибка сохранения данных пользователя в БД:", error);
        return { success: false, error: error.message };
    }
});