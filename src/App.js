// App.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import CalendarComponent from './components/Calendar';
import UserProfile from './components/UserProfile';
import AiAssistant from './components/AiAssistant';
import RegistrationPage from './components/RegistrationPage';
import OnboardingQuestionnairePage from './components/OnboardingQuestionnairePage';
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
        {/* Добавьте другие иконки по мере необходимости */}
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
const dbApi = window.dbApi; // Новый API для БД

if (!fileSystemApi) { console.error("App.js: Electron FS API ('electronFs') is not available."); }
if (!dbApi) { console.error("App.js: Electron DB API ('dbApi') is not available."); }

const DEFAULT_NEW_CATEGORY_COLOR = '#7D8590';


function App() {
    const [categories, setCategories] = useState(() => INITIAL_CATEGORIES.map(c => ({...c, checked: c.checked !== undefined ? c.checked : true})));
    const [schedules, setSchedules] = useState([]);
    const [aiConfig, setAiConfig] = useState(INITIAL_AI_CONFIG);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [userCredentials, setUserCredentials] = useState(null); // { name, email }
    const [isAiConfigLoaded, setIsAiConfigLoaded] = useState(false);
    const [isOnlineMode, setIsOnlineMode] = useState(false);

    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryNameInput, setNewCategoryNameInput] = useState('');
    const [newCategoryColorInput, setNewCategoryColorInput] = useState(DEFAULT_NEW_CATEGORY_COLOR);
    const newCategoryNameInputRef = useRef(null);

    useEffect(() => {
        const loadInitialData = async () => {
            setIsLoadingData(true);
            let localCredentials = null;
            let loadedAiConfigFromSource = null; // Может быть из БД или файла
            let loadedCategoriesFromSource = null;
            let loadedSchedulesFromSource = null;

            if (fileSystemApi) {
                try {
                    await fileSystemApi.ensureDataDir();
                    localCredentials = await fileSystemApi.readFile(USER_CREDENTIALS_FILENAME);
                } catch (e) { console.error("Error reading local credentials file:", e); }
            }

            if (localCredentials && localCredentials.email && localCredentials.name) {
                setUserCredentials(localCredentials);
                console.log("Local credentials loaded:", localCredentials);

                if (dbApi) {
                    console.log(`Attempting to load all data from DB for ${localCredentials.email}`);
                    const dbLoadResult = await dbApi.loadUserAllData(localCredentials.email);
                    if (dbLoadResult.success && dbLoadResult.data) {
                        console.log("Successfully loaded data from DB:", dbLoadResult.data);
                        const { aiConfig: dbAiConfig, categories: dbCategories, schedules: dbSchedules } = dbLoadResult.data;

                        if (dbAiConfig && Object.keys(dbAiConfig).length > 0) { // Проверяем, что конфиг не пустой
                            setAiConfig(prev => ({ ...INITIAL_AI_CONFIG, ...dbAiConfig }));
                            setIsAiConfigLoaded(true);
                            loadedAiConfigFromSource = dbAiConfig;
                        }
                        if (dbCategories && dbCategories.length > 0) {
                            setCategories(dbCategories.map(c => ({...c, checked: c.checked !== undefined ? c.checked : true})));
                            loadedCategoriesFromSource = dbCategories;
                        }
                        if (dbSchedules) {
                            setSchedules(dbSchedules);
                            loadedSchedulesFromSource = dbSchedules;
                        }
                        setIsOnlineMode(true);
                    } else {
                        console.warn("Failed to load data from DB or no data found:", dbLoadResult.error);
                        setIsOnlineMode(false);
                    }
                }
            }

            if (fileSystemApi) {
                if (!loadedAiConfigFromSource) {
                    try {
                        const fileAiConfig = await fileSystemApi.readFile(PROFILE_CONFIG_FILENAME);
                        if (fileAiConfig) {
                            setAiConfig(prev => ({ ...INITIAL_AI_CONFIG, ...fileAiConfig }));
                            setIsAiConfigLoaded(true);
                            loadedAiConfigFromSource = fileAiConfig; // Запоминаем, что загрузили из файла
                        } else if (!isAiConfigLoaded) {
                            setAiConfig(INITIAL_AI_CONFIG);
                            setIsAiConfigLoaded(false);
                        }
                    } catch (e) { console.error("Error reading local AI config:", e); if (!isAiConfigLoaded) setIsAiConfigLoaded(false); }
                } else if (localCredentials && isOnlineMode && loadedAiConfigFromSource && fileSystemApi) {
                    // Если загрузили из БД, и данные из БД есть, обновляем локальный файл
                    console.log("Syncing AI Config from DB to local file.");
                    await fileSystemApi.writeFile(PROFILE_CONFIG_FILENAME, loadedAiConfigFromSource).catch(e => console.error("Error syncing DB AI config to local file:", e));
                }


                if (!loadedCategoriesFromSource) {
                    try {
                        const fileCategories = await fileSystemApi.readFile(CATEGORIES_FILENAME);
                        if (fileCategories && Array.isArray(fileCategories)) {
                            setCategories(fileCategories.map(c => ({...c, checked: c.checked !== undefined ? c.checked : true})));
                            loadedCategoriesFromSource = fileCategories;
                        } else { // Если файл пуст или не массив
                            const initialCatsWithChecked = INITIAL_CATEGORIES.map(c => ({...c, checked: true}));
                            setCategories(initialCatsWithChecked);
                            if (fileSystemApi) await fileSystemApi.writeFile(CATEGORIES_FILENAME, initialCatsWithChecked).catch(e => console.error("Error writing initial categories file:", e));
                        }
                    } catch (e) { console.error("Error reading local categories:", e); }
                } else if (localCredentials && isOnlineMode && loadedCategoriesFromSource && fileSystemApi) {
                    console.log("Syncing Categories from DB to local file.");
                    await fileSystemApi.writeFile(CATEGORIES_FILENAME, loadedCategoriesFromSource).catch(e => console.error("Error syncing DB categories to local file:", e));
                }

                if (!loadedSchedulesFromSource) {
                    try {
                        const fileSchedules = await fileSystemApi.readFile(SCHEDULES_FILENAME);
                        setSchedules(fileSchedules || []);
                        loadedSchedulesFromSource = fileSchedules;
                    } catch (e) { console.error("Error reading local schedules:", e); }
                } else if (localCredentials && isOnlineMode && loadedSchedulesFromSource && fileSystemApi) {
                    console.log("Syncing Schedules from DB to local file.");
                    await fileSystemApi.writeFile(SCHEDULES_FILENAME, loadedSchedulesFromSource).catch(e => console.error("Error syncing DB schedules to local file:", e));
                }
            } else {
                if (!isAiConfigLoaded) setIsAiConfigLoaded(false);
            }

            // Если после всех попыток AI конфиг все еще INITIAL_AI_CONFIG и не был помечен как загруженный
            // (например, если все файлы и БД были пусты или недоступны)


            setIsLoadingData(false);
        };
        loadInitialData();
    }, []); // Пустой массив зависимостей, чтобы выполнился один раз


    const handleForceSyncWithDB = async () => {
        if (!dbApi || !userCredentials || !userCredentials.email) {
            alert("Невозможно синхронизировать: API базы данных недоступно или пользователь не вошел в систему.");
            return false;
        }
        console.log("Принудительная синхронизация с БД для:", userCredentials.email);
        setIsLoadingData(true);
        try {
            const result = await dbApi.saveUserAllData({
                email: userCredentials.email,
                name: userCredentials.name,
                aiConfig: aiConfig,
                categories: categories,
                schedules: schedules
            });
            if (result.success) {
                alert("Данные успешно синхронизированы с облаком!");
                if(fileSystemApi) { // Обновляем локальные файлы после успешной синхронизации
                    console.log("Updating local files after successful DB sync.");
                    await Promise.all([
                        fileSystemApi.writeFile(PROFILE_CONFIG_FILENAME, aiConfig),
                        fileSystemApi.writeFile(CATEGORIES_FILENAME, categories),
                        fileSystemApi.writeFile(SCHEDULES_FILENAME, schedules)
                    ]).catch(e => console.warn("Не удалось обновить локальные файлы после синхронизации с БД:", e));
                }
                return true;
            } else {
                alert("Ошибка синхронизации с облаком: " + result.error);
                console.error("Ошибка синхронизации с БД:", result.error);
                return false;
            }
        } catch (error) {
            alert("Критическая ошибка при синхронизации: " + error.message);
            console.error("Критическая ошибка при синхронизации с БД:", error);
            return false;
        } finally {
            setIsLoadingData(false);
        }
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
        }
    }, []);

    const startAddingCategory = () => {
        setIsAddingCategory(true);
        setNewCategoryNameInput('');
        setNewCategoryColorInput(DEFAULT_NEW_CATEGORY_COLOR);
    };

    useEffect(() => {
        if (isAddingCategory && newCategoryNameInputRef.current) {
            newCategoryNameInputRef.current.focus();
        }
    }, [isAddingCategory]);

    const handleSaveNewCategory = () => {
        const trimmedName = newCategoryNameInput.trim();
        if (!trimmedName) {
            alert("Название категории не может быть пустым.");
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
    };

    const handleCancelAddNewCategory = () => {
        setIsAddingCategory(false);
    };

    const updateAiConfig = useCallback((newAiConfigOrUpdater) => {
        setAiConfig(prevAiConfig => {
            const updatedConfig = typeof newAiConfigOrUpdater === 'function' ? newAiConfigOrUpdater(prevAiConfig) : newAiConfigOrUpdater;
            let isDifferentFromInitial = false;
            if (updatedConfig && typeof updatedConfig === 'object') { // Добавил проверку на object
                for (const key in INITIAL_AI_CONFIG) { if (JSON.stringify(updatedConfig[key]) !== JSON.stringify(INITIAL_AI_CONFIG[key])) { isDifferentFromInitial = true; break; } }
                for (const key in updatedConfig) { if (!INITIAL_AI_CONFIG.hasOwnProperty(key)) { isDifferentFromInitial = true; break; } }
            } else if (updatedConfig) { // Если это не объект, но не null/undefined, считаем отличным
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
        console.log("FS: Saving CATEGORIES");
        fileSystemApi.writeFile(CATEGORIES_FILENAME, categories).catch(e => console.error('App: Failed to save categories to local file:', e));
    }, [categories, isLoadingData, fileSystemApi]);

    useEffect(() => {
        if (isLoadingData || !fileSystemApi) return;
        console.log("FS: Saving SCHEDULES");
        fileSystemApi.writeFile(SCHEDULES_FILENAME, schedules).catch(e => console.error('App: Failed to save schedules to local file:', e));
    }, [schedules, isLoadingData, fileSystemApi]);

    useEffect(() => {
        if (isLoadingData || !fileSystemApi || !isAiConfigLoaded) { // Сохраняем, только если конфиг был "загружен" (т.е. не дефолтный)
            if (!isLoadingData && fileSystemApi && !isAiConfigLoaded) {
                // console.log("FS: AI Config is initial, not saving to local file.");
            }
            return;
        }
        console.log("FS: Saving AI_CONFIG");
        fileSystemApi.writeFile(PROFILE_CONFIG_FILENAME, aiConfig).catch(e => console.error('App: Failed to save AI config to local file:', e));
    }, [aiConfig, isLoadingData, isAiConfigLoaded, fileSystemApi]);

    const handleRegistration = async (credentials) => {
        if (!dbApi) { alert("Ошибка: API базы данных недоступно для регистрации."); setIsLoadingData(false); return; }
        if (!fileSystemApi) { alert("Ошибка: Файловая система недоступна."); setIsLoadingData(false); return; }

        setIsLoadingData(true);
        try {
            console.log("Registering user in DB:", credentials.email);
            const dbRegResult = await dbApi.registerUser(credentials.email, credentials.name);
            if (!dbRegResult.success) {
                alert("Ошибка регистрации в облаке: " + dbRegResult.error);
                setIsLoadingData(false); return;
            }
            console.log("DB Registration/Check result:", dbRegResult.message);

            await fileSystemApi.writeFile(USER_CREDENTIALS_FILENAME, credentials);
            setUserCredentials(credentials);

            console.log(`Loading data for ${credentials.email} after registration.`);
            const dbLoadResult = await dbApi.loadUserAllData(credentials.email);
            if (dbLoadResult.success && dbLoadResult.data) {
                const { aiConfig: dbAiConfig, categories: dbCategories, schedules: dbSchedules } = dbLoadResult.data;
                if (dbAiConfig && Object.keys(dbAiConfig).length > 0) {
                    updateAiConfig(dbAiConfig); // Обновит aiConfig и isAiConfigLoaded
                } else {
                    setAiConfig(INITIAL_AI_CONFIG);
                    setIsAiConfigLoaded(false); // Показываем онбординг
                }
                setCategories((dbCategories && dbCategories.length > 0 ? dbCategories : INITIAL_CATEGORIES).map(c => ({...c, checked: c.checked !== undefined ? c.checked : true})));
                setSchedules(dbSchedules || []);
                setIsOnlineMode(true);
            } else {
                console.warn("No data in DB for new/existing user after registration, proceeding with onboarding.");
                setAiConfig(INITIAL_AI_CONFIG);
                setIsAiConfigLoaded(false); // Онбординг
                const initialCatsWithChecked = INITIAL_CATEGORIES.map(c => ({...c, checked: true}));
                setCategories(initialCatsWithChecked);
                setSchedules([]);
                setIsOnlineMode(false); // Или true, если регистрация успешна, но данных нет
                // Сохраним начальные/пустые данные в БД, если их там не было
                if (dbLoadResult.error?.includes("не найдены")) { // Проверяем конкретную ошибку
                    await dbApi.saveUserAllData({
                        email: credentials.email, name: credentials.name,
                        aiConfig: INITIAL_AI_CONFIG, categories: initialCatsWithChecked, schedules: []
                    });
                }
            }
        } catch (error) {
            console.error("App: Failed during registration process", error);
            alert("Ошибка при регистрации: " + error.message);
            // Сбрасываем состояние в случае критической ошибки
            setUserCredentials(null);
            setIsAiConfigLoaded(false);
        } finally {
            setIsLoadingData(false);
        }
    };

    const handleOnboardingComplete = async (completedAiConfig) => {
        updateAiConfig(completedAiConfig);
        if (userCredentials && userCredentials.email && dbApi) {
            console.log("Onboarding complete, saving AI config to DB for:", userCredentials.email);
            setIsLoadingData(true);
            try {
                await dbApi.saveUserAllData({
                    email: userCredentials.email,
                    name: userCredentials.name,
                    aiConfig: completedAiConfig,
                    categories: categories,
                    schedules: schedules
                });
                setIsOnlineMode(true); // После успешного сохранения онбординга
            } catch(e) {
                console.error("Failed to save onboarding config to DB", e);
                alert("Не удалось сохранить начальные настройки в облако. Они сохранены локально.");
            } finally {
                setIsLoadingData(false);
            }
        }
    };

    if (isLoadingData) { return <div className="loading-indicator">Загрузка данных...</div>; }
    if (!fileSystemApi && !dbApi && !isLoadingData) { return (<div className="app-error"><h1>Ошибка приложения</h1><p>Необходимые API не найдены.</p></div>); }

    if (!userCredentials) { return <RegistrationPage onRegister={handleRegistration} />; }
    if (!isAiConfigLoaded) { return (<OnboardingQuestionnairePage initialConfig={aiConfig} onComplete={handleOnboardingComplete} userName={userCredentials.name} />); }

    const filtersForCalendar = categories.filter(cat => cat.checked).map(cat => cat.id);

    return (
        <Router>
            <div className="app-container">
                <nav className="app-sidebar">
                    <div className="sidebar-brand">
                        <span className="sidebar-brand-icon"></span> {/* Убедитесь, что есть CSS для этого */}
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
                                    className="delete-category-icon"
                                    onClick={() => handleDeleteCategory(category.id)}
                                    title="Удалить категорию"
                                    style={{ marginLeft: 'auto', padding: '0 5px' }}
                                />
                            </li>
                        ))}
                        {isAddingCategory ? (
                            <li className="add-category-form-item">
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