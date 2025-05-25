import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import CalendarComponent from './components/Calendar'; // Путь к вашему CalendarComponent
import UserProfile from './components/UserProfile';       // Путь к вашему UserProfile
import AiAssistant from './components/AiAssistant';       // Путь к НОВОМУ AiAssistant
import './App.css'; // Ваши основные стили

// --- Начальные данные и константы ---
const INITIAL_CATEGORIES = [
    { id: 'cat-1', name: 'Работа', color: '#00a9ff', checked: true },
    { id: 'cat-2', name: 'Личное', color: '#03bd9e', checked: true },
    { id: 'cat-3', name: 'Учеба', color: '#ffc107', checked: true },
];
const CATEGORIES_FILENAME = 'categories.json';
const SCHEDULES_FILENAME = 'schedules.json';
const PROFILE_CONFIG_FILENAME = 'profileConfig.json';

// --- Начальная структура анкеты ИИ (важно иметь здесь для дефолта) ---
const INITIAL_AI_CONFIG = {
    workStartTime: '09:00',
    workEndTime: '18:00',
    preferredWorkDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    taskChunkingMinutes: 90,
    breakMinutes: 15,
    energyLevelByDayTime: { morning: 4, afternoon: 3, evening: 2, night: 1 },
    priorityWeights: { High: 3, Medium: 2, Low: 1, deadlineProximityDays: 3 },
};

// --- API Файловой системы ---
const fileSystemApi = window.electronFs;
if (!fileSystemApi) {
    console.error("App.js: Electron FS API ('electronFs') is not available.");
    // Можно показать глобальное сообщение об ошибке или заглушку
    // alert("Ошибка: Не удалось подключиться к файловой системе. Функциональность будет ограничена.");
}

