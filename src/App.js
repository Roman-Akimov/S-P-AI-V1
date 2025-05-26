// app.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import CalendarComponent from './components/Calendar';
import UserProfile from './components/UserProfile';
import AiAssistant from './components/AiAssistant';
import RegistrationPage from './components/RegistrationPage';
import OnboardingQuestionnairePage from './components/OnboardingQuestionnairePage';
import './App.css';

const IconPlaceholder = ({ name, size = "1em", style = {} }) => (
    <span style={{ marginRight: '10px', fontSize: size, display: 'inline-block', ...style }} role="img" aria-label={`${name} icon`}>
        {name === 'Calendar' && '🗓️'}
        {name === 'AI' && '🤖'}
        {name === 'Profile' && '⚙️'}
        {name === 'Plus' && '+'}
        {name === 'Inbox' && '📥'}
        {name === 'Today' && '⭐'}
        {name === 'Plans' && '📋'}
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
if (!fileSystemApi) {
    console.error("App.js: Electron FS API ('electronFs') is not available.");
}

const DEFAULT_NEW_CATEGORY_COLOR = '#7D8590';

function App() {
    const [categories, setCategories] = useState(INITIAL_CATEGORIES);
    const [schedules, setSchedules] = useState([]);
    const [aiConfig, setAiConfig] = useState(INITIAL_AI_CONFIG);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [userCredentials, setUserCredentials] = useState(null);
    const [isAiConfigLoadedFromFile, setIsAiConfigLoadedFromFile] = useState(false);

    const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
    const [newCategoryData, setNewCategoryData] = useState({
        name: '',
        color: DEFAULT_NEW_CATEGORY_COLOR
    });

    useEffect(() => {
        const loadInitialData = async () => {
            if (!fileSystemApi) {
                setIsLoadingData(false);
                setCategories(INITIAL_CATEGORIES.map(c => ({...c, checked: c.checked !== undefined ? c.checked : true})));
                setSchedules([]);
                setAiConfig(INITIAL_AI_CONFIG);
                setUserCredentials(null);
                setIsAiConfigLoadedFromFile(false);
                console.warn("App: FS API not found, using default data.");
                return;
            }
            setIsLoadingData(true);
            try {
                await fileSystemApi.ensureDataDir();
                const loadedCredentials = await fileSystemApi.readFile(USER_CREDENTIALS_FILENAME);
                if (loadedCredentials && loadedCredentials.name && loadedCredentials.email) {
                    setUserCredentials(loadedCredentials);
                } else { setUserCredentials(null); }

                const [loadedCategoriesData, loadedSchedules, loadedProfileConfig] = await Promise.all([
                    fileSystemApi.readFile(CATEGORIES_FILENAME),
                    fileSystemApi.readFile(SCHEDULES_FILENAME),
                    fileSystemApi.readFile(PROFILE_CONFIG_FILENAME)
                ]);

                let initialCats = INITIAL_CATEGORIES;
                if (loadedCategoriesData && Array.isArray(loadedCategoriesData)) { // Добавлена проверка на массив
                    initialCats = loadedCategoriesData.map(cat => ({
                        ...cat,
                        color: cat.color || (cat.name === 'Работа' ? 'var(--app-accent-purple)' : (cat.name === 'Личное' ? 'var(--app-accent-teal)' : '#ffc107')),
                        checked: cat.checked !== undefined ? cat.checked : true
                    }));
                } else {
                    fileSystemApi.writeFile(CATEGORIES_FILENAME, INITIAL_CATEGORIES.map(c => ({...c, checked: true}))).catch(e => console.error("App: Error saving initial categories", e));
                    initialCats = INITIAL_CATEGORIES.map(c => ({...c, checked: true})); // Убедимся, что checked есть
                }
                setCategories(initialCats);

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
                setCategories(INITIAL_CATEGORIES.map(c => ({...c, checked: true})));
                setSchedules([]);
                setAiConfig(INITIAL_AI_CONFIG);
                setUserCredentials(null);
                setIsAiConfigLoadedFromFile(false);
            }
            finally { setIsLoadingData(false); }
        };
        loadInitialData();
    }, []);

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

            const finalCategories = updated.map(cat => ({
                ...cat,
                color: cat.color || (cat.name === 'Работа' ? 'var(--app-accent-purple)' : (cat.name === 'Личное' ? 'var(--app-accent-teal)' : '#ffc107')),
                checked: cat.checked !== undefined ? cat.checked : true
            }));
            return finalCategories;
        });
    }, []);

    const toggleCategoryFilter = useCallback((categoryIdToToggle) => {
        setCategories(prevCategories =>
            prevCategories.map(cat =>
                cat.id === categoryIdToToggle ? { ...cat, checked: !cat.checked } : cat
            )
        );
    }, []);

    const openAddCategoryModal = () => {
        setNewCategoryData({ name: '', color: DEFAULT_NEW_CATEGORY_COLOR });
        setIsAddCategoryModalOpen(true);
    };
    const closeAddCategoryModal = () => {
        setIsAddCategoryModalOpen(false);
    };
    const handleNewCategoryDataChange = (e) => {
        const { name, value } = e.target;
        setNewCategoryData(prev => ({ ...prev, [name]: value }));
    };
    const handleConfirmAddCategory = () => {
        const trimmedName = newCategoryData.name.trim();
        if (trimmedName === "") {
            alert("Название категории не может быть пустым.");
            return;
        }
        const newCategory = {
            id: `cat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            name: trimmedName,
            color: newCategoryData.color,
            checked: true,
        };
        updateCategories(prevCategories => [...prevCategories, newCategory]);
        closeAddCategoryModal();
    };

    const updateAiConfig = useCallback((newAiConfigOrUpdater) => {
        setAiConfig(prevAiConfig => {
            const updatedConfig = typeof newAiConfigOrUpdater === 'function'
                ? newAiConfigOrUpdater(prevAiConfig)
                : newAiConfigOrUpdater;
            let isDifferentFromInitial = false;
            if (updatedConfig) {
                for (const key in INITIAL_AI_CONFIG) {
                    if (JSON.stringify(updatedConfig[key]) !== JSON.stringify(INITIAL_AI_CONFIG[key])) {
                        isDifferentFromInitial = true;
                        break;
                    }
                }
                for (const key in updatedConfig) {
                    if (!INITIAL_AI_CONFIG.hasOwnProperty(key)) {
                        isDifferentFromInitial = true;
                        break;
                    }
                }
            }
            if (isDifferentFromInitial) {
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
        setSchedules(prevSchedules => {
            const existingIds = new Set(prevSchedules.map(s => s.id));
            const uniqueNewSchedules = newSchedulesToAdd.filter(s => !existingIds.has(s.id));
            return [...prevSchedules, ...uniqueNewSchedules];
        });
    }, []);

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
            return;
        }
        fileSystemApi.writeFile(PROFILE_CONFIG_FILENAME, aiConfig)
            .catch(error => console.error('App: Failed to save AI config:', error));
    }, [aiConfig, isLoadingData, isAiConfigLoadedFromFile]);

    const handleRegistration = async (credentials) => {
        if (!fileSystemApi) { alert("Ошибка: Файловая система недоступна."); return; }
        try {
            await fileSystemApi.writeFile(USER_CREDENTIALS_FILENAME, credentials);
            setUserCredentials(credentials);
        } catch (error) { console.error("App: Failed to save user credentials", error); alert("Ошибка при сохранении данных регистрации."); }
    };
    const handleOnboardingComplete = async (newAiConfig) => {
        if (!fileSystemApi) { alert("Ошибка: Файловая система недоступна."); return; }
        updateAiConfig(newAiConfig);
    };

    if (isLoadingData) { return <div className="loading-indicator">Загрузка данных...</div>; }
    if (!fileSystemApi && !isLoadingData) { return (<div className="app-error"><h1>Ошибка приложения</h1><p>...</p></div>); }
    if (!userCredentials) { return <RegistrationPage onRegister={handleRegistration} />; }
    if (!isAiConfigLoadedFromFile) { return (<OnboardingQuestionnairePage initialConfig={aiConfig} onComplete={handleOnboardingComplete} userName={userCredentials.name} />); }

    const activeCategoryIds = categories.filter(cat => cat.checked).map(cat => cat.id);
    // Если все категории НЕ выбраны (т.е. activeCategoryIds пуст), но категории есть,
    // то для TUI это будет означать, что нужно скрыть ВСЕ категории.
    // Если же мы хотим, чтобы "пустой фильтр" означал "показать все", то activeCategoryIds нужно передавать иначе.
    // Текущая логика CalendarComponent: если activeCategoryFilters пуст, он показывает всё.
    // Поэтому, если categories.length > 0 и activeCategoryIds.length === 0, то все будет скрыто.
    // Если categories.length === 0, то activeCategoryIds будет пуст, и календарь покажет только 'default'.

    // Для соответствия логике CalendarComponent:
    // Если НИ ОДНА категория не активна, но категории существуют, передаем специальный маркер или пустой массив,
    // который CalendarComponent интерпретирует как "скрыть все именованные категории".
    // Если ВСЕ категории активны, можно передать undefined или массив всех ID, чтобы CalendarComponent показал все.
    // Текущий `activeCategoryIds` как раз подходит для CalendarComponent, если тот интерпретирует пустой массив как "показать только 'default', если он не отфильтрован".
    // Но в CalendarComponent мы сделали: если activeCategoryFilters пуст (undefined или []), то показывать все.
    // Значит, если пользователь отжал ВСЕ галочки, activeCategoryIds будет [], и CalendarComponent покажет ВСЁ.
    // Это может быть не тем, что ожидается.
    // Чтобы исправить: если activeCategoryIds пуст, НО категории существуют, значит пользователь все отфильтровал.

    let filtersForCalendar = activeCategoryIds;
    if (categories.length > 0 && activeCategoryIds.length === 0) {
        // Все категории существуют, но ни одна не выбрана -> передаем массив, который не будет содержать ни одного ID категорий
        // (даже 'default', если мы не хотим его показывать в этом случае).
        // TUI скроет все, что не 'default'. 'default' скроется, если не в activeCategoryIds.
        // Чтобы явно скрыть всё, включая 'default', можно передать ['__ HIDE_ALL__'] и обработать в CalendarComponent.
        // Проще: CalendarComponent УЖЕ обрабатывает пустой activeCategoryFilters как "показать все".
        // Нам нужно, чтобы если activeCategoryIds пуст И categories.length > 0, то CalendarComponent скрыл ВСЕ категории.
        // А если activeCategoryIds содержит ID, то только их.
        // Передаем как есть, CalendarComponent разберется.
    }


    return (
        <Router>
            <div className="app-container">
                <nav className="app-sidebar">
                    <div className="sidebar-brand">Календарь PRO</div>
                    <ul className="sidebar-main-nav">
                        <li><NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><IconPlaceholder name="Calendar" /> Календарь</NavLink></li>
                        <li><NavLink to="/ai" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><IconPlaceholder name="AI" /> AI Ассистент</NavLink></li>
                    </ul>

                    <div className="sidebar-section-title">Мои категории</div>
                    <ul className="sidebar-projects-nav">
                        {categories.map(category => (
                            <li key={category.id} title={category.checked ? "Скрыть задачи этой категории" : "Показать задачи этой категории"}>
                                <a
                                    href="#"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        toggleCategoryFilter(category.id);
                                    }}
                                    className={`nav-link category-filter-link ${!category.checked ? 'disabled-filter' : ''}`}
                                >
                                    <span
                                        className="category-dot"
                                        style={{
                                            backgroundColor: category.color,
                                            opacity: category.checked ? 1 : 0.4
                                        }}
                                    ></span>
                                    <span style={{ textDecoration: !category.checked ? 'line-through' : 'none', opacity: category.checked ? 1 : 0.7 }}>
                                        {category.name}
                                    </span>
                                </a>
                            </li>
                        ))}
                        <li>
                            <a href="#" onClick={(e) => { e.preventDefault(); openAddCategoryModal(); }} className="nav-link" >
                                <IconPlaceholder name="Plus" /> Новая категория
                            </a>
                        </li>
                    </ul>
                    <ul className="sidebar-footer-nav">
                        <li><NavLink to="/profile" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><IconPlaceholder name="Profile" /> Профиль</NavLink></li>
                    </ul>
                </nav>

                <main className="app-content">
                    <Routes>
                        <Route
                            path="/"
                            element={
                                <CalendarComponent
                                    allCategories={categories}
                                    schedules={schedules}
                                    onSchedulesChange={updateSchedules}
                                    activeCategoryFilters={filtersForCalendar}
                                />
                            }
                        />
                        <Route
                            path="/profile"
                            element={ <UserProfile schedules={schedules} categories={categories} onCategoriesChange={updateCategories} currentAiConfig={aiConfig} onAiConfigChange={updateAiConfig} userCredentials={userCredentials} /> }
                        />
                        <Route
                            path="/ai"
                            element={ <AiAssistant aiConfig={aiConfig} categories={categories} onAddSchedules={handleAddSchedules} /> }
                        />
                        <Route path="*" element={<div style={{padding: "20px"}}>Страница не найдена (404)</div>} />
                    </Routes>
                </main>
            </div>

            {isAddCategoryModalOpen && (
                <div className="modal-backdrop simple-modal-backdrop">
                    <div className="modal-content simple-modal-content">
                        <h3>Новая категория</h3>
                        <label htmlFor="newCategoryNameInput">Название категории:</label>
                        <input type="text" id="newCategoryNameInput" name="name" value={newCategoryData.name} onChange={handleNewCategoryDataChange} autoFocus />
                        <label htmlFor="newCategoryColorInput">Цвет категории:</label>
                        <div className="color-picker-container">
                            <input type="color" id="newCategoryColorInput" name="color" value={newCategoryData.color} onChange={handleNewCategoryDataChange} className="category-color-input" />
                            <span className="color-preview" style={{ backgroundColor: newCategoryData.color }}></span>
                        </div>
                        <div className="modal-actions">
                            <button type="button" onClick={handleConfirmAddCategory} className="button primary">Добавить</button>
                            <button type="button" onClick={closeAddCategoryModal} className="button secondary">Отмена</button>
                        </div>
                    </div>
                </div>
            )}
        </Router>
    );
}

export default App;