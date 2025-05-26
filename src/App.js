// app.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import CalendarComponent from './components/Calendar';
import UserProfile from './components/UserProfile';
import AiAssistant from './components/AiAssistant';
import RegistrationPage from './components/RegistrationPage';
import OnboardingQuestionnairePage from './components/OnboardingQuestionnairePage';
import './App.css';

// Иконки (можно использовать react-icons)
const IconPlaceholder = ({ name, size = "1em", style = {}, onClick, title, className }) => (
    <span
        className={className} // Добавляем возможность передавать класс
        style={{
            // marginRight по умолчанию убран, добавляем через style, где нужно
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

    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryNameInput, setNewCategoryNameInput] = useState('');
    const [newCategoryColorInput, setNewCategoryColorInput] = useState(DEFAULT_NEW_CATEGORY_COLOR);
    const newCategoryNameInputRef = useRef(null);


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
                if (loadedCategoriesData && Array.isArray(loadedCategoriesData)) {
                    initialCats = loadedCategoriesData.map(cat => ({
                        ...cat,
                        color: cat.color || (cat.name === 'Работа' ? 'var(--app-accent-purple)' : (cat.name === 'Личное' ? 'var(--app-accent-teal)' : '#ffc107')),
                        checked: cat.checked !== undefined ? cat.checked : true
                    }));
                } else {
                    fileSystemApi.writeFile(CATEGORIES_FILENAME, INITIAL_CATEGORIES.map(c => ({...c, checked: true}))).catch(e => console.error("App: Error saving initial categories", e));
                    initialCats = INITIAL_CATEGORIES.map(c => ({...c, checked: true}));
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
        setNewCategoryNameInput('');
        setNewCategoryColorInput(DEFAULT_NEW_CATEGORY_COLOR);
    };

    const handleCancelAddNewCategory = () => {
        setIsAddingCategory(false);
        setNewCategoryNameInput('');
        setNewCategoryColorInput(DEFAULT_NEW_CATEGORY_COLOR);
    };

    const updateAiConfig = useCallback((newAiConfigOrUpdater) => {
        setAiConfig(prevAiConfig => {
            const updatedConfig = typeof newAiConfigOrUpdater === 'function' ? newAiConfigOrUpdater(prevAiConfig) : newAiConfigOrUpdater;
            let isDifferentFromInitial = false;
            if (updatedConfig) {
                for (const key in INITIAL_AI_CONFIG) { if (JSON.stringify(updatedConfig[key]) !== JSON.stringify(INITIAL_AI_CONFIG[key])) { isDifferentFromInitial = true; break; } }
                for (const key in updatedConfig) { if (!INITIAL_AI_CONFIG.hasOwnProperty(key)) { isDifferentFromInitial = true; break; } }
            }
            if (isDifferentFromInitial) { setIsAiConfigLoadedFromFile(true); }
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
        fileSystemApi.writeFile(CATEGORIES_FILENAME, categories).catch(e => console.error('App: Failed to save categories:', e));
    }, [categories, isLoadingData]);
    useEffect(() => {
        if (isLoadingData || !fileSystemApi) return;
        fileSystemApi.writeFile(SCHEDULES_FILENAME, schedules).catch(e => console.error('App: Failed to save schedules:', e));
    }, [schedules, isLoadingData]);
    useEffect(() => {
        if (isLoadingData || !fileSystemApi || !isAiConfigLoadedFromFile) return;
        fileSystemApi.writeFile(PROFILE_CONFIG_FILENAME, aiConfig).catch(e => console.error('App: Failed to save AI config:', e));
    }, [aiConfig, isLoadingData, isAiConfigLoadedFromFile]);

    const handleRegistration = async (credentials) => {
        if (!fileSystemApi) { alert("Ошибка: Файловая система недоступна."); return; }
        try { await fileSystemApi.writeFile(USER_CREDENTIALS_FILENAME, credentials); setUserCredentials(credentials); }
        catch (error) { console.error("App: Failed to save user credentials", error); alert("Ошибка при сохранении данных регистрации."); }
    };
    const handleOnboardingComplete = async (newAiConfig) => {
        if (!fileSystemApi) { alert("Ошибка: Файловая система недоступна."); return; }
        updateAiConfig(newAiConfig);
    };

    if (isLoadingData) { return <div className="loading-indicator">Загрузка данных...</div>; }
    if (!fileSystemApi && !isLoadingData) { return (<div className="app-error"><h1>Ошибка приложения</h1><p>Файловая система недоступна. Убедитесь, что приложение запущено корректно.</p></div>); }
    if (!userCredentials) { return <RegistrationPage onRegister={handleRegistration} />; }
    if (!isAiConfigLoadedFromFile) { return (<OnboardingQuestionnairePage initialConfig={aiConfig} onComplete={handleOnboardingComplete} userName={userCredentials.name} />); }

    const activeCategoryIds = categories.filter(cat => cat.checked).map(cat => cat.id);
    // Передаем activeCategoryIds напрямую, CalendarComponent уже обрабатывает пустой массив как "показать все"
    // или показывает только выбранные, если массив не пуст.
    const filtersForCalendar = activeCategoryIds;

    return (
        <Router>
            <div className="app-container">
                <nav className="app-sidebar">
                    <div className="sidebar-brand">
                        <span className="sidebar-brand-icon"></span>
                        Календарь PRO
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
                                        placeholder="Название категории"
                                        value={newCategoryNameInput}
                                        onChange={(e) => setNewCategoryNameInput(e.target.value)}
                                        onKeyPress={(e) => {if (e.key === 'Enter') handleSaveNewCategory(); if (e.key === 'Escape') handleCancelAddNewCategory();}}
                                        className="add-category-name-input"
                                    />
                                </div>
                                <div className="add-category-actions">
                                    <IconPlaceholder name="Check" onClick={handleSaveNewCategory} title="Сохранить" style={{marginRight: '5px'}}/>
                                    <IconPlaceholder name="Cross" onClick={handleCancelAddNewCategory} title="Отмена"/>
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
        </Router>
    );
}

export default App;