function App() {
    // --- Поднятые состояния ---
    const [categories, setCategories] = useState(INITIAL_CATEGORIES);
    const [schedules, setSchedules] = useState([]);
    const [aiConfig, setAiConfig] = useState(INITIAL_AI_CONFIG); // <-- ДОБАВЛЕНО состояние для конфига AI
    const [isLoadingData, setIsLoadingData] = useState(true); // Состояние загрузки данных

    // --- Эффект для ЗАГРУЗКИ ВСЕХ данных при монтировании ---
    useEffect(() => {
        const loadAllData = async () => {
            if (!fileSystemApi) {
                setIsLoadingData(false);
                // Устанавливаем дефолтные значения, если ФС недоступна
                setCategories(INITIAL_CATEGORIES);
                setSchedules([]);
                setAiConfig(INITIAL_AI_CONFIG);
                console.warn("App: FS API not found, using default data.");
                return;
            }
            setIsLoadingData(true);
            console.log('App: Loading all data...');
            try {
                await fileSystemApi.ensureDataDir(); // Убедимся, что папка есть

                // Параллельная загрузка всех трех файлов
                const [loadedCategories, loadedSchedules, loadedAiConfig] = await Promise.all([
                    fileSystemApi.readFile(CATEGORIES_FILENAME),
                    fileSystemApi.readFile(SCHEDULES_FILENAME),
                    fileSystemApi.readFile(PROFILE_CONFIG_FILENAME) // <-- ДОБАВЛЕНО чтение конфига AI
                ]);

                // Загружаем категории
                if (loadedCategories) {
                    console.log('App: Categories loaded.');
                    setCategories(loadedCategories);
                } else {
                    console.log('App: No saved categories found, using initial and saving them.');
                    setCategories(INITIAL_CATEGORIES);
                    fileSystemApi.writeFile(CATEGORIES_FILENAME, INITIAL_CATEGORIES).catch(e => console.error("App: Error saving initial categories", e));
                }

                // Загружаем расписания
                if (loadedSchedules) {
                    console.log('App: Schedules loaded.');
                    setSchedules(loadedSchedules);
                } else {
                    console.log('App: No saved schedules found.');
                    setSchedules([]);
                }

                // Загружаем конфиг AI <-- ДОБАВЛЕНА обработка
                if (loadedAiConfig) {
                    console.log('App: AI config loaded.');
                    // Мержим с дефолтным, чтобы добавить новые поля, если они появились в INITIAL_AI_CONFIG
                    setAiConfig(prev => ({ ...INITIAL_AI_CONFIG, ...loadedAiConfig }));
                } else {
                    console.log('App: No saved AI config found, using initial.');
                    setAiConfig(INITIAL_AI_CONFIG);
                    // Можно опционально сохранить дефолтный конфиг при первом запуске
                    // fileSystemApi.writeFile(PROFILE_CONFIG_FILENAME, INITIAL_AI_CONFIG).catch(e => console.error("App: Error saving initial AI config", e));
                }

            } catch (error) {
                console.error('App: Failed to load data:', error);
                // В случае ошибки загрузки используем дефолтные значения
                setCategories(INITIAL_CATEGORIES);
                setSchedules([]);
                setAiConfig(INITIAL_AI_CONFIG); // <-- Устанавливаем дефолт при ошибке
            } finally {
                setIsLoadingData(false);
                console.log('App: Data loading finished.');
            }
        };
        loadAllData();
    }, []); // Пустой массив зависимостей - загрузка один раз при монтировании

    // --- Функции для обновления состояния из дочерних компонентов ---
    const updateSchedules = useCallback((newSchedulesOrUpdater) => {
        setSchedules(prevSchedules =>
            typeof newSchedulesOrUpdater === 'function'
                ? newSchedulesOrUpdater(prevSchedules)
                : newSchedulesOrUpdater
        );
    }, []);

    const updateCategories = useCallback((newCategoriesOrUpdater) => {
        setCategories(prevCategories =>
            typeof newCategoriesOrUpdater === 'function'
                ? newCategoriesOrUpdater(prevCategories)
                : newCategoriesOrUpdater
        );
    }, []);

    // <-- ДОБАВЛЕНА функция обновления конфига AI -->
    const updateAiConfig = useCallback((newAiConfigOrUpdater) => {
        setAiConfig(prevAiConfig =>
            typeof newAiConfigOrUpdater === 'function'
                ? newAiConfigOrUpdater(prevAiConfig)
                : newAiConfigOrUpdater
        );
    }, []);

    // <-- ДОБАВЛЕНА функция добавления задач (из AI Assistant) -->
    const handleAddSchedules = useCallback((newSchedulesToAdd) => {
        if (!Array.isArray(newSchedulesToAdd)) {
            console.error("App: handleAddSchedules ожидал массив, получил:", newSchedulesToAdd);
            return;
        }
        if (newSchedulesToAdd.length === 0) {
            console.log("App: handleAddSchedules - нет задач для добавления.");
            return;
        }
        console.log("App: Adding schedules from AI:", newSchedulesToAdd);
        // Просто добавляем новые задачи в конец существующего списка
        setSchedules(prevSchedules => [...prevSchedules, ...newSchedulesToAdd]);
    }, []); // Нет внешних зависимостей, использует setState с функцией

    // --- Эффекты для СОХРАНЕНИЯ данных при их изменении ---
    useEffect(() => {
        if (isLoadingData || !fileSystemApi) return;
        console.log('App: Saving categories...');
        fileSystemApi.writeFile(CATEGORIES_FILENAME, categories)
            .catch(error => console.error('App: Failed to save categories:', error));
    }, [categories, isLoadingData]);

    useEffect(() => {
        if (isLoadingData || !fileSystemApi) return;
        console.log('App: Saving schedules...');
        fileSystemApi.writeFile(SCHEDULES_FILENAME, schedules)
            .catch(error => console.error('App: Failed to save schedules:', error));
    }, [schedules, isLoadingData]);

    // <-- ДОБАВЛЕН эффект сохранения конфига AI -->
    useEffect(() => {
        if (isLoadingData || !fileSystemApi) return;
        // Простая проверка, чтобы не сохранять самый первый дефолтный конфиг, если он не менялся
        // Можно убрать эту проверку, если нужно сохранять всегда
        if (JSON.stringify(aiConfig) !== JSON.stringify(INITIAL_AI_CONFIG)) {
            console.log('App: Saving AI config...');
            fileSystemApi.writeFile(PROFILE_CONFIG_FILENAME, aiConfig)
                .catch(error => console.error('App: Failed to save AI config:', error));
        } else {
            console.log('App: AI config hasn\'t changed from initial, skipping save.');
        }
    }, [aiConfig, isLoadingData]);

    return (
        <Router>
            <div className="app-container">
                {/* Навигационная панель */}
                <nav className="app-nav">
                    <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        Календарь
                    </NavLink>
                    <NavLink to="/profile" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        Профиль
                    </NavLink>
                    {/* <-- ДОБАВЛЕНА ссылка на AI Ассистента --> */}
                    <NavLink to="/ai" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        AI Ассистент
                    </NavLink>
                </nav>

                {/* Основной контент приложения */}
                <main className="app-content">
                    {isLoadingData ? (
                        <div className="loading-indicator">Загрузка данных...</div>
                    ) : !fileSystemApi ? ( // <-- ДОБАВЛЕНА проверка на доступность API после загрузки
                        <div className="app-error">
                            Ошибка: Не удалось получить доступ к файловой системе.
                            Проверьте настройки Electron и preload скрипт.
                            Работа приложения будет ограничена.
                        </div>
                    ) : (
                        <Routes>
                            <Route
                                path="/"
                                element={
                                    <CalendarComponent
                                        // Передаем актуальные данные и функции обновления
                                        // Замените initial... на прямые пропсы, если CalendarComponent
                                        // ожидает актуальные данные, а не только начальные
                                        categories={categories}
                                        schedules={schedules}
                                        onCategoriesChange={updateCategories}
                                        onSchedulesChange={updateSchedules}
                                    />
                                }
                            />
                            <Route
                                path="/profile"
                                element={
                                    <UserProfile
                                        schedules={schedules}
                                        categories={categories}
                                        // Передаем конфиг AI и функцию для его обновления
                                        initialAiConfig={aiConfig} // Переименуйте проп в UserProfile, если нужно
                                        onAiConfigChange={updateAiConfig} // Передаем колбэк
                                    />
                                }
                            />
                            {/* <-- ДОБАВЛЕН маршрут для AI Ассистента --> */}
                            <Route
                                path="/ai"
                                element={
                                    <AiAssistant
                                        // Передаем необходимые данные и колбэки
                                        aiConfig={aiConfig}
                                        categories={categories}
                                        onAddSchedules={handleAddSchedules}
                                    />
                                }
                            />
                            {/* Маршрут по умолчанию или 404 */}
                            <Route path="*" element={<div>Страница не найдена (404)</div>} />
                        </Routes>
                    )}
                </main>
            </div>
        </Router>
    );
}

export default App;