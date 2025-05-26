// app.js
import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import CalendarComponent from './components/Calendar';
import UserProfile from './components/UserProfile';
import AiAssistant from './components/AiAssistant';
import RegistrationPage from './components/RegistrationPage';
import OnboardingQuestionnairePage from './components/OnboardingQuestionnairePage';
import './App.css';

// --- Иконки (замените на реальные SVG или из библиотеки, например, React Icons) ---
// Просто для примера, как можно было бы их вставить.
// import { FiGrid, FiCpu, FiUser, FiPlusCircle, FiArchive, FiInbox, FiStar, FiCalendar, FiSettings } from 'react-icons/fi';

const IconPlaceholder = ({ name, size = "1em", style = {} }) => (
    <span style={{ marginRight: '10px', fontSize: size, display: 'inline-block', ...style }} role="img" aria-label={`${name} icon`}>
        {/* Можно использовать SVG или символ. Для примера: */}
        {name === 'Calendar' && '🗓️'}
        {name === 'AI' && '🤖'}
        {name === 'Profile' && '⚙️'}
        {name === 'Plus' && '+'}
        {name === 'Inbox' && '📥'}
        {name === 'Today' && '⭐'}
        {name === 'Plans' && '📋'}
    </span>
);


// --- Начальные данные и константы ---
const INITIAL_CATEGORIES = [
    { id: 'cat-1', name: 'Работа', color: 'var(--app-accent-purple)', checked: true }, // Используем CSS переменные для цвета по умолчанию
    { id: 'cat-2', name: 'Личное', color: 'var(--app-accent-teal)', checked: true },
    { id: 'cat-3', name: 'Учеба', color: '#ffc107', checked: true }, // Можно оставить HEX или тоже заменить
];
const CATEGORIES_FILENAME = 'categories.json';
const SCHEDULES_FILENAME = 'schedules.json';
const PROFILE_CONFIG_FILENAME = 'profileConfig.json';
const USER_CREDENTIALS_FILENAME = 'userCredentials.json';

// --- Начальная структура анкеты ИИ (без изменений) ---
const INITIAL_AI_CONFIG = {
    workStartTime: '09:00',
    workEndTime: '18:00',
    preferredWorkDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    taskChunkingMinutes: 90,
    breakMinutes: 15,
    energyLevelByDayTime: { morning: 4, afternoon: 3, evening: 2, night: 1 },
    priorityWeights: { High: 3, Medium: 2, Low: 1, deadlineProximityDays: 3 },
    occupation: '',
    workScheduleText: '',
    commuteDistance: '',
    transportMode: '',
    peakProductivityTime: '',
    workStylePreference: 'с перерывами',
    readingSpeed: '',
    typingSpeed: '',
    concentrationLevel: 7,
    personalityType: '',
    educationBackground: '',
    personalPreferencesNotes: '',
};

const fileSystemApi = window.electronFs;
if (!fileSystemApi) {
    console.error("App.js: Electron FS API ('electronFs') is not available.");
}

function App() {
    const [categories, setCategories] = useState(INITIAL_CATEGORIES);
    const [schedules, setSchedules] = useState([]);
    const [aiConfig, setAiConfig] = useState(INITIAL_AI_CONFIG);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [userCredentials, setUserCredentials] = useState(null);
    const [isAiConfigLoadedFromFile, setIsAiConfigLoadedFromFile] = useState(false);

    // useEffect для загрузки данных (без изменений)
    useEffect(() => {
        const loadInitialData = async () => {
            if (!fileSystemApi) {
                setIsLoadingData(false);
                setCategories(INITIAL_CATEGORIES);
                setSchedules([]);
                setAiConfig(INITIAL_AI_CONFIG);
                setUserCredentials(null);
                setIsAiConfigLoadedFromFile(false);
                console.warn("App: FS API not found, using default data.");
                return;
            }
            setIsLoadingData(true);
            console.log('App: Loading all data...');
            try {
                await fileSystemApi.ensureDataDir();

                const loadedCredentials = await fileSystemApi.readFile(USER_CREDENTIALS_FILENAME);
                if (loadedCredentials && loadedCredentials.name && loadedCredentials.email) {
                    setUserCredentials(loadedCredentials);
                } else {
                    setUserCredentials(null);
                }

                const [loadedCategories, loadedSchedules, loadedProfileConfig] = await Promise.all([
                    fileSystemApi.readFile(CATEGORIES_FILENAME),
                    fileSystemApi.readFile(SCHEDULES_FILENAME),
                    fileSystemApi.readFile(PROFILE_CONFIG_FILENAME)
                ]);

                if (loadedCategories) {
                    // Применяем цвета из CSS переменных, если сохраненные категории их не имеют
                    const updatedCategories = loadedCategories.map(cat => ({
                        ...cat,
                        color: cat.color || (cat.name === 'Работа' ? 'var(--app-accent-purple)' : (cat.name === 'Личное' ? 'var(--app-accent-teal)' : '#ffc107'))
                    }));
                    setCategories(updatedCategories);
                } else {
                    setCategories(INITIAL_CATEGORIES);
                    fileSystemApi.writeFile(CATEGORIES_FILENAME, INITIAL_CATEGORIES).catch(e => console.error("App: Error saving initial categories", e));
                }

                setSchedules(loadedSchedules || []);

                if (loadedProfileConfig) {
                    setAiConfig(prev => ({ ...INITIAL_AI_CONFIG, ...loadedProfileConfig }));
                    setIsAiConfigLoadedFromFile(true);
                } else {
                    setAiConfig(INITIAL_AI_CONFIG);
                    setIsAiConfigLoadedFromFile(false);
                }

            } catch (error) {
                console.error('App: Failed to load data:', error);
                setCategories(INITIAL_CATEGORIES);
                setSchedules([]);
                setAiConfig(INITIAL_AI_CONFIG);
                setUserCredentials(null);
                setIsAiConfigLoadedFromFile(false);
            } finally {
                setIsLoadingData(false);
                console.log('App: Data loading finished.');
            }
        };
        loadInitialData();
    }, []);

    // --- Функции для обновления состояния (без изменений) ---
    const updateSchedules = useCallback((newSchedulesOrUpdater) => {
        setSchedules(prevSchedules =>
            typeof newSchedulesOrUpdater === 'function'
                ? newSchedulesOrUpdater(prevSchedules)
                : newSchedulesOrUpdater
        );
    }, []);

    const updateCategories = useCallback((newCategoriesOrUpdater) => {
        setCategories(prevCategories => {
            const updated = typeof newCategoriesOrUpdater === 'function'
                ? newCategoriesOrUpdater(prevCategories)
                : newCategoriesOrUpdater;
            // Обновляем цвета, если их нет или они не CSS переменные
            return updated.map(cat => ({
                ...cat,
                color: cat.color || (cat.name === 'Работа' ? 'var(--app-accent-purple)' : (cat.name === 'Личное' ? 'var(--app-accent-teal)' : '#ffc107'))
            }));
        });
    }, []);

    const updateAiConfig = useCallback((newAiConfigOrUpdater) => {
        setAiConfig(prevAiConfig => {
            const updatedConfig = typeof newAiConfigOrUpdater === 'function'
                ? newAiConfigOrUpdater(prevAiConfig)
                : newAiConfigOrUpdater;
            if (JSON.stringify(updatedConfig) !== JSON.stringify(INITIAL_AI_CONFIG)) {
                setIsAiConfigLoadedFromFile(true);
            }
            return updatedConfig;
        });
    }, []);

    const handleAddSchedules = useCallback((newSchedulesToAdd) => {
        if (!Array.isArray(newSchedulesToAdd)) {
            console.error("App: handleAddSchedules ожидал массив, получил:", newSchedulesToAdd);
            return;
        }
        if (newSchedulesToAdd.length === 0) return;
        setSchedules(prevSchedules => [...prevSchedules, ...newSchedulesToAdd]);
    }, []);

    // --- Эффекты для СОХРАНЕНИЯ данных (без изменений) ---
    useEffect(() => {
        if (isLoadingData || !fileSystemApi) return;
        fileSystemApi.writeFile(CATEGORIES_FILENAME, categories)
            .catch(error => console.error('App: Failed to save categories:', error));
    }, [categories, isLoadingData]);

    useEffect(() => {
        if (isLoadingData || !fileSystemApi) return;
        fileSystemApi.writeFile(SCHEDULES_FILENAME, schedules)
            .catch(error => console.error('App: Failed to save schedules:', error));
    }, [schedules, isLoadingData]);

    useEffect(() => {
        if (isLoadingData || !fileSystemApi || !isAiConfigLoadedFromFile) {
            if (!isAiConfigLoadedFromFile && !isLoadingData) {
                // console.log('App: AI config is initial or not loaded from file, skipping save.');
            }
            return;
        }
        fileSystemApi.writeFile(PROFILE_CONFIG_FILENAME, aiConfig)
            .catch(error => console.error('App: Failed to save AI config:', error));
    }, [aiConfig, isLoadingData, isAiConfigLoadedFromFile]);

    // --- Обработчики для регистрации и онбординга (без изменений) ---
    const handleRegistration = async (credentials) => {
        if (!fileSystemApi) {
            alert("Ошибка: Файловая система недоступна. Невозможно зарегистрироваться.");
            return;
        }
        try {
            await fileSystemApi.writeFile(USER_CREDENTIALS_FILENAME, credentials);
            setUserCredentials(credentials);
        } catch (error) {
            console.error("App: Failed to save user credentials", error);
            alert("Ошибка при сохранении данных регистрации.");
        }
    };

    const handleOnboardingComplete = async (newAiConfig) => {
        if (!fileSystemApi) {
            alert("Ошибка: Файловая система недоступна. Невозможно сохранить настройки.");
            return;
        }
        try {
            setAiConfig(newAiConfig);
            setIsAiConfigLoadedFromFile(true);
            await fileSystemApi.writeFile(PROFILE_CONFIG_FILENAME, newAiConfig);
            alert("Настройка AI-ассистента завершена!");
        } catch (error) {
            console.error("App: Failed to save AI config during onboarding", error);
            alert("Ошибка при сохранении настроек AI-ассистента.");
        }
    };

    // --- Логика рендеринга ---
    if (isLoadingData) {
        return <div className="loading-indicator">Загрузка данных...</div>;
    }

    if (!fileSystemApi) {
        return (
            <div className="app-error">
                Ошибка: Не удалось получить доступ к файловой системе...
            </div>
        );
    }

    if (!userCredentials) {
        return <RegistrationPage onRegister={handleRegistration} />;
    }

    if (!isAiConfigLoadedFromFile) {
        return (
            <OnboardingQuestionnairePage
                initialConfig={aiConfig}
                onComplete={handleOnboardingComplete}
                userName={userCredentials.name}
            />
        );
    }

    // Основное приложение
    return (
        <Router>
            <div className="app-container">
                <nav className="app-sidebar">
                    <div className="sidebar-brand">
                        Какаой-то APP
                    </div>

                    <ul className="sidebar-main-nav">
                        <li>
                            <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                                <IconPlaceholder name="Calendar" /> Календарь
                            </NavLink>
                        </li>
                        <li> {/* AI Ассистент как одна из основных функций */}
                            <NavLink to="/ai" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                                <IconPlaceholder name="AI" /> AI Ассистент
                            </NavLink>
                        </li>
                    </ul>

                    <div className="sidebar-section-title">Мои проекты</div>
                    <ul className="sidebar-projects-nav">
                        {categories.map(category => (
                            <li key={category.id}>
                                <a
                                    href="#"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        // TODO: Возможно, в будущем здесь будет логика фильтрации календаря по категории
                                        console.log("Clicked category:", category.name);
                                    }}
                                    className="nav-link"
                                >
                                    <span className="category-dot" style={{ backgroundColor: category.color }}></span>
                                    {category.name}
                                </a>
                            </li>
                        ))}
                        <li>
                            <a
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    // TODO: Логика добавления нового проекта/категории
                                    alert("Функция 'Новый проект' еще не реализована.");
                                }}
                                className="nav-link"
                            >
                                <IconPlaceholder name="Plus" /> Новый проект
                            </a>
                        </li>
                    </ul>

                    {/* Место для других секций из SingularityApp, если понадобится: "Без проекта", "Когда-нибудь", "Архив", "Корзина" */}
                    {/* Например:
                    <div className="sidebar-section-title">Системные</div>
                    <ul className="sidebar-system-nav">
                        <li><a href="#" className="nav-link"><IconPlaceholder name="NoProject"/>Без проекта</a></li>
                        <li><a href="#" className="nav-link"><IconPlaceholder name="Archive"/>Архив</a></li>
                    </ul>
                    */}

                    <ul className="sidebar-footer-nav">
                        <li>
                            <NavLink to="/profile" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                                <IconPlaceholder name="Profile" />
                                {/* Текст "Профиль", но будет выглядеть как "Настройки" из-за положения */}
                                Профиль
                            </NavLink>
                        </li>
                    </ul>
                </nav>

                <main className="app-content">
                    <Routes>
                        <Route
                            path="/"
                            element={
                                <CalendarComponent
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
                                    currentAiConfig={aiConfig}
                                    onAiConfigChange={updateAiConfig}
                                    userCredentials={userCredentials}
                                />
                            }
                        />
                        <Route
                            path="/ai"
                            element={
                                <AiAssistant
                                    aiConfig={aiConfig}
                                    categories={categories}
                                    onAddSchedules={handleAddSchedules}
                                />
                            }
                        />
                        {/* Маршруты для "Inbox", "Today", "Plans" если будете их добавлять */}
                        {/* <Route path="/inbox" element={<div>Входящие (не реализовано)</div>} /> */}
                        {/* <Route path="/today" element={<div>Сегодня (не реализовано)</div>} /> */}
                        {/* <Route path="/plans" element={<div>Планы (не реализовано)</div>} /> */}
                        <Route path="*" element={<div>Страница не найдена (404)</div>} />
                    </Routes>
                </main>
            </div>
        </Router>
    );
}

export default App;