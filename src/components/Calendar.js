import React, { useState, useEffect, useRef, useCallback } from 'react';
import Calendar from 'tui-calendar';
import 'tui-calendar/dist/tui-calendar.css';
import 'tui-date-picker/dist/tui-date-picker.css';
import 'tui-time-picker/dist/tui-time-picker.css';
import './Calendar.css'; // Ваш кастомный CSS

// --- Начальные данные ---
const INITIAL_CATEGORIES = [
    { id: 'cat-1', name: 'Работа', color: '#00a9ff', checked: true },
    { id: 'cat-2', name: 'Личное', color: '#03bd9e', checked: true },
    { id: 'cat-3', name: 'Учеба', color: '#ffc107', checked: true },
];
const CATEGORIES_FILENAME = 'categories.json';
const SCHEDULES_FILENAME = 'schedules.json';

// --- Утилиты ---
const generateId = () => `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// --- API Файловой системы ---
const fileSystemApi = window.electronFs;
if (!fileSystemApi) {
    console.error("Electron filesystem API ('electronFs') is not available. Check preload script.");
}

// --- Компонент ---
const CalendarComponent = () => {
    // --- Состояния ---
    const [categories, setCategories] = useState(INITIAL_CATEGORIES);
    const [schedules, setSchedules] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentScheduleData, setCurrentScheduleData] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [sideBarOpen, setSideBarOpen] = useState(true);

    // --- Refs ---
    const calendarContainerRef = useRef(null);
    const calendarInstanceRef = useRef(null);
    const schedulesRef = useRef(schedules);
    const categoriesRef = useRef(categories);
    const formatScheduleForModalRef = useRef(null); // Ref для функции форматирования

    // --- Обновляем Refs при изменении state ---
    useEffect(() => { schedulesRef.current = schedules; }, [schedules]);
    useEffect(() => { categoriesRef.current = categories; }, [categories]);

    // --- Функция форматирования данных из TUI/модели в строки для модалки ---
    const formatScheduleForModal = useCallback((schedule) => {
        const parseInputDate = (input) => {
            if (!input) return null;
            if (typeof input.toDate === 'function') { const tz = input.toDate(); return tz instanceof Date && !isNaN(tz.getTime()) ? tz : null; }
            if (input instanceof Date && !isNaN(input.getTime())) return input;
            if (typeof input === 'string') { const p = new Date(input); return p instanceof Date && !isNaN(p.getTime()) ? p : null; }
            console.warn("[parseInputDate] Unsupported type:", typeof input); return null;
        };
        const formatDateToDateTimeLocalString = (d) => {
            if (!d || !(d instanceof Date) || isNaN(d.getTime())) { const n=new Date(), lN=new Date(n.getTime()-(n.getTimezoneOffset()*60000)); return lN.toISOString().slice(0,16); }
            const lD = new Date(d.getTime()-(d.getTimezoneOffset()*60000)); return lD.toISOString().slice(0,16);
        };
        const formatDateToDateString = (d) => {
            if (!d || !(d instanceof Date) || isNaN(d.getTime())) { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; }
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        };

        const source = schedule.raw || schedule;
        const startDateObj = parseInputDate(source.start);
        const endDateObj = parseInputDate(source.end);
        const isAllDay = source.isAllDay ?? schedule.isAllDay ?? schedule.category === 'allday';
        const startString = isAllDay ? formatDateToDateString(startDateObj) : formatDateToDateTimeLocalString(startDateObj);
        let effectiveEndObj = endDateObj;
        if (isAllDay && startDateObj) { effectiveEndObj = startDateObj; }
        else if (!isAllDay && (!endDateObj || (startDateObj && endDateObj <= startDateObj))) { effectiveEndObj = startDateObj ? new Date(startDateObj.getTime() + 3600000) : new Date(Date.now() + 3600000); }
        const endString = isAllDay ? formatDateToDateString(effectiveEndObj) : formatDateToDateTimeLocalString(effectiveEndObj);
        const subtasks = (Array.isArray(source.subtasks) ? source.subtasks : []).map(st => ({ id: st.id || generateId(), text: st.text || '', completed: !!st.completed }));
        const categoryId = source.categoryId ?? schedule.categoryId ?? categoriesRef.current?.[0]?.id ?? null;
        const title = source.title ?? schedule.title?.replace(/^✅\s*/, '').replace(/\s*\(\d+\/\d+\)$/, '') ?? '';
        const description = source.description ?? ''; const location = source.location ?? '';
        const priority = source.priority ?? 'Medium'; const completed = source.completed ?? false;

        return { id: schedule.id, categoryId, title, description, isAllDay, start: startString, end: endString, location, priority, completed, subtasks, };
    }, [categoriesRef]); // Зависит от categoriesRef

    // ---> Обновляем Ref для formatScheduleForModal <---
    useEffect(() => {
        formatScheduleForModalRef.current = formatScheduleForModal;
    }, [formatScheduleForModal]);

    // --- Функция форматирования данных из модалки (строки) для React state ---
    const formatModalDataForState = useCallback((modalData) => {
        const id = modalData.id || generateId();
        const subtasks = (Array.isArray(modalData.subtasks) ? modalData.subtasks : [])
            .map(st => ({ id: st.id || generateId(), text: st.text || '', completed: !!st.completed }))
            .filter(st => st.text.trim() !== '');
        return {
            id: id, categoryId: modalData.categoryId, title: modalData.title || '', description: modalData.description || '',
            isAllDay: modalData.isAllDay || false, start: modalData.start, end: modalData.end, location: modalData.location || '',
            priority: modalData.priority || 'Medium', completed: modalData.completed || false, subtasks: subtasks,
        };
    }, []);

    // --- Функция преобразования данных из state в формат для TUI API ---
    const convertStateToTuiFormat = useCallback((stateSchedule) => {
        const currentCategories = Array.isArray(categoriesRef.current) ? categoriesRef.current : [];
        const categoryInfo = currentCategories.find(c => c.id === stateSchedule.categoryId);
        let start = null, end = null;
        try {
            if (stateSchedule.start) start = new Date(stateSchedule.start);
            if (stateSchedule.isAllDay && start) { end = new Date(start); }
            else if (stateSchedule.end) { end = new Date(stateSchedule.end); }
            if (start && isNaN(start.getTime())) { start = null; }
            if (end && isNaN(end.getTime())) { end = null; }
        } catch (e) { console.error("Error parsing date from state for TUI:", stateSchedule, e); }

        const tuiCalendarId = stateSchedule.categoryId || 'default';
        const tuiBgColor = categoryInfo?.color || '#a1a1a1';
        const tuiBorderColor = tuiBgColor;
        const tuiColor = '#ffffff';
        const titlePrefix = stateSchedule.completed ? '✅ ' : '';
        let subtaskProgress = '';
        if (Array.isArray(stateSchedule.subtasks) && stateSchedule.subtasks.length > 0) {
            const completedCount = stateSchedule.subtasks.filter(st => st.completed).length;
            subtaskProgress = ` (${completedCount}/${stateSchedule.subtasks.length})`;
        }
        const rawData = { ...stateSchedule };

        return {
            id: stateSchedule.id, calendarId: tuiCalendarId, title: `${titlePrefix}${stateSchedule.title}${subtaskProgress}`,
            category: stateSchedule.isAllDay ? 'allday' : 'time', isAllDay: stateSchedule.isAllDay,
            start: start || undefined, end: end || undefined, raw: rawData,
            color: tuiColor, bgColor: tuiBgColor, borderColor: tuiBorderColor, dragBgColor: tuiBgColor,
            isReadOnly: stateSchedule.completed, customStyle: stateSchedule.completed ? 'opacity: 0.6; text-decoration: line-through;' : '',
        };
    }, [categoriesRef]);

    // --- Эффект для ЗАГРУЗКИ данных ---
    useEffect(() => {
        const loadData = async () => {
            if (!fileSystemApi) { setIsLoading(false); return; }
            setIsLoading(true);
            console.log('Loading data...');
            try {
                await fileSystemApi.ensureDataDir();
                const loadedCategories = await fileSystemApi.readFile(CATEGORIES_FILENAME);
                const loadedSchedules = await fileSystemApi.readFile(SCHEDULES_FILENAME);
                if (loadedCategories) { setCategories(loadedCategories); }
                else { setCategories(INITIAL_CATEGORIES); await fileSystemApi.writeFile(CATEGORIES_FILENAME, INITIAL_CATEGORIES); }
                if (loadedSchedules) { setSchedules(loadedSchedules); }
                else { setSchedules([]); }
            } catch (error) {
                console.error('Failed to load data:', error);
                setCategories(INITIAL_CATEGORIES);
                setSchedules([]);
            } finally {
                setIsLoading(false);
                console.log('Data loading finished.');
            }
        };
        loadData();
    }, []); // Только при монтировании

    // --- Эффекты для СОХРАНЕНИЯ данных ---
    useEffect(() => {
        if (isLoading || !fileSystemApi) return;
        console.log('Saving categories...');
        fileSystemApi.writeFile(CATEGORIES_FILENAME, categories).catch(e => console.error('Failed to save categories:', e));
    }, [categories, isLoading]);

    useEffect(() => {
        if (isLoading || !fileSystemApi) return;
        console.log('Saving schedules...');
        fileSystemApi.writeFile(SCHEDULES_FILENAME, schedules).catch(e => console.error('Failed to save schedules:', e));
    }, [schedules, isLoading]);

    // --- ОБРАБОТЧИКИ СОБЫТИЙ TUI (вынесены и обернуты в useCallback) ---
    const handleTUICreate = useCallback((event) => {
        console.log('[Handler] beforeCreateSchedule:', event);
        const currentCategories = Array.isArray(categoriesRef.current) ? categoriesRef.current : [];
        const defaultCategory = currentCategories.find(c => c.checked !== false) || currentCategories[0];
        if (formatScheduleForModalRef.current) {
            const scheduleDataForModal = formatScheduleForModalRef.current({
                id: null, categoryId: defaultCategory?.id, title: '', isAllDay: event.isAllDay, start: event.start, end: event.end,
                location: '', priority: 'Medium', subtasks: [], description: '', completed: false
            });
            setCurrentScheduleData(scheduleDataForModal);
            setIsEditing(false);
            setModalOpen(true); // <--- Открытие модалки
        } else {
            console.error("formatScheduleForModalRef is not set in handleTUICreate");
        }
    }, []); // Пустые зависимости

    const handleTUIClick = useCallback((event) => {
        console.log('[Handler] clickSchedule:', event);
        if (!event.schedule) return;
        if (formatScheduleForModalRef.current) {
            setCurrentScheduleData(formatScheduleForModalRef.current(event.schedule)); // Используем реф
            setIsEditing(true);
            setModalOpen(true); // <--- Открытие модалки
        } else {
            console.error("formatScheduleForModalRef is not set in handleTUIClick");
        }
    }, []); // Пустые зависимости

    const handleTUIUpdate = useCallback((event) => { // Drag/Resize
        console.log('[Handler] beforeUpdateSchedule:', event);
        const { schedule, changes } = event;
        const currentSchedules = Array.isArray(schedulesRef.current) ? schedulesRef.current : [];
        const originalStateSchedule = currentSchedules.find(s => s.id === schedule.id);
        if (!originalStateSchedule) return;
        if (formatScheduleForModalRef.current && formatModalDataForState) {
            const updatedDataForState = formatModalDataForState({
                ...originalStateSchedule,
                isAllDay: changes.hasOwnProperty('isAllDay') ? changes.isAllDay : (changes.hasOwnProperty('category') ? changes.category === 'allday' : schedule.isAllDay),
                start: formatScheduleForModalRef.current({ start: changes.start || schedule.start, isAllDay: changes.hasOwnProperty('isAllDay') ? changes.isAllDay : schedule.isAllDay }).start,
                end: formatScheduleForModalRef.current({ end: changes.end || schedule.end, isAllDay: changes.hasOwnProperty('isAllDay') ? changes.isAllDay : schedule.isAllDay }).end,
            });
            console.log('[Handler] beforeUpdateSchedule - updating React state:', updatedDataForState);
            setSchedules(prev => prev.map(s => s.id === updatedDataForState.id ? updatedDataForState : s));
        } else {
            console.error("Refs/functions not set in handleTUIUpdate");
        }
    }, [formatModalDataForState]); // Зависит от formatModalDataForState
    useEffect(() => {
        if (isLoading || !calendarContainerRef.current) return;
        let cal = calendarInstanceRef.current;
        const isFirstInit = !cal;

        if (isFirstInit) {
            console.log("[Effect TUI] Initializing...");
            const currentCategories = Array.isArray(categoriesRef.current) ? categoriesRef.current : [];
            const tuiCalendars = currentCategories.map(cat => ({ id: cat.id, name: cat.name, color: '#ffffff', bgColor: cat.color, borderColor: cat.color, dragBgColor: cat.color, }));
            tuiCalendars.push({ id: 'default', name: 'Без категории', color: '#ffffff', bgColor: '#a1a1a1', borderColor: '#a1a1a1', dragBgColor: '#a1a1a1'});
            try {
                cal = new Calendar(calendarContainerRef.current, {
                    defaultView: 'week', taskView: ['task', 'milestone'], scheduleView: ['time', 'allday'],
                    useCreationPopup: false, useDetailPopup: false, calendars: tuiCalendars,
                    month: { startDayOfWeek: 1, daynames: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], isAlways6Weeks: false, visibleWeeksCount: 0 },
                    week: { startDayOfWeek: 1, daynames: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], hourStart: 0, hourEnd: 24, narrowWeekend: false },
                    template: {
                        alldayTitle: function () { return 'Весь день'; },
                        timegridDisplayPrimayTime: function (time) {
                            if (typeof time.hour === 'undefined') return '';
                            const hour = String(time.hour).padStart(2, '0');
                            const minute = (typeof time.minute === 'number') ? String(time.minute).padStart(2, '0') : '00';
                            return `${hour}:${minute}`;
                        },
                    }
                });
                calendarInstanceRef.current = cal; console.log("[Effect TUI] Instance created.");
                // ---> УСТАНОВКА ОБРАБОТЧИКОВ (только раз, используем useCallback-версии) <---
                cal.on('beforeCreateSchedule', handleTUICreate);
                cal.on('clickSchedule', handleTUIClick);
                cal.on('beforeUpdateSchedule', handleTUIUpdate);
                console.log("[Effect TUI] Event handlers attached.");
            } catch (error) { console.error("[Effect TUI] Failed to initialize:", error); return; }
        } else {
            console.log("[Effect TUI] Updating existing instance.");
            const currentCategories = Array.isArray(categoriesRef.current) ? categoriesRef.current : [];
            const tuiCalendars = currentCategories.map(cat => ({ id: cat.id, name: cat.name, color: '#ffffff', bgColor: cat.color, borderColor: cat.color, dragBgColor: cat.color, }));
            tuiCalendars.push({ id: 'default', name: 'Без категории', color: '#ffffff', bgColor: '#a1a1a1', borderColor: '#a1a1a1', dragBgColor: '#a1a1a1'});
            cal.setCalendars(tuiCalendars);
        }

        // Синхронизация данных (всегда)
        if (cal) {
            console.log("[Effect TUI] Syncing schedules. Count:", schedulesRef.current?.length ?? 0);
            const currentSchedules = Array.isArray(schedulesRef.current) ? schedulesRef.current : [];
            const schedulesForTui = currentSchedules.map(convertStateToTuiFormat).filter(s => s.start);
            console.log("[Effect TUI] Schedules prepared for TUI:", schedulesForTui.length);
            cal.clear();
            if (schedulesForTui.length > 0) { try { cal.createSchedules(schedulesForTui); } catch(e){ console.error("Error in createSchedules:", e)} }
            console.log("[Effect TUI] Schedules synced.");
            const currentCategories = Array.isArray(categoriesRef.current) ? categoriesRef.current : [];
            const tuiCalendars = currentCategories.map(cat => ({ id: cat.id })); tuiCalendars.push({id: 'default'});
            console.log("[Effect TUI] Applying visibility...");
            tuiCalendars.forEach(tuiCal => { const categoryState = currentCategories.find(cat => cat.id === tuiCal.id); const isVisible = categoryState ? (categoryState.checked !== false) : (tuiCal.id === 'default'); try { cal.toggleSchedules(tuiCal.id, !isVisible, true); } catch (e) {} });
            console.log("[Effect TUI] Rendering...");
            cal.render(); console.log("[Effect TUI] Render finished.");
        } else { console.error("[Effect TUI] Cannot sync data, TUI instance is not available!"); }

        // Зависим от данных и функции конвертации
    }, [isLoading, schedules, categories, convertStateToTuiFormat]); // Убрали лишние колбэки

    // --- Эффект для очистки при размонтировании ---
    useEffect(() => {
        const instance = calendarInstanceRef.current; // Захватываем инстанс при монтировании/обновлении зависимостей
        return () => {
            console.log("[Effect Cleanup] Destroying TUI instance...");
            if (instance) { // Используем захваченный инстанс
                try { // Отписываемся от событий
                    instance.off('beforeCreateSchedule', handleTUICreate);
                    instance.off('clickSchedule', handleTUIClick);
                    instance.off('beforeUpdateSchedule', handleTUIUpdate);
                    console.log("[Effect Cleanup] Event handlers detached.");
                } catch(e) { console.error("[Effect Cleanup] Error detaching handlers:", e); }
                instance.destroy();
            }
            calendarInstanceRef.current = null;
            console.log("[Effect Cleanup] TUI Instance destroyed.");
        };
        // Зависим от useCallback-обработчиков, чтобы отписаться от правильных функций
    }, [handleTUICreate, handleTUIClick, handleTUIUpdate]);


    // --- Навигация и Управление Видом TUI ---
    const changeView = (viewName) => { calendarInstanceRef.current?.changeView(viewName, true); calendarInstanceRef.current?.render(); };
    const navigate = (direction) => { const c = calendarInstanceRef.current; if(!c) return; if(direction === 'prev') c.prev(); else if (direction === 'next') c.next(); else if (direction === 'today') c.today(); c.render(); };

    // --- Обработчики Модального Окна ---
    const handleModalChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : value;
        setCurrentScheduleData(prev => {
            const newState = { ...prev, [name]: newValue };
            if (name === 'isAllDay') { // Логика конвертации дат
                const currentlyIsAllDay = newValue; let currentStartDate = null, currentEndDate = null;
                try { if (newState.start) currentStartDate = new Date(newState.start); } catch (err) {}
                try { if (newState.end) currentEndDate = new Date(newState.end); } catch (err) {}
                const formatDateToDateTimeLocalString = (date) => { if (!date || isNaN(date.getTime())) { const n=new Date(); const lN=new Date(n.getTime()-(n.getTimezoneOffset()*60000)); return lN.toISOString().slice(0,16); } const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)); return localDate.toISOString().slice(0, 16); };
                const formatDateToDateString = (date) => { if (!date || isNaN(date.getTime())) { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; } return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; };
                newState.start = currentlyIsAllDay ? formatDateToDateString(currentStartDate) : formatDateToDateTimeLocalString(currentStartDate);
                if (currentlyIsAllDay) { newState.end = newState.start; }
                else { let endDateForInput = currentEndDate; if (!endDateForInput || isNaN(endDateForInput.getTime()) || (currentStartDate && endDateForInput.getTime() === currentStartDate.getTime())) { const baseTime = (currentStartDate && !isNaN(currentStartDate.getTime())) ? currentStartDate.getTime() : Date.now(); endDateForInput = new Date(baseTime + 3600 * 1000); } newState.end = formatDateToDateTimeLocalString(endDateForInput); }
                // console.log("[Modal Change] isAllDay toggled. New date strings:", newState.start, newState.end);
            } return newState;
        });
    };
    const handlePriorityChange = (e) => { setCurrentScheduleData(prev => ({ ...prev, priority: e.target.value })); };
    const handleSubtaskChange = (index, field, value) => { setCurrentScheduleData(prev => { const n = [...prev.subtasks]; n[index] = { ...n[index], [field]: value }; return { ...prev, subtasks: n }; }); };
    const handleAddSubtask = () => { setCurrentScheduleData(prev => ({ ...prev, subtasks: [...prev.subtasks, { id: generateId(), text: '', completed: false }] })); };
    const handleRemoveSubtask = (index) => { setCurrentScheduleData(prev => ({ ...prev, subtasks: prev.subtasks.filter((_, i) => i !== index) })); };
    const handleToggleTaskCompleted = () => { setCurrentScheduleData(prev => ({ ...prev, completed: !prev.completed })); };

    // --- Сохранение и Удаление (Обновляют ТОЛЬКО React state, TUI обновится через useEffect) ---
    const handleSaveEvent = () => {
        if (!currentScheduleData || !currentScheduleData.title?.trim()) return alert('Название не может быть пустым!');
        if (!currentScheduleData.categoryId) return alert('Выберите категорию!');
        try { if (!currentScheduleData.start || isNaN(new Date(currentScheduleData.start).getTime())) throw new Error("Неверная дата начала"); if (!currentScheduleData.isAllDay && (!currentScheduleData.end || isNaN(new Date(currentScheduleData.end).getTime()))) throw new Error("Неверная дата конца"); if (!currentScheduleData.isAllDay && new Date(currentScheduleData.end) < new Date(currentScheduleData.start)) throw new Error("Конец раньше начала"); } catch (e) { return alert(e.message); }
        const scheduleForState = formatModalDataForState(currentScheduleData);
        console.log('[Save Event] Data for state:', scheduleForState);
        if (isEditing) { setSchedules(prev => prev.map(s => s.id === scheduleForState.id ? scheduleForState : s)); }
        else { setSchedules(prev => [...prev, scheduleForState]); }
        setModalOpen(false); setCurrentScheduleData(null); setIsEditing(false);
    };

    const handleDeleteEvent = () => {
        if (!currentScheduleData || !currentScheduleData.id) return;
        console.log('[Delete Event] Deleting from state:', currentScheduleData.id);
        setSchedules(prev => prev.filter(s => s.id !== currentScheduleData.id));
        setModalOpen(false); setCurrentScheduleData(null); setIsEditing(false);
    };

    // --- Обработчики Сайбдара ---
    const handleCategoryToggle = (categoryId) => { setCategories(prev => prev.map(cat => cat.id === categoryId ? { ...cat, checked: !cat.checked } : cat )); };
    const handleSearch = (e) => { const query = e.target.value.toLowerCase(); setSearchQuery(query); if (!query) return setSearchResults([]); setSearchResults(schedulesRef.current.filter(s => s.title.toLowerCase().includes(query) || (s.description && s.description.toLowerCase().includes(query)) || (s.location && s.location.toLowerCase().includes(query)))); };

    // --- Рендер Компонента ---
    if (isLoading && !fileSystemApi) { return <div className="error-indicator">Ошибка ФС.</div>; }
    if (isLoading) { return <div className="loading-indicator">Загрузка...</div>; }

    return (
        <div className="calendar-wrapper">
            <div className="calendar-container">
                {/* --- Сайдбар --- */}
                {sideBarOpen && (
                    <div className="side-bar">
                        {/* Поиск */}
                        <div className="sidebar-section">
                            <h3>Поиск</h3>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={handleSearch}
                                placeholder="Название, описание, место..."
                                className="sidebar-input"
                            />
                            {searchResults.length > 0 && (
                                <div className="search-results">
                                    <h4>Результаты:</h4>
                                    {searchResults.map(event => {
                                        let dateString = '';
                                        try {
                                            const d=new Date(event.start);
                                            dateString = event.isAllDay ? d.toLocaleDateString() : d.toLocaleString();
                                        } catch(e){}
                                        return (
                                            <div
                                                key={event.id}
                                                className="search-result-item"
                                                onClick={() => {
                                                    // Используем сохраненные данные из state для модалки
                                                    setCurrentScheduleData(formatScheduleForModal(event));
                                                    setIsEditing(true);
                                                    setModalOpen(true);
                                                }}
                                            >
                                                <strong>{event.completed?'✅ ':''}{event.title}</strong>
                                                {event.description && <small><i>{event.description.substring(0,50)}{event.description.length>50?'...':''}</i></small>}
                                                {event.location && <small>Место: {event.location}</small>}
                                                <small>Дата: {dateString}</small>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            {searchQuery && searchResults.length === 0 && <p>Ничего не найдено.</p>}
                        </div>
                        {/* Категории */}
                        <div className="sidebar-section">
                            <h3>Категории</h3>
                            <ul className="calendar-list">
                                {categories.map(category => (
                                    <li key={category.id}>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={category.checked !== false}
                                                onChange={() => handleCategoryToggle(category.id)}
                                            />
                                            <span
                                                className="calendar-color-dot"
                                                style={{ backgroundColor: category.color }}>
                                            </span>
                                            {category.name}
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
                {/* --- Основной контент --- */}
                <div className={`calendar-content ${sideBarOpen ? 'with-sidebar' : ''}`}>
                    {/* Тулбар */}
                    <div className="calendar-toolbar">
                        <button
                            className="toggle-sidebar-button"
                            onClick={() => setSideBarOpen(!sideBarOpen)}>
                            {sideBarOpen ? 'Скрыть' : 'Показать'} панель
                        </button>
                        <button onClick={() => navigate('prev')}>Назад</button>
                        <button onClick={() => navigate('next')}>Вперед</button>
                        <button onClick={() => navigate('today')}>Сегодня</button>
                        <button onClick={() => changeView('month')}>Месяц</button>
                        <button onClick={() => changeView('week')}>Неделя</button>
                        <button onClick={() => changeView('day')}>День</button>
                    </div>
                    {/* Контейнер TUI */}
                    <div ref={calendarContainerRef} className="tui-calendar-container"></div>
                </div>
            </div>

            {/* --- Модальное окно --- */}
            {modalOpen && currentScheduleData && (
                <div className="modal-backdrop">
                    <div className="modal-content">
                        <h3>{isEditing ? 'Редактировать Задачу' : 'Добавить Задачу'}</h3>
                        {isEditing && (
                            <label className="modal-checkbox-label" style={{ justifyContent: 'center', marginBottom: '15px', fontWeight: 'bold' }}>
                                <input
                                    type="checkbox"
                                    name="completed"
                                    checked={!!currentScheduleData.completed}
                                    onChange={handleToggleTaskCompleted}
                                />
                                {currentScheduleData.completed ? 'Выполнено' : 'Отметить как выполненное'}
                            </label>
                        )}
                        <label>Название *:
                            <input
                                type="text"
                                name="title"
                                value={currentScheduleData.title}
                                onChange={handleModalChange}
                                required />
                        </label>
                        <label>Описание:
                            <textarea
                                name="description"
                                value={currentScheduleData.description}
                                onChange={handleModalChange}
                                rows={3}>
                            </textarea>
                        </label>
                        <label>Категория *:
                            <select
                                name="categoryId"
                                value={currentScheduleData.categoryId || ''}
                                onChange={handleModalChange} required>
                                <option value="" disabled>-- Выберите категорию --</option>
                                {categories.map(cat=>(
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </label>
                        <label>Приоритет:
                            <select
                                name="priority"
                                value={currentScheduleData.priority}
                                onChange={handlePriorityChange}>
                                <option value="Low">Низкий</option>
                                <option value="Medium">Средний</option>
                                <option value="High">Высокий</option>
                            </select>
                        </label>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
                            <label style={{ flexGrow: 1, marginBottom: 0 }}>Начало:
                                <input
                                    type={currentScheduleData.isAllDay?"date":"datetime-local"}
                                    name="start"
                                    value={currentScheduleData.start}
                                    onChange={handleModalChange}
                                />
                            </label>
                            {!currentScheduleData.isAllDay && (
                                <label style={{ flexGrow: 1, marginBottom: 0 }}>Конец:
                                    <input
                                        type="datetime-local"
                                        name="end"
                                        value={currentScheduleData.end}
                                        onChange={handleModalChange}
                                        min={currentScheduleData.start}
                                    />
                                </label>
                            )}
                            <label className="modal-checkbox-label" style={{ marginBottom: 0 }}>
                                <input
                                    type="checkbox"
                                    name="isAllDay"
                                    checked={!!currentScheduleData.isAllDay}
                                    onChange={handleModalChange}
                                />
                                Весь день
                            </label>
                        </div>
                        <label>Место:
                            <input
                                type="text"
                                name="location"
                                value={currentScheduleData.location}
                                onChange={handleModalChange}
                                placeholder="Местоположение"
                            />
                        </label>
                        <div className="subtasks-section">
                            <h4>Чек-лист / Подзадачи:</h4>
                            {currentScheduleData.subtasks.map((subtask, index) => (
                                <div key={subtask.id || index} className="subtask-item">
                                    <input
                                        type="checkbox"
                                        checked={!!subtask.completed}
                                        onChange={(e) => handleSubtaskChange(index, 'completed', e.target.checked)}
                                    />
                                    <input
                                        type="text"
                                        value={subtask.text}
                                        onChange={(e) => handleSubtaskChange(index, 'text', e.target.value)}
                                        placeholder="Новая подзадача"
                                        style={subtask.completed ? { textDecoration: 'line-through', opacity: 0.7 } : {}}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveSubtask(index)}
                                        className="remove-subtask-btn">
                                        ×
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={handleAddSubtask}
                                className="add-subtask-btn">
                                + Добавить подзадачу
                            </button>
                        </div>
                        <div className="modal-actions">
                            <button type="button" onClick={handleSaveEvent}>
                                {isEditing?'Сохранить':'Добавить'}
                            </button>
                            {isEditing && (
                                <button
                                    type="button"
                                    onClick={handleDeleteEvent}
                                    className="delete-button">
                                    Удалить
                                </button>
                            )}
                            <button type="button" onClick={() => { setModalOpen(false); }}>
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarComponent;