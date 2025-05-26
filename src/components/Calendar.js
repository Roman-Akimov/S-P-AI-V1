import React, { useState, useEffect, useRef, useCallback } from 'react';
import Calendar from 'tui-calendar';
import 'tui-calendar/dist/tui-calendar.css';
import 'tui-date-picker/dist/tui-date-picker.css';
import 'tui-time-picker/dist/tui-time-picker.css';
import './Calendar.css';

const generateId = () => `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const parseInputDate = (input) => {
    if (!input) return null;
    if (typeof input.toDate === 'function') { return input.toDate(); }
    if (input instanceof Date) { return new Date(input.getTime()); }
    if (typeof input === 'string') { const d = new Date(input); if (!isNaN(d.getTime())) { return d; } }
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

const CalendarComponent = ({ allCategories, schedules: schedulesFromApp, onSchedulesChange, activeCategoryFilters }) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentScheduleData, setCurrentScheduleData] = useState(null);
    const [modalErrorMessage, setModalErrorMessage] = useState('');
    const calendarContainerRef = useRef(null);
    const calendarInstanceRef = useRef(null);
    const titleInputRef = useRef(null);
    const schedulesRef = useRef(schedulesFromApp);
    const categoriesRef = useRef(allCategories); // Используем для получения актуальных категорий

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

    const formatModalDataForState = useCallback((modalData) => { /* ... как было ... */
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

    const convertStateToTuiFormat = useCallback((stateSchedule) => { /* ... как было ... */
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

    const openModal = (scheduleData, editMode) => { /* ... как было ... */
        setCurrentScheduleData(scheduleData);
        setIsEditing(editMode);
        setModalErrorMessage('');
        setModalOpen(true);
    };
    const closeModal = () => { /* ... как было ... */
        setModalOpen(false);
        setIsEditing(false);
        setModalErrorMessage('');
        if (calendarInstanceRef.current) { calendarInstanceRef.current.render(); }
    };
    const handleTUICreate = useCallback((event) => { /* ... как было ... */
        const currentCategoriesList = Array.isArray(categoriesRef.current) ? categoriesRef.current : [];
        const defaultCategory = currentCategoriesList.find(c => c.checked !== false) || currentCategoriesList[0] || { id: null };
        const scheduleDataForModal = formatScheduleForModalRef.current({
            id: null, categoryId: defaultCategory.id, title: '', isAllDay: event.isAllDay, start: event.start, end: event.end,
            location: '', priority: 'Medium', subtasks: [], description: '', completed: false
        });
        openModal(scheduleDataForModal, false);
    }, []);
    const handleTUIClick = useCallback((event) => { /* ... как было ... */
        if (!event.schedule) return;
        openModal(formatScheduleForModalRef.current(event.schedule), true);
    }, []);
    const handleTUIUpdate = useCallback((event) => { /* ... как было ... */
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
    }, [formatModalDataForState, onSchedulesChange]);

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
                defaultView: 'week', taskView: false, scheduleView: ['time', 'allday'],
                useCreationPopup: false, useDetailPopup: false,
                calendars: tuiCalendarsDefinition,
                month: { startDayOfWeek: 1, daynames: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], isAlways6Weeks: false, visibleWeeksCount: 6 },
                week: { startDayOfWeek: 1, daynames: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], hourStart: 7, hourEnd: 23, },
                template: {
                    alldayTitle: () => 'Весь день',
                    timegridDisplayPrimayTime: (time) => `${String(time.hour).padStart(2, '0')}:00`,
                    monthDayname: (model) => `<span class="tui-full-calendar-month-dayname-label">${model.label}</span>`,
                }
            });
            calendarInstanceRef.current = cal;
            cal.on('beforeCreateSchedule', handleTUICreate);
            cal.on('clickSchedule', handleTUIClick);
            cal.on('beforeUpdateSchedule', handleTUIUpdate);
        } else {
            cal.setCalendars(tuiCalendarsDefinition);
        }

        const currentSchedulesToDisplay = Array.isArray(schedulesRef.current) ? schedulesRef.current : [];
        const schedulesForTui = currentSchedulesToDisplay.map(convertStateToTuiFormat).filter(s => s.start);

        cal.clear();
        if (schedulesForTui.length > 0) {
            try { cal.createSchedules(schedulesForTui); }
            catch (error) { console.error("Error creating TUI schedules:", error, schedulesForTui); }
        }

        // Управление видимостью календарей на основе activeCategoryFilters
        const activeIds = new Set(activeCategoryFilters || []);
        const allAppCategoryIds = new Set(currentAppCategories.map(c => c.id));

        tuiCalendarsDefinition.forEach(tuiCalDef => {
            let shouldBeVisible;
            // Если activeCategoryFilters не определен или пуст, ИЛИ все категории приложения выбраны, то показываем все.
            // Либо если activeCategoryFilters содержит ID текущего TUI календаря.
            if (activeCategoryFilters === undefined || activeCategoryFilters.length === 0 || activeCategoryFilters.length === allAppCategoryIds.size) {
                shouldBeVisible = true; // Показать все, если нет активных фильтров или все выбраны
            } else {
                shouldBeVisible = activeIds.has(tuiCalDef.id);
            }

            // Особая логика для 'default' (Без категории)
            // Если есть активные фильтры по категориям, и 'default' не в их числе, 'default' скрывается.
            // Если фильтров нет (показать все), 'default' виден.
            if (tuiCalDef.id === 'default' && activeCategoryFilters && activeCategoryFilters.length > 0 && !activeIds.has('default')) {
                // Если есть активные фильтры, и 'default' не среди них, то он не должен быть виден,
                // если только не было принято решение показывать его всегда при активных фильтрах.
                // Для строгого фильтра:
                // shouldBeVisible = activeIds.has('default'); // это будет false, если 'default' не в activeIds
            }


            try {
                cal.toggleSchedules(tuiCalDef.id, !shouldBeVisible, false); // false для renderRelated, чтобы не было многократных render
            } catch (e) { /* console.warn(`Could not toggle visibility for TUI calendar ${tuiCalDef.id}`, e); */ }
        });

        cal.render(); // Один render в конце

    }, [schedulesFromApp, allCategories, activeCategoryFilters, convertStateToTuiFormat, handleTUICreate, handleTUIClick, handleTUIUpdate]);

    useEffect(() => { /* ... очистка TUI Calendar instance ... */
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

    const changeView = (viewName) => { calendarInstanceRef.current?.changeView(viewName, true); };
    const navigate = (direction) => { const c = calendarInstanceRef.current; if(!c) return; if(direction === 'prev') c.prev(); else if (direction === 'next') c.next(); else if (direction === 'today') c.today(); };
    const handleModalChange = (e) => { /* ... как было ... */
        setCurrentScheduleData(prev => ({...prev, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value}));
        if (modalErrorMessage) setModalErrorMessage('');
    };
    const handlePriorityChange = (e) => { /* ... как было ... */
        setCurrentScheduleData(prev => ({ ...prev, priority: e.target.value }));
        if (modalErrorMessage) setModalErrorMessage('');
    };
    const handleSubtaskChange = (index, field, value) => { /* ... как было ... */
        setCurrentScheduleData(prev => { const n = [...prev.subtasks]; n[index] = { ...n[index], [field]: value }; return { ...prev, subtasks: n }; });
    };
    const handleAddSubtask = () => { /* ... как было ... */
        setCurrentScheduleData(prev => ({ ...prev, subtasks: [...prev.subtasks, { id: generateId(), text: '', completed: false }] }));
    };
    const handleRemoveSubtask = (index) => { /* ... как было ... */
        setCurrentScheduleData(prev => ({ ...prev, subtasks: prev.subtasks.filter((_, i) => i !== index) }));
    };
    const handleToggleTaskCompleted = () => { /* ... как было ... */
        setCurrentScheduleData(prev => ({ ...prev, completed: !prev.completed }));
        if (modalErrorMessage) setModalErrorMessage('');
    };
    const handleSaveEvent = () => { /* ... как было ... */
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
    const handleDeleteEvent = () => { /* ... как было ... */
        if (!currentScheduleData || !currentScheduleData.id) return;
        onSchedulesChange(prev => prev.filter(s => s.id !== currentScheduleData.id));
        closeModal();
    };
    useEffect(() => { /* ... автофокус ... */
        if (modalOpen && titleInputRef.current) {
            setTimeout(() => { titleInputRef.current.focus(); }, 100);
        }
    }, [modalOpen]);

    return (
        <>
            <div className="calendar-toolbar-main">
                <div className="calendar-toolbar-nav">
                    <button onClick={() => navigate('today')} className="button secondary">Сегодня</button>
                    <button onClick={() => navigate('prev')} className="button secondary">prev</button>
                    <button onClick={() => navigate('next')} className="button secondary">></button>
                </div>
                <div className="calendar-current-range"> </div>
                <div className="calendar-toolbar-viewmodes">
                    <button onClick={() => changeView('month')} className="button secondary">Месяц</button>
                    <button onClick={() => changeView('week')} className="button secondary">Неделя</button>
                    <button onClick={() => changeView('day')} className="button secondary">День</button>
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
        </>
    );
};

export default CalendarComponent;