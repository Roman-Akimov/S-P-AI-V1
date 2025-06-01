// App.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import CalendarComponent from './components/Calendar';
import UserProfile from './components/UserProfile';
import AiAssistant from './components/AiAssistant';
import RegistrationPage from './components/RegistrationPage';
import OnboardingQuestionnairePage from './components/OnboardingQuestionnairePage';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

const IconPlaceholder = ({ name, size = "1em", style = {}, onClick, title, className }) => (
    <span
        className={className}
        style={{
            fontSize: size,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: onClick ? 'pointer' : 'default',
            lineHeight: 1,
            ...style
        }}
        role={onClick ? "button" : "img"}
        aria-label={`${name} icon`}
        onClick={onClick}
        title={title}
        tabIndex={onClick ? 0 : undefined}
        onKeyPress={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); }} : undefined}
    >
        {name === 'Calendar' && '🗓️'}
        {name === 'AI' && '🤖'}
        {name === 'Profile' && '⚙️'}
        {name === 'Plus' && '+'}
        {name === 'Trash' && '🗑️'}
        {name === 'Check' && '✔️'}
        {name === 'Cross' && '❌'}
    </span>
);


const INITIAL_CATEGORIES = [
    { id: 'cat-1', name: 'Работа', color: 'var(--app-accent-purple)', checked: true },
    { id: 'cat-2', name: 'Личное', color: 'var(--app-accent-teal)', checked: true },
    { id: 'cat-3', name: 'Учеба', color: '#ffc107', checked: true },
];
const CATEGORIES_FILENAME = 'categories.json';
const SCHEDULES_FILENAME = 'schedules.json';
const PROFILE_CONFIG_FILENAME = 'profileConfig.json';
const USER_CREDENTIALS_FILENAME = 'userCredentials.json';

const INITIAL_AI_CONFIG = {
    workStartTime: '09:00', workEndTime: '18:00', preferredWorkDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    taskChunkingMinutes: 90, breakMinutes: 15,
    energyLevelByDayTime: { morning: 4, afternoon: 3, evening: 2, night: 1 },
    priorityWeights: { High: 3, Medium: 2, Low: 1, deadlineProximityDays: 3 },
    occupation: '', workScheduleText: '', commuteDistance: '', transportMode: '',
    peakProductivityTime: '', workStylePreference: 'с перерывами', readingSpeed: '',
    typingSpeed: '', concentrationLevel: 7, personalityType: '', educationBackground: '',
    personalPreferencesNotes: '',
};

const fileSystemApi = window.electronFs;
const dbApi = window.dbApi;

if (!fileSystemApi) { console.error("App.js: Electron FS API ('electronFs') is not available."); }
if (!dbApi) { console.error("App.js: Electron DB API ('dbApi') is not available."); }

const DEFAULT_NEW_CATEGORY_COLOR = '#7D8590';


function App() {
    const [categories, setCategories] = useState(() => INITIAL_CATEGORIES.map(c => ({...c, checked: c.checked !== undefined ? c.checked : true})));
    const [schedules, setSchedules] = useState([]);
    const [aiConfig, setAiConfig] = useState(INITIAL_AI_CONFIG);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [userCredentials, setUserCredentials] = useState(null);
    const [isAiConfigLoaded, setIsAiConfigLoaded] = useState(false);
    const [isOnlineMode, setIsOnlineMode] = useState(false);

    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryNameInput, setNewCategoryNameInput] = useState('');
    const [newCategoryColorInput, setNewCategoryColorInput] = useState(DEFAULT_NEW_CATEGORY_COLOR);
    const newCategoryNameInputRef = useRef(null);
    const [addCategoryError, setAddCategoryError] = useState('');

    const notifySuccess = (message) => toast.success(message);
    const notifyError = (message) => toast.error(message);
    const notifyInfo = (message) => toast.info(message);
    const notifyWarning = (message) => toast.warn(message);

    useEffect(() => {
        const loadInitialData = async () => {
            setIsLoadingData(true);
            let finalAiConfig = null;
            let finalCategories = null;
            let finalSchedules = null;
            let finalCredentials = null;
            let aiConfigActuallyLoaded = false;
            let onlineModeActivated = false;

            if (fileSystemApi) {
                try {
                    await fileSystemApi.ensureDataDir();
                    finalCredentials = await fileSystemApi.readFile(USER_CREDENTIALS_FILENAME);
                } catch (e) { console.error("Error reading local credentials file:", e); }
            } else {
                console.warn("FileSystemAPI is not available. Local data persistence will be disabled.");
            }

            if (finalCredentials && finalCredentials.email && finalCredentials.name) {
                if (dbApi) {
                    console.log(`Attempting to load all data from DB for ${finalCredentials.email}`);
                    try {
                        const dbLoadResult = await dbApi.loadUserAllData(finalCredentials.email);
                        if (dbLoadResult.success && dbLoadResult.data) {
                            console.log("Successfully loaded data from DB:", dbLoadResult.data);
                            const { aiConfig: dbAiConfig, categories: dbCategories, schedules: dbSchedules } = dbLoadResult.data;

                            if (dbAiConfig && Object.keys(dbAiConfig).length > 0) {
                                finalAiConfig = { ...INITIAL_AI_CONFIG, ...dbAiConfig };
                                aiConfigActuallyLoaded = true;
                            }
                            if (dbCategories) {
                                finalCategories = dbCategories.map(c => ({...c, checked: c.checked !== undefined ? c.checked : true}));
                            }
                            if (dbSchedules) {
                                finalSchedules = dbSchedules;
                            }
                            onlineModeActivated = true;
                        } else {
                            console.warn("Failed to load data from DB or no data found for user:", dbLoadResult.error);
                        }
                    } catch (dbError) {
                        console.error("Critical error during DB load on startup:", dbError);
                    }
                } else {
                    console.warn("DB API is not available. Cloud sync will be disabled.");
                }
            }

            if (fileSystemApi) {
                if (!finalAiConfig) {
                    try {
                        const fileAiConfig = await fileSystemApi.readFile(PROFILE_CONFIG_FILENAME);
                        if (fileAiConfig) {
                            finalAiConfig = { ...INITIAL_AI_CONFIG, ...fileAiConfig };
                            aiConfigActuallyLoaded = true;
                        }
                    } catch (e) { console.error("Error reading local AI config:", e); }
                } else if (finalCredentials && onlineModeActivated && finalAiConfig) {
                    console.log("Syncing AI Config from DB to local file (initial load).");
                    await fileSystemApi.writeFile(PROFILE_CONFIG_FILENAME, finalAiConfig).catch(e => console.error("Error syncing DB AI config to local file:", e));
                }

                if (!finalCategories) {
                    try {
                        const fileCategories = await fileSystemApi.readFile(CATEGORIES_FILENAME);
                        if (fileCategories && Array.isArray(fileCategories)) {
                            finalCategories = fileCategories.map(c => ({...c, checked: c.checked !== undefined ? c.checked : true}));
                        }
                    } catch (e) { console.error("Error reading local categories:", e); }
                } else if (finalCredentials && onlineModeActivated && finalCategories) {
                    console.log("Syncing Categories from DB to local file (initial load).");
                    await fileSystemApi.writeFile(CATEGORIES_FILENAME, finalCategories).catch(e => console.error("Error syncing DB categories to local file:", e));
                }

                if (!finalSchedules) {
                    try {
                        const fileSchedules = await fileSystemApi.readFile(SCHEDULES_FILENAME);
                        finalSchedules = fileSchedules || [];
                    } catch (e) { console.error("Error reading local schedules:", e); }
                } else if (finalCredentials && onlineModeActivated && finalSchedules) {
                    console.log("Syncing Schedules from DB to local file (initial load).");
                    await fileSystemApi.writeFile(SCHEDULES_FILENAME, finalSchedules).catch(e => console.error("Error syncing DB schedules to local file:", e));
                }
            }

            setUserCredentials(finalCredentials);
            setAiConfig(finalAiConfig || INITIAL_AI_CONFIG);
            setCategories(finalCategories || INITIAL_CATEGORIES.map(c => ({...c, checked: true})));
            setSchedules(finalSchedules || []);
            setIsAiConfigLoaded(aiConfigActuallyLoaded);
            setIsOnlineMode(onlineModeActivated);

            if (!aiConfigActuallyLoaded && JSON.stringify(finalAiConfig || INITIAL_AI_CONFIG) === JSON.stringify(INITIAL_AI_CONFIG)) {
                setIsAiConfigLoaded(false);
            }

            setIsLoadingData(false);
        };

        loadInitialData().catch(err => {
            console.error("Critical error during initial data load:", err);
            notifyError("Критическая ошибка при загрузке начальных данных!");
            setUserCredentials(null);
            setAiConfig(INITIAL_AI_CONFIG);
            setCategories(INITIAL_CATEGORIES.map(c => ({...c, checked: true})));
            setSchedules([]);
            setIsAiConfigLoaded(false);
            setIsOnlineMode(false);
            setIsLoadingData(false);
        });
    }, []);


    const handleForceSyncWithDB = async () => {
        if (!dbApi || !userCredentials || !userCredentials.email) {
            notifyError("Невозможно синхронизировать: API или учетные данные недоступны.");
            return false;
        }
        console.log("Принудительная синхронизация с БД для:", userCredentials.email);
        setIsLoadingData(true);
        const toastId = toast.loading("Синхронизация с облаком..."); // Показываем тост загрузки
        let syncSuccess = false;
        try {
            const result = await dbApi.saveUserAllData({
                email: userCredentials.email,
                name: userCredentials.name,
                aiConfig: aiConfig,
                categories: categories,
                schedules: schedules
            });
            if (result.success) {
                toast.update(toastId, { render: "Данные успешно синхронизированы!", type: "success", isLoading: false, autoClose: 3000 });
                setIsOnlineMode(true);
                syncSuccess = true;
                if(fileSystemApi) {
                    console.log("Updating local files after successful DB sync.");
                    await Promise.all([
                        fileSystemApi.writeFile(PROFILE_CONFIG_FILENAME, aiConfig),
                        fileSystemApi.writeFile(CATEGORIES_FILENAME, categories),
                        fileSystemApi.writeFile(SCHEDULES_FILENAME, schedules)
                    ]).catch(e => console.warn("Не удалось обновить локальные файлы после синхронизации с БД:", e));
                }
            } else {
                // Важно: обновляем тост и при ошибке, чтобы он исчез
                toast.update(toastId, { render: "Ошибка синхронизации: " + (result.error || "Неизвестная ошибка"), type: "error", isLoading: false, autoClose: 5000 });
                setIsOnlineMode(false);
            }
        } catch (error) {
            // И здесь тоже обновляем
            toast.update(toastId, { render: "Критическая ошибка при синхронизации: " + error.message, type: "error", isLoading: false, autoClose: 5000 });
            setIsOnlineMode(false);
        } finally {
            setIsLoadingData(false);
        }
        return syncSuccess;
    };

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
            return updated.map(cat => ({
                ...cat,
                color: cat.color || (cat.name === 'Работа' ? 'var(--app-accent-purple)' : (cat.name === 'Личное' ? 'var(--app-accent-teal)' : '#ffc107')),
                checked: cat.checked !== undefined ? cat.checked : true
            }));
        });
    }, []);

    const handleToggleCategoryFilter = useCallback((categoryIdToToggle) => {
        setCategories(prevCategories =>
            prevCategories.map(cat =>
                cat.id === categoryIdToToggle ? { ...cat, checked: !cat.checked } : cat
            )
        );
    }, []);

    const handleDeleteCategory = useCallback((categoryIdToDelete) => {
        if (window.confirm("Вы уверены, что хотите удалить эту категорию? Все связанные задачи будут помечены как 'Без категории'.")) {
            setCategories(prev => prev.filter(cat => cat.id !== categoryIdToDelete));
            setSchedules(prev =>
                prev.map(sch =>
                    sch.categoryId === categoryIdToDelete ? { ...sch, categoryId: null } : sch
                )
            );
            notifyInfo("Категория удалена.");
        }
    }, []);

    const startAddingCategory = () => {
        setIsAddingCategory(true);
        setNewCategoryNameInput('');
        setNewCategoryColorInput(DEFAULT_NEW_CATEGORY_COLOR);
        setAddCategoryError('');
    };

    useEffect(() => {
        if (isAddingCategory && newCategoryNameInputRef.current) {
            newCategoryNameInputRef.current.focus();
        }
    }, [isAddingCategory]);

    const handleSaveNewCategory = () => {
        setAddCategoryError('');
        const trimmedName = newCategoryNameInput.trim();
        if (!trimmedName) {
            setAddCategoryError("Название категории не может быть пустым.");
            newCategoryNameInputRef.current?.focus();
            return;
        }
        const newCategory = {
            id: `cat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            name: trimmedName,
            color: newCategoryColorInput,
            checked: true,
        };
        updateCategories(prev => [...prev, newCategory]);
        setIsAddingCategory(false);
        notifySuccess(`Категория "${trimmedName}" добавлена!`);
    };

    const handleCancelAddNewCategory = () => {
        setIsAddingCategory(false);
        setAddCategoryError('');
    };

    const updateAiConfig = useCallback((newAiConfigOrUpdater) => {
        setAiConfig(prevAiConfig => {
            const updatedConfig = typeof newAiConfigOrUpdater === 'function' ? newAiConfigOrUpdater(prevAiConfig) : newAiConfigOrUpdater;
            let isDifferentFromInitial = false;
            if (updatedConfig && typeof updatedConfig === 'object') {
                for (const key in INITIAL_AI_CONFIG) { if (JSON.stringify(updatedConfig[key]) !== JSON.stringify(INITIAL_AI_CONFIG[key])) { isDifferentFromInitial = true; break; } }
                for (const key in updatedConfig) { if (!INITIAL_AI_CONFIG.hasOwnProperty(key)) { isDifferentFromInitial = true; break; } }
            } else if (updatedConfig) {
                isDifferentFromInitial = true;
            }

            if (isDifferentFromInitial) {
                setIsAiConfigLoaded(true);
            }
            return updatedConfig;
        });
    }, []);

    const handleAddSchedules = useCallback((newSchedulesToAdd) => {
        if (!Array.isArray(newSchedulesToAdd)) { console.error("App: handleAddSchedules ожидал массив"); return; }
        if (newSchedulesToAdd.length === 0) return;
        setSchedules(prevSchedules => {
            const existingIds = new Set(prevSchedules.map(s => s.id));
            const uniqueNewSchedules = newSchedulesToAdd.filter(s => !existingIds.has(s.id));
            return [...prevSchedules, ...uniqueNewSchedules];
        });
    }, []);

    useEffect(() => {
        if (isLoadingData || !fileSystemApi) return;
        // console.log("FS: Saving CATEGORIES");
        fileSystemApi.writeFile(CATEGORIES_FILENAME, categories).catch(e => console.error('App: Failed to save categories to local file:', e));
    }, [categories, isLoadingData, fileSystemApi]);

    useEffect(() => {
        if (isLoadingData || !fileSystemApi) return;
        // console.log("FS: Saving SCHEDULES");
        fileSystemApi.writeFile(SCHEDULES_FILENAME, schedules).catch(e => console.error('App: Failed to save schedules to local file:', e));
    }, [schedules, isLoadingData, fileSystemApi]);

    useEffect(() => {
        if (isLoadingData || !fileSystemApi || !isAiConfigLoaded) {
            return;
        }
        // console.log("FS: Saving AI_CONFIG");
        fileSystemApi.writeFile(PROFILE_CONFIG_FILENAME, aiConfig).catch(e => console.error('App: Failed to save AI config to local file:', e));
    }, [aiConfig, isLoadingData, isAiConfigLoaded, fileSystemApi]);

    const handleRegistration = async (credentials) => {
        if (!fileSystemApi) {
            notifyError("Файловая система недоступна. Регистрация невозможна.");
            return;
        }

        setIsLoadingData(true);
        let localRegistrationSuccess = false;
        let currentOnlineMode = false;
        const toastId = toast.loading("Регистрация...");

        if (dbApi) {
            try {
                const dbRegResult = await dbApi.registerUser(credentials.email, credentials.name);
                if (dbRegResult.success) {
                    toast.update(toastId, { render: "Успешная проверка/регистрация в облаке.", type: "info", isLoading: true, autoClose: 2000 });
                    currentOnlineMode = true;
                } else {
                    toast.update(toastId, { render: "Не удалось связаться с облаком. Данные будут сохранены локально.", type: "warning", isLoading: true, autoClose: 3000 });
                }
            } catch (dbError) {
                toast.update(toastId, { render: "Ошибка при регистрации в облаке. Данные будут сохранены локально.", type: "error", isLoading: true, autoClose: 3000 });
            }
        } else {
            toast.update(toastId, { render: "Облачная синхронизация недоступна. Данные будут сохранены только локально.", type: "warning", isLoading: true, autoClose: 3000 });
        }

        try {
            await fileSystemApi.writeFile(USER_CREDENTIALS_FILENAME, credentials);
            setUserCredentials(credentials);
            localRegistrationSuccess = true;
        } catch (fsError) {
            toast.update(toastId, { render: "Критическая ошибка: не удалось сохранить данные регистрации локально!", type: "error", isLoading: false, autoClose: 5000 });
            setIsLoadingData(false);
            return;
        }

        if (localRegistrationSuccess) {
            let loadedAiConfig = null;
            let loadedCategories = null;
            let loadedSchedules = null;
            let aiConfigActuallyLoadedThisSession = false;

            if (currentOnlineMode && dbApi) {
                console.log(`Loading data for ${credentials.email} from DB after registration.`);
                try {
                    const dbLoadResult = await dbApi.loadUserAllData(credentials.email);
                    if (dbLoadResult.success && dbLoadResult.data) {
                        const { aiConfig: dbAiConfig, categories: dbCategories, schedules: dbSchedules } = dbLoadResult.data;
                        if (dbAiConfig && Object.keys(dbAiConfig).length > 0) {
                            loadedAiConfig = { ...INITIAL_AI_CONFIG, ...dbAiConfig };
                            aiConfigActuallyLoadedThisSession = true;
                        }
                        loadedCategories = dbCategories;
                        loadedSchedules = dbSchedules;
                    } else {
                        console.warn("No data found in DB for user (after registration call):", dbLoadResult.error);
                    }
                } catch (dbLoadErr) {
                    console.error("Error loading data from DB after registration:", dbLoadErr);
                }
            }

            setAiConfig(loadedAiConfig || INITIAL_AI_CONFIG);
            setCategories((loadedCategories && loadedCategories.length > 0 ? loadedCategories : INITIAL_CATEGORIES).map(c => ({...c, checked: c.checked !== undefined ? c.checked : true})));
            setSchedules(loadedSchedules || []);
            setIsAiConfigLoaded(aiConfigActuallyLoadedThisSession);
            setIsOnlineMode(currentOnlineMode);

            if (currentOnlineMode && !aiConfigActuallyLoadedThisSession && dbApi) {
                const initialCats = INITIAL_CATEGORIES.map(c => ({...c, checked: true}));
                const initialDataToSave = {
                    email: credentials.email, name: credentials.name,
                    aiConfig: INITIAL_AI_CONFIG, categories: initialCats, schedules: []
                };
                console.log("No specific AI config from DB for new user, saving initial data to DB", initialDataToSave);
                // Это сохранение может быть избыточным, если main.js уже вставил пустые JSON при регистрации
                // dbApi.saveUserAllData(initialDataToSave).catch(e => console.error("Error saving initial data for new user to DB", e));
            }
            toast.dismiss(toastId);
            notifySuccess("Регистрация завершена!");
        }
        setIsLoadingData(false);
    };

    const handleOnboardingComplete = async (completedAiConfig) => {
        updateAiConfig(completedAiConfig);
        if (userCredentials && userCredentials.email && dbApi) {
            console.log("Onboarding complete, saving AI config to DB for:", userCredentials.email);
            setIsLoadingData(true);
            const toastId = toast.loading("Сохранение настроек в облако...");
            try {
                const saveResult = await dbApi.saveUserAllData({
                    email: userCredentials.email,
                    name: userCredentials.name,
                    aiConfig: completedAiConfig,
                    categories: categories,
                    schedules: schedules
                });
                if (saveResult.success) {
                    toast.update(toastId, { render: "Настройки сохранены в облако!", type: "success", isLoading: false, autoClose: 3000 });
                    setIsOnlineMode(true);
                } else {
                    toast.update(toastId, { render: "Не удалось сохранить настройки в облако: " + (saveResult.error || "Неизвестная ошибка"), type: "error", isLoading: false, autoClose: 5000 });
                }
            } catch(e) {
                toast.update(toastId, { render: "Ошибка сохранения настроек в облако.", type: "error", isLoading: false, autoClose: 5000 });
            } finally {
                setIsLoadingData(false);
            }
        } else if (userCredentials && userCredentials.email && !dbApi) {
            notifyInfo("Начальные настройки сохранены локально. Облачная синхронизация недоступна.");
        }
    };

    if (isLoadingData) { return <div className="loading-indicator">Загрузка данных...</div>; }
    if (!fileSystemApi && !isLoadingData) {
        return (<div className="app-error"><h1>Критическая ошибка</h1><p>Локальная файловая система недоступна. Работа приложения невозможна.</p></div>);
    }
    if (!userCredentials) { return <RegistrationPage onRegister={handleRegistration} />; }
    if (!isAiConfigLoaded) { return (<OnboardingQuestionnairePage initialConfig={aiConfig} onComplete={handleOnboardingComplete} userName={userCredentials.name} />); }

    const filtersForCalendar = categories.filter(cat => cat.checked).map(cat => cat.id);

    return (
        <Router>
            <ToastContainer
                position="bottom-right"
                autoClose={4000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="dark"
            />
            <div className="app-container">
                <nav className="app-sidebar">
                    <div className="sidebar-brand">
                        <span className="sidebar-brand-icon"></span>
                        Aimly
                    </div>
                    <ul className="sidebar-main-nav">
                        <li><NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><IconPlaceholder name="Calendar" style={{ marginRight: '8px' }} /> Календарь</NavLink></li>
                        <li><NavLink to="/ai" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><IconPlaceholder name="AI" style={{ marginRight: '8px' }} /> AI Ассистент</NavLink></li>
                    </ul>

                    <div className="sidebar-section-title">Мои категории</div>
                    <ul className="sidebar-projects-nav">
                        {categories.map(category => (
                            <li key={category.id} className="category-list-item">
                                <a
                                    href="#"
                                    onClick={(e) => { e.preventDefault(); handleToggleCategoryFilter(category.id); }}
                                    className={`nav-link category-filter-link ${!category.checked ? 'disabled-filter' : ''}`}
                                    title={category.checked ? "Скрыть задачи этой категории" : "Показать задачи этой категории"}
                                >
                                    <span className="category-dot" style={{ backgroundColor: category.color, opacity: category.checked ? 1 : 0.4 }} />
                                    <span className="category-name-text" style={{ textDecoration: !category.checked ? 'line-through' : 'none', opacity: category.checked ? 1 : 0.7 }}>
                                        {category.name}
                                    </span>
                                </a>
                                <IconPlaceholder
                                    name="Trash"
                                    className="delete-category-icon action-icon"
                                    onClick={() => handleDeleteCategory(category.id)}
                                    title="Удалить категорию"
                                    style={{ marginLeft: 'auto', padding: '0 5px', color: 'var(--app-text-secondary)' }}
                                />
                            </li>
                        ))}
                        {isAddingCategory ? (
                            <li className="add-category-form-item">
                                {addCategoryError && <p className="form-error-message sidebar-form-error">{addCategoryError}</p>}
                                <div className="add-category-input-group">
                                    <input
                                        type="color"
                                        value={newCategoryColorInput}
                                        onChange={(e) => setNewCategoryColorInput(e.target.value)}
                                        className="add-category-color-picker"
                                    />
                                    <input
                                        ref={newCategoryNameInputRef}
                                        type="text"
                                        placeholder="Название"
                                        value={newCategoryNameInput}
                                        onChange={(e) => setNewCategoryNameInput(e.target.value)}
                                        onKeyPress={(e) => {if (e.key === 'Enter') handleSaveNewCategory(); if (e.key === 'Escape') handleCancelAddNewCategory();}}
                                        className="add-category-name-input"
                                    />
                                </div>
                                <div className="add-category-actions">
                                    <IconPlaceholder name="Check" onClick={handleSaveNewCategory} title="Сохранить" style={{marginRight: '5px', color: 'var(--app-accent-green)'}} className="action-icon"/>
                                    <IconPlaceholder name="Cross" onClick={handleCancelAddNewCategory} title="Отмена" style={{color: 'var(--app-accent-red)'}} className="action-icon"/>
                                </div>
                            </li>
                        ) : (
                            <li>
                                <a href="#" onClick={(e) => { e.preventDefault(); startAddingCategory(); }} className="nav-link add-category-button">
                                    <IconPlaceholder name="Plus" style={{ marginRight: '8px' }}/> Добавить категорию
                                </a>
                            </li>
                        )}
                    </ul>
                    <ul className="sidebar-footer-nav">
                        <li><NavLink to="/profile" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><IconPlaceholder name="Profile" style={{ marginRight: '8px' }}/> Профиль</NavLink></li>
                    </ul>
                </nav>

                <main className="app-content">
                    <Routes>
                        <Route
                            path="/"
                            element={ <CalendarComponent allCategories={categories} schedules={schedules} onSchedulesChange={updateSchedules} activeCategoryFilters={filtersForCalendar} /> }
                        />
                        <Route
                            path="/profile"
                            element={ <UserProfile
                                schedules={schedules}
                                categories={categories}
                                onCategoriesChange={updateCategories}
                                currentAiConfig={aiConfig}
                                onAiConfigChange={updateAiConfig}
                                userCredentials={userCredentials}
                                onForceSync={handleForceSyncWithDB}
                                isOnlineMode={isOnlineMode}
                            /> }
                        />
                        <Route
                            path="/ai"
                            element={ <AiAssistant aiConfig={aiConfig} categories={categories} onAddSchedules={handleAddSchedules} /> }
                        />
                        <Route path="*" element={<div style={{padding: "20px"}}>Страница не найдена (404)</div>} />
                    </Routes>
                </main>
            </div>
        </Router>
    );
}

export default App;