import React, { useState, useEffect, useRef, useCallback } from 'react';
import Calendar from 'tui-calendar';
import 'tui-calendar/dist/tui-calendar.css';
import 'tui-date-picker/dist/tui-date-picker.css';
import 'tui-time-picker/dist/tui-time-picker.css';
import './Calendar.css'; // Убедитесь, что этот файл существует и обновлен

const generateId = () => `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// --- Date Helper Functions ---
const parseInputDate = (input) => {
    if (!input) return null;
    if (typeof input.toDate === 'function') { // TUI TZDate
        return input.toDate();
    }
    if (input instanceof Date) { // JavaScript Date
        return new Date(input.getTime()); // Clone
    }
    if (typeof input === 'string') { // Date string
        const d = new Date(input);
        if (!isNaN(d.getTime())) {
            return d;
        }
    }
    // console.warn("parseInputDate: Unparseable date input", input);
    return null;
};

const formatDateToDateTimeLocalString = (dateObj) => {
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    const year = dateObj.getFullYear();
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const day = dateObj.getDate().toString().padStart(2, '0');
    const hours = dateObj.getHours().toString().padStart(2, '0');
    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatDateToDateString = (dateObj) => {
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    const year = dateObj.getFullYear();
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const day = dateObj.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Иконки-плейсхолдеры (ЗАМЕНИТЕ НА РЕАЛЬНЫЕ ИКОНКИ, например, из react-icons)
const SearchIcon = () => <span role="img" aria-label="search" style={{display: 'flex', alignItems: 'center', color: 'var(--app-text-placeholder)'}}>🔍</span>;
const NotificationIcon = () => <span role="img" aria-label="notifications" style={{ fontSize: '1.2em', display: 'flex', alignItems: 'center' }}>🔔</span>;
// const SettingsIcon = () => <span role="img" aria-label="settings" style={{ fontSize: '1.1em' }}>⚙️</span>;
const CollapseSidebarIcon = () => <span role="img" aria-label="collapse sidebar" style={{ fontSize: '1.2em', display: 'flex', alignItems: 'center' }}>«</span>;


// Компонент CalendarComponent
const CalendarComponent = ({ allCategories, schedules: schedulesFromApp, onSchedulesChange, activeCategoryFilters }) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentScheduleData, setCurrentScheduleData] = useState(null);
    const [modalErrorMessage, setModalErrorMessage] = useState('');

    const [currentCalendarTitle, setCurrentCalendarTitle] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeView, setActiveView] = useState('month'); // Начальный вид

    const calendarContainerRef = useRef(null);
    const calendarInstanceRef = useRef(null);
    const titleInputRef = useRef(null);
    const schedulesRef = useRef(schedulesFromApp);
    const categoriesRef = useRef(allCategories);

    useEffect(() => { schedulesRef.current = schedulesFromApp; }, [schedulesFromApp]);
    useEffect(() => { categoriesRef.current = allCategories; }, [allCategories]);

    const formatScheduleForModal = useCallback((scheduleInput) => {
        const source = scheduleInput.raw || scheduleInput;
        const startDateObj = parseInputDate(scheduleInput.start || source.start);
        const endDateObj = parseInputDate(scheduleInput.end || source.end);
        let isAllDay = scheduleInput.isAllDay;
        if (isAllDay === undefined && source && source.isAllDay !== undefined) { isAllDay = source.isAllDay; }
        else if (isAllDay === undefined && scheduleInput.category === 'allday') { isAllDay = true; }
        else if (isAllDay === undefined) { isAllDay = false; }
        const startString = isAllDay ? formatDateToDateString(startDateObj) : formatDateToDateTimeLocalString(startDateObj);
        let effectiveEndObj = endDateObj;
        if (isAllDay && startDateObj) { effectiveEndObj = new Date(startDateObj); }
        else if (!isAllDay && startDateObj) { if (!endDateObj || (endDateObj.getTime() <= startDateObj.getTime())) { effectiveEndObj = new Date(startDateObj.getTime() + 3600000); } }
        const endString = isAllDay ? formatDateToDateString(effectiveEndObj) : formatDateToDateTimeLocalString(effectiveEndObj);
        const subtasks = (Array.isArray(source.subtasks) ? source.subtasks : []).map(st => ({ id: st.id || generateId(), text: st.text || '', completed: !!st.completed }));
        const currentCategoriesList = Array.isArray(categoriesRef.current) ? categoriesRef.current : [];
        let categoryIdToSet;
        if (scheduleInput.id === null || scheduleInput.id === undefined) {
            categoryIdToSet = scheduleInput.categoryId;
            if (categoryIdToSet === undefined && currentCategoriesList.length > 0) { categoryIdToSet = null; }
            else if (categoryIdToSet === undefined) { categoryIdToSet = null; }
        } else { categoryIdToSet = source.categoryId ?? scheduleInput.categoryId ?? null; }
        const title = (source.title ?? scheduleInput.title?.replace(/^✅\s*/, '').replace(/\s*\(\d+\/\d+\)$/, '')) || '';
        return {
            id: scheduleInput.id, categoryId: categoryIdToSet, title, description: source.description ?? '', isAllDay,
            start: startString, end: endString, location: source.location ?? '', priority: source.priority ?? 'Medium',
            completed: source.completed ?? false, subtasks,
        };
    }, []);

    const formatModalDataForState = useCallback((modalData) => {
        const id = modalData.id || generateId();
        const subtasks = (Array.isArray(modalData.subtasks) ? modalData.subtasks : [])
            .map(st => ({ id: st.id || generateId(), text: st.text || '', completed: !!st.completed }))
            .filter(st => st.text.trim() !== '');
        return {
            id: id, categoryId: modalData.categoryId === '' ? null : modalData.categoryId,
            title: modalData.title || '', description: modalData.description || '',
            isAllDay: modalData.isAllDay || false, start: modalData.start, end: modalData.end,
            location: modalData.location || '', priority: modalData.priority || 'Medium',
            completed: modalData.completed || false, subtasks: subtasks,
        };
    }, []);

    const convertStateToTuiFormat = useCallback((stateSchedule) => {
        const currentCategoriesList = Array.isArray(categoriesRef.current) ? categoriesRef.current : [];
        const categoryInfo = stateSchedule.categoryId ? currentCategoriesList.find(c => c.id === stateSchedule.categoryId) : null;
        let start = null, end = null;
        try {
            if (stateSchedule.start) start = new Date(stateSchedule.start);
            if (stateSchedule.isAllDay && start) {
                if (stateSchedule.end) { const parsedEnd = new Date(stateSchedule.end); if (!isNaN(parsedEnd.getTime())) end = parsedEnd; }
                if (!end) end = new Date(start);
            } else if (stateSchedule.end) { end = new Date(stateSchedule.end); }
            if (start && isNaN(start.getTime())) start = null;
            if (end && isNaN(end.getTime())) end = null;
            if (!stateSchedule.isAllDay && start && end && end.getTime() <= start.getTime()) end = new Date(start.getTime() + 3600000);
        } catch (e) { console.error("Error parsing date for TUI:", stateSchedule, e); }
        const tuiCalendarId = stateSchedule.categoryId || 'default';
        const tuiBgColor = categoryInfo?.color || 'var(--app-text-secondary)';
        const titlePrefix = stateSchedule.completed ? '✅ ' : '';
        let subtaskProgress = '';
        if (Array.isArray(stateSchedule.subtasks) && stateSchedule.subtasks.length > 0) {
            const completedCount = stateSchedule.subtasks.filter(st => st.completed).length;
            subtaskProgress = ` (${completedCount}/${stateSchedule.subtasks.length})`;
        }
        return {
            id: stateSchedule.id, calendarId: tuiCalendarId, title: `${titlePrefix}${stateSchedule.title}${subtaskProgress}`,
            category: stateSchedule.isAllDay ? 'allday' : 'time', isAllDay: stateSchedule.isAllDay,
            start: start ? start : undefined, end: end ? end : undefined, raw: { ...stateSchedule },
            color: 'var(--app-text-primary)', bgColor: tuiBgColor, borderColor: tuiBgColor, dragBgColor: tuiBgColor,
            isReadOnly: stateSchedule.completed, customStyle: stateSchedule.completed ? 'opacity: 0.6; text-decoration: line-through;' : '',
        };
    }, []);

    const formatScheduleForModalRef = useRef(formatScheduleForModal);
    useEffect(() => { formatScheduleForModalRef.current = formatScheduleForModal; }, [formatScheduleForModal]);

    const openModal = (scheduleData, editMode) => {
        setCurrentScheduleData(scheduleData);
        setIsEditing(editMode);
        setModalErrorMessage('');
        setModalOpen(true);
    };
    const closeModal = () => {
        setModalOpen(false);
        setIsEditing(false);
        setModalErrorMessage('');
        if (calendarInstanceRef.current) { calendarInstanceRef.current.render(); }
    };
    const handleTUICreate = useCallback((event) => {
        const currentCategoriesList = Array.isArray(categoriesRef.current) ? categoriesRef.current : [];
        const defaultCategory = currentCategoriesList.find(c => c.checked !== false) || currentCategoriesList[0] || { id: null };
        const scheduleDataForModal = formatScheduleForModalRef.current({
            id: null, categoryId: defaultCategory.id, title: '', isAllDay: event.isAllDay, start: event.start, end: event.end,
            location: '', priority: 'Medium', subtasks: [], description: '', completed: false
        });
        openModal(scheduleDataForModal, false);
    }, []); // Removed categoriesRef dependency as it's a ref

    const handleTUIClick = useCallback((event) => {
        if (!event.schedule) return;
        openModal(formatScheduleForModalRef.current(event.schedule), true);
    }, []); // Removed formatScheduleForModalRef dependency as it's a ref

    const handleTUIUpdate = useCallback((event) => {
        const { schedule, changes } = event;
        const currentSchedules = Array.isArray(schedulesRef.current) ? schedulesRef.current : [];
        const originalStateSchedule = currentSchedules.find(s => s.id === schedule.id);
        if (!originalStateSchedule) return;
        const tempScheduleForFormatting = {
            ...schedule.raw, id: schedule.id, start: changes.start || schedule.start, end: changes.end || schedule.end,
            isAllDay: changes.hasOwnProperty('isAllDay') ? changes.isAllDay : (changes.hasOwnProperty('category') ? changes.category === 'allday' : schedule.raw.isAllDay),
        };
        const formattedForModalStrings = formatScheduleForModalRef.current(tempScheduleForFormatting);
        const updatedDataForState = formatModalDataForState({
            ...originalStateSchedule, isAllDay: formattedForModalStrings.isAllDay,
            start: formattedForModalStrings.start, end: formattedForModalStrings.end,
        });
        onSchedulesChange(prev => prev.map(s => s.id === updatedDataForState.id ? updatedDataForState : s));
    }, [formatModalDataForState, onSchedulesChange]); // formatScheduleForModalRef is a ref

    const updateCalendarTitle = useCallback(() => {
        if (!calendarInstanceRef.current) return;
        const cal = calendarInstanceRef.current;
        const viewName = cal.getViewName();
        const date = cal.getDate().toDate();

        let titleText = '';
        if (viewName === 'month') {
            titleText = date.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
            if (!titleText.endsWith(' г.')) { titleText += ' г.'; }
        } else if (viewName === 'week') {
            const startDate = cal.getDateRangeStart().toDate();
            const endDate = cal.getDateRangeEnd().toDate();
            const startMonth = startDate.toLocaleString('ru-RU', { month: 'short' });
            const endMonth = endDate.toLocaleString('ru-RU', { month: 'short' });
            if (startDate.getFullYear() !== endDate.getFullYear()) {
                titleText = `${startDate.getDate()} ${startMonth} ${startDate.getFullYear()} г. - ${endDate.getDate()} ${endMonth} ${endDate.getFullYear()} г.`;
            } else if (startDate.getMonth() !== endDate.getMonth()) {
                titleText = `${startDate.getDate()} ${startMonth} - ${endDate.getDate()} ${endMonth} ${endDate.getFullYear()} г.`;
            } else {
                titleText = `${startDate.getDate()} - ${endDate.getDate()} ${endMonth} ${endDate.getFullYear()} г.`;
            }
        } else { // day or custom view like '4day'
            titleText = date.toLocaleString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
            if (!titleText.endsWith(' г.')) { titleText += ' г.'; }
        }
        setCurrentCalendarTitle(titleText);
    }, []);

    useEffect(() => {
        if (!calendarContainerRef.current) return;
        let cal = calendarInstanceRef.current;
        const isFirstInit = !cal;
        const currentAppCategories = Array.isArray(categoriesRef.current) ? categoriesRef.current : [];

        const tuiCalendarsDefinition = currentAppCategories.map(cat => ({
            id: cat.id, name: cat.name, color: 'var(--app-text-primary)',
            bgColor: cat.color, borderColor: cat.color, dragBgColor: cat.color,
        }));
        tuiCalendarsDefinition.push({
            id: 'default', name: 'Без категории', color: 'var(--app-text-primary)',
            bgColor: 'var(--app-text-secondary)', borderColor: 'var(--app-text-secondary)', dragBgColor: 'var(--app-text-secondary)'
        });

        if (isFirstInit) {
            cal = new Calendar(calendarContainerRef.current, {
                defaultView: activeView,
                taskView: false, scheduleView: ['time', 'allday'],
                useCreationPopup: false, useDetailPopup: false,
                calendars: tuiCalendarsDefinition,
                month: { startDayOfWeek: 1, daynames: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'], isAlways6Weeks: false, visibleWeeksCount: 6 },
                week: { startDayOfWeek: 1, daynames: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'], hourStart: 0, hourEnd: 24 },
                template: {
                    alldayTitle: () => 'Весь день',
                    timegridDisplayPrimayTime: (time) => `${String(time.hour).padStart(2, '0')}:00`,
                }
            });
            calendarInstanceRef.current = cal;
            cal.on('beforeCreateSchedule', handleTUICreate);
            cal.on('clickSchedule', handleTUIClick);
            cal.on('beforeUpdateSchedule', handleTUIUpdate);
            updateCalendarTitle();
        } else {
            cal.setCalendars(tuiCalendarsDefinition);
        }

        const lowerSearchTerm = searchTerm.toLowerCase();
        const searchedSchedules = searchTerm
            ? (Array.isArray(schedulesRef.current) ? schedulesRef.current : []).filter(s =>
                s.title?.toLowerCase().includes(lowerSearchTerm) ||
                s.description?.toLowerCase().includes(lowerSearchTerm) ||
                s.location?.toLowerCase().includes(lowerSearchTerm)
            )
            : (Array.isArray(schedulesRef.current) ? schedulesRef.current : []);

        const schedulesForTui = searchedSchedules.map(convertStateToTuiFormat).filter(s => s.start);

        cal.clear();
        if (schedulesForTui.length > 0) {
            try { cal.createSchedules(schedulesForTui); }
            catch (error) { console.error("Error creating TUI schedules:", error, schedulesForTui); }
        }

        const activeIdsSet = new Set(activeCategoryFilters || []);
        tuiCalendarsDefinition.forEach(tuiCalDef => {
            let isVisible;
            if (!activeCategoryFilters || activeCategoryFilters.length === 0) {
                isVisible = true;
            } else {
                isVisible = activeIdsSet.has(tuiCalDef.id);
            }
            try {
                cal.toggleSchedules(tuiCalDef.id, !isVisible, false);
            } catch (e) { /* console.warn(...) */ }
        });

        cal.render();

    }, [schedulesFromApp, allCategories, activeCategoryFilters, convertStateToTuiFormat, handleTUICreate, handleTUIClick, handleTUIUpdate, searchTerm, updateCalendarTitle, activeView]);

    useEffect(() => {
        const instance = calendarInstanceRef.current;
        return () => {
            if (instance) {
                instance.off('beforeCreateSchedule', handleTUICreate);
                instance.off('clickSchedule', handleTUIClick);
                instance.off('beforeUpdateSchedule', handleTUIUpdate);
                instance.destroy();
            }
            calendarInstanceRef.current = null;
        };
    }, [handleTUICreate, handleTUIClick, handleTUIUpdate]);

    const changeView = (viewName) => {
        let tuiViewName = viewName;
        if (viewName === '4day') {
            // TODO: Implement logic for '4day' view if TUI doesn't support it directly
            // For now, let it be 'week' or some other fallback
            tuiViewName = 'week';
            console.log("4-day view selected, TUI will show: " + tuiViewName);
        }
        calendarInstanceRef.current?.changeView(tuiViewName, true);
        setActiveView(viewName);
        updateCalendarTitle();
    };
    const navigate = (direction) => {
        const c = calendarInstanceRef.current;
        if(!c) return;
        if(direction === 'prev') c.prev();
        else if (direction === 'next') c.next();
        else if (direction === 'today') c.today();
        updateCalendarTitle();
    };

    const handleModalChange = (e) => {
        setCurrentScheduleData(prev => ({...prev, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value}));
        if (modalErrorMessage) setModalErrorMessage('');
    };
    const handlePriorityChange = (e) => { setCurrentScheduleData(prev => ({ ...prev, priority: e.target.value })); if (modalErrorMessage) setModalErrorMessage(''); };
    const handleSubtaskChange = (index, field, value) => { setCurrentScheduleData(prev => { const n = [...prev.subtasks]; n[index] = { ...n[index], [field]: value }; return { ...prev, subtasks: n }; }); };
    const handleAddSubtask = () => { setCurrentScheduleData(prev => ({ ...prev, subtasks: [...prev.subtasks, { id: generateId(), text: '', completed: false }] })); };
    const handleRemoveSubtask = (index) => { setCurrentScheduleData(prev => ({ ...prev, subtasks: prev.subtasks.filter((_, i) => i !== index) })); };
    const handleToggleTaskCompleted = () => { setCurrentScheduleData(prev => ({ ...prev, completed: !prev.completed })); if (modalErrorMessage) setModalErrorMessage(''); };

    const handleSaveEvent = () => {
        setModalErrorMessage('');
        if (!currentScheduleData || !currentScheduleData.title?.trim()) {
            setModalErrorMessage('Название задачи не может быть пустым.');
            if (titleInputRef.current) { titleInputRef.current.focus(); }
            return;
        }
        try {
            if (!currentScheduleData.start) throw new Error("Дата начала не может быть пустой.");
            const startDate = parseInputDate(currentScheduleData.start);
            if (!startDate || isNaN(startDate.getTime())) throw new Error("Неверный формат даты начала.");
            if (!currentScheduleData.isAllDay) {
                if (!currentScheduleData.end) throw new Error("Дата конца не может быть пустой для события со временем.");
                const endDate = parseInputDate(currentScheduleData.end);
                if (!endDate || isNaN(endDate.getTime())) throw new Error("Неверный формат даты конца.");
                if (endDate.getTime() < startDate.getTime()) throw new Error("Дата конца не может быть раньше даты начала.");
            }
        } catch (e) { setModalErrorMessage(e.message); return; }
        const scheduleForState = formatModalDataForState(currentScheduleData);
        if (isEditing) { onSchedulesChange(prev => prev.map(s => s.id === scheduleForState.id ? scheduleForState : s)); }
        else { onSchedulesChange(prev => [...prev, scheduleForState]); }
        closeModal();
    };
    const handleDeleteEvent = () => {
        if (!currentScheduleData || !currentScheduleData.id) return;
        onSchedulesChange(prev => prev.filter(s => s.id !== currentScheduleData.id));
        closeModal();
    };
    useEffect(() => {
        if (modalOpen && titleInputRef.current) {
            setTimeout(() => { titleInputRef.current.focus(); }, 100);
        }
    }, [modalOpen]);

    return (
        <div className="calendar-page-container">
            <div className="calendar-page-header-wrapper">
                <div className="calendar-header-top-row">
                    <div className="calendar-title-main">
                        <h1>{'Календарь, '}{currentCalendarTitle}</h1>
                    </div>
                    <div className="calendar-header-actions">
                        <div className="search-bar-container">
                            <SearchIcon />
                            <input
                                type="text"
                                placeholder="Поиск"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="calendar-search-input"
                            />
                        </div>
                    </div>
                </div>

                <div className="calendar-header-bottom-row">
                    <div className="calendar-view-controls">
                        <button onClick={() => changeView('day')} className={`button view-btn ${activeView === 'day' ? 'active-view' : ''}`}>День</button>
                        <button onClick={() => changeView('week')} className={`button view-btn ${activeView === 'week' ? 'active-view' : ''}`}>Неделя</button>
                        <button onClick={() => changeView('month')} className={`button view-btn ${activeView === 'month' ? 'active-view' : ''}`}>Месяц</button>
                    </div>
                    <div className="calendar-nav-controls">
                        <button onClick={() => navigate('prev')} className="button iconic nav-arrow" title="Назад">‹</button>
                        <button onClick={() => navigate('today')} className="button today-btn">Сегодня</button>
                        <button onClick={() => navigate('next')} className="button iconic nav-arrow" title="Вперед">›</button>
                    </div>
                </div>
            </div>

            <div ref={calendarContainerRef} className="tui-calendar-container-customtheme"></div>

            {modalOpen && currentScheduleData && (
                <div className="modal-backdrop">
                    <div className="modal-content">
                        <h3>{isEditing ? 'Редактировать Задачу' : 'Новая Задача'}</h3>
                        {modalErrorMessage && (<div className="modal-error-message">{modalErrorMessage}</div>)}
                        {isEditing && (
                            <label className="modal-checkbox-label main-task-completed">
                                <input type="checkbox" name="completed" checked={!!currentScheduleData.completed} onChange={handleToggleTaskCompleted} />
                                {currentScheduleData.completed ? 'Задача выполнена' : 'Отметить как выполненную'}
                            </label>
                        )}
                        <label htmlFor="taskTitleInput">Название:</label>
                        <input ref={titleInputRef} id="taskTitleInput" type="text" name="title" value={currentScheduleData.title} onChange={handleModalChange} required />
                        <label>Категория:
                            <select name="categoryId" value={currentScheduleData.categoryId || ''} onChange={handleModalChange}>
                                <option value="">Без категории</option>
                                {(Array.isArray(categoriesRef.current) ? categoriesRef.current : []).map(cat => ( <option key={cat.id} value={cat.id}>{cat.name}</option> ))}
                            </select>
                        </label>
                        <div className="modal-datetime-row">
                            <label className="modal-datetime-item">Начало:
                                <input type={currentScheduleData.isAllDay ? "date" : "datetime-local"} name="start" value={currentScheduleData.start || ''} onChange={handleModalChange} />
                            </label>
                            {!currentScheduleData.isAllDay && (
                                <label className="modal-datetime-item">Конец:
                                    <input type="datetime-local" name="end" value={currentScheduleData.end || ''} onChange={handleModalChange} min={currentScheduleData.isAllDay ? undefined : currentScheduleData.start} />
                                </label>
                            )}
                            <label className="modal-checkbox-label">
                                <input type="checkbox" name="isAllDay" checked={!!currentScheduleData.isAllDay} onChange={handleModalChange} /> Весь день
                            </label>
                        </div>
                        <label>Приоритет:
                            <select name="priority" value={currentScheduleData.priority} onChange={handlePriorityChange}>
                                <option value="Low">Низкий</option> <option value="Medium">Средний</option> <option value="High">Высокий</option>
                            </select>
                        </label>
                        <label>Место:<input type="text" name="location" value={currentScheduleData.location} onChange={handleModalChange} /></label>
                        <label>Описание:<textarea name="description" value={currentScheduleData.description} onChange={handleModalChange} rows={3}></textarea></label>
                        <div className="subtasks-section">
                            <h4>Чек-лист:</h4>
                            {currentScheduleData.subtasks.map((subtask, index) => (
                                <div key={subtask.id || index} className="subtask-item">
                                    <input type="checkbox" checked={!!subtask.completed} onChange={(e) => handleSubtaskChange(index, 'completed', e.target.checked)} />
                                    <input type="text" value={subtask.text} onChange={(e) => handleSubtaskChange(index, 'text', e.target.value)} placeholder="Подзадача" style={subtask.completed ? { textDecoration: 'line-through', opacity: 0.7 } : {}}/>
                                    <button type="button" onClick={() => handleRemoveSubtask(index)} className="remove-subtask-btn plain">×</button>
                                </div>
                            ))}
                            <button type="button" onClick={handleAddSubtask} className="add-subtask-btn button secondary">+ Добавить</button>
                        </div>
                        <div className="modal-actions">
                            <button type="button" onClick={handleSaveEvent} className="button primary">{isEditing ? 'Сохранить' : 'Создать'}</button>
                            {isEditing && (<button type="button" onClick={handleDeleteEvent} className="button danger">Удалить</button>)}
                            <button type="button" onClick={closeModal} className="button secondary">Отмена</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarComponent;