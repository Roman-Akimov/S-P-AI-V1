// components/Calendar.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Calendar from 'tui-calendar';
import 'tui-calendar/dist/tui-calendar.css';
import 'tui-date-picker/dist/tui-date-picker.css';
import 'tui-time-picker/dist/tui-time-picker.css';
import './Calendar.css'; // Этот CSS будет сильно переписан

const generateId = () => `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// API Файловой системы - УБРАНО, предполагается, что данные приходят через props
// const fileSystemApi = window.electronFs;

// Компонент CalendarComponent
const CalendarComponent = ({ allCategories, schedules: schedulesFromApp, onSchedulesChange, activeCategoryFilters }) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentScheduleData, setCurrentScheduleData] = useState(null);

    const calendarContainerRef = useRef(null);
    const calendarInstanceRef = useRef(null);

    // Refs для пропсов, чтобы избежать лишних зависимостей в useCallback/useEffect
    const schedulesRef = useRef(schedulesFromApp);
    const categoriesRef = useRef(allCategories);
    const activeFiltersRef = useRef(activeCategoryFilters);

    useEffect(() => { schedulesRef.current = schedulesFromApp; }, [schedulesFromApp]);
    useEffect(() => { categoriesRef.current = allCategories; }, [allCategories]);
    useEffect(() => { activeFiltersRef.current = activeCategoryFilters; }, [activeCategoryFilters]);


    const formatScheduleForModal = useCallback((schedule) => {
        // ... (функция как была, но использует categoriesRef.current)
        const parseInputDate = (input) => { /* ... */ };
        const formatDateToDateTimeLocalString = (d) => { /* ... */ };
        const formatDateToDateString = (d) => { /* ... */ };

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

        // Используем categoriesRef.current
        const currentCategories = Array.isArray(categoriesRef.current) ? categoriesRef.current : [];
        const categoryId = source.categoryId ?? schedule.categoryId ?? currentCategories?.[0]?.id ?? null;

        const title = source.title ?? schedule.title?.replace(/^✅\s*/, '').replace(/\s*\(\d+\/\d+\)$/, '') ?? '';
        const description = source.description ?? ''; const location = source.location ?? '';
        const priority = source.priority ?? 'Medium'; const completed = source.completed ?? false;

        return { id: schedule.id, categoryId, title, description, isAllDay, start: startString, end: endString, location, priority, completed, subtasks, };
    }, []); // categoriesRef не добавляем в зависимости, так как он сам по себе ref

    const formatModalDataForState = useCallback((modalData) => {
        // ... (функция как была)
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

    const convertStateToTuiFormat = useCallback((stateSchedule) => {
        // ... (функция как была, использует categoriesRef.current)
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

        const tuiCalendarId = stateSchedule.categoryId || 'default'; // Используем 'default' если нет категории
        const tuiBgColor = categoryInfo?.color || 'var(--app-text-secondary)'; // Цвет для "Без категории"
        const tuiBorderColor = tuiBgColor;
        const tuiColor = 'var(--app-text-primary)'; // Цвет текста на событии для темной темы
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
    }, []); // categoriesRef не добавляем в зависимости

    // Сохранение и загрузка данных теперь обрабатываются в App.js

    const formatScheduleForModalRef = useRef(formatScheduleForModal);
    useEffect(() => { formatScheduleForModalRef.current = formatScheduleForModal; }, [formatScheduleForModal]);


    // --- ОБРАБОТЧИКИ СОБЫТИЙ TUI ---
    const handleTUICreate = useCallback((event) => {
        const currentCategories = Array.isArray(categoriesRef.current) ? categoriesRef.current : [];
        const defaultCategory = currentCategories.find(c => c.checked !== false) || currentCategories[0];
        const scheduleDataForModal = formatScheduleForModalRef.current({
            id: null, categoryId: defaultCategory?.id, title: '', isAllDay: event.isAllDay, start: event.start, end: event.end,
            location: '', priority: 'Medium', subtasks: [], description: '', completed: false
        });
        setCurrentScheduleData(scheduleDataForModal);
        setIsEditing(false);
        setModalOpen(true);
    }, []); // formatScheduleForModalRef и categoriesRef - это рефы

    const handleTUIClick = useCallback((event) => {
        if (!event.schedule) return;
        setCurrentScheduleData(formatScheduleForModalRef.current(event.schedule));
        setIsEditing(true);
        setModalOpen(true);
    }, []); // formatScheduleForModalRef - это реф

    const handleTUIUpdate = useCallback((event) => {
        const { schedule, changes } = event;
        const currentSchedules = Array.isArray(schedulesRef.current) ? schedulesRef.current : [];
        const originalStateSchedule = currentSchedules.find(s => s.id === schedule.id);
        if (!originalStateSchedule) return;

        const updatedDataForState = formatModalDataForState({
            ...originalStateSchedule,
            isAllDay: changes.hasOwnProperty('isAllDay') ? changes.isAllDay : (changes.hasOwnProperty('category') ? changes.category === 'allday' : schedule.isAllDay),
            start: formatScheduleForModalRef.current({ start: changes.start || schedule.start, isAllDay: changes.hasOwnProperty('isAllDay') ? changes.isAllDay : schedule.isAllDay }).start,
            end: formatScheduleForModalRef.current({ end: changes.end || schedule.end, isAllDay: changes.hasOwnProperty('isAllDay') ? changes.isAllDay : schedule.isAllDay }).end,
        });
        onSchedulesChange(prev => prev.map(s => s.id === updatedDataForState.id ? updatedDataForState : s));
    }, [formatModalDataForState, onSchedulesChange]); // formatScheduleForModalRef и schedulesRef - рефы

    // --- Эффект для ИНИЦИАЛИЗАЦИИ и ОБНОВЛЕНИЯ TUI Calendar ---
    useEffect(() => {
        if (!calendarContainerRef.current) return;

        let cal = calendarInstanceRef.current;
        const isFirstInit = !cal;
        const currentAppCategories = Array.isArray(categoriesRef.current) ? categoriesRef.current : [];

        // Определение календарей для TUI (всегда на основе всех категорий из App)
        const tuiCalendarsDefinition = currentAppCategories.map(cat => ({
            id: cat.id, name: cat.name, color: 'var(--app-text-primary)', // Текст на событии
            bgColor: cat.color, borderColor: cat.color, dragBgColor: cat.color,
        }));
        tuiCalendarsDefinition.push({ // Дефолтный календарь для событий без категории
            id: 'default', name: 'Без категории', color: 'var(--app-text-primary)',
            bgColor: 'var(--app-text-secondary)', borderColor: 'var(--app-text-secondary)', dragBgColor: 'var(--app-text-secondary)'
        });

        if (isFirstInit) {
            cal = new Calendar(calendarContainerRef.current, {
                defaultView: 'week', taskView: false, // Убираем task/milestone, если не используются
                scheduleView: ['time', 'allday'],
                useCreationPopup: false, useDetailPopup: false,
                calendars: tuiCalendarsDefinition,
                month: { startDayOfWeek: 1, daynames: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], isAlways6Weeks: false, /* narrowWeekend: true */ },
                week: { startDayOfWeek: 1, daynames: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], hourStart: 7, hourEnd: 23, /* narrowWeekend: true */ },
                template: {
                    alldayTitle: () => 'Весь день',
                    timegridDisplayPrimayTime: (time) => {
                        const hour = String(time.hour).padStart(2, '0');
                        return `${hour}:00`; // Показываем только часы для темной темы
                    },
                    // Кастомизация для темной темы (может понадобиться больше)
                    monthDayname: (model) => `<span class="tui-full-calendar-month-dayname-label">${model.label}</span>`,
                }
            });
            calendarInstanceRef.current = cal;
            cal.on('beforeCreateSchedule', handleTUICreate);
            cal.on('clickSchedule', handleTUIClick);
            cal.on('beforeUpdateSchedule', handleTUIUpdate);
        } else {
            // Обновляем определения календарей, если категории изменились
            cal.setCalendars(tuiCalendarsDefinition);
        }

        // ФИЛЬТРАЦИЯ и ОТОБРАЖЕНИЕ СОБЫТИЙ
        const currentSchedulesToDisplay = Array.isArray(schedulesRef.current) ? schedulesRef.current : [];
        const currentActiveFilters = Array.isArray(activeFiltersRef.current) ? activeFiltersRef.current : [];

        let filteredSchedules;
        if (currentActiveFilters.length > 0) {
            filteredSchedules = currentSchedulesToDisplay.filter(s =>
                currentActiveFilters.includes(s.categoryId) ||
                (!s.categoryId && currentActiveFilters.includes('default')) // Для событий без категории
            );
        } else {
            filteredSchedules = currentSchedulesToDisplay; // Показываем все, если нет активных фильтров
        }

        const schedulesForTui = filteredSchedules.map(convertStateToTuiFormat).filter(s => s.start);
        cal.clear();
        if (schedulesForTui.length > 0) {
            cal.createSchedules(schedulesForTui);
        }
        cal.render();

    }, [schedulesFromApp, allCategories, activeCategoryFilters, convertStateToTuiFormat, handleTUICreate, handleTUIClick, handleTUIUpdate]); // Зависимости от пропсов и стабильных колбэков


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
    }, [handleTUICreate, handleTUIClick, handleTUIUpdate]); // Стабильные колбэки


    const changeView = (viewName) => { calendarInstanceRef.current?.changeView(viewName, true); };
    const navigate = (direction) => { const c = calendarInstanceRef.current; if(!c) return; if(direction === 'prev') c.prev(); else if (direction === 'next') c.next(); else if (direction === 'today') c.today(); };

    // ... (handleModalChange, handlePriorityChange, handleSubtaskChange, etc. - как были, но используют onSchedulesChange) ...
    const handleModalChange = (e) => { /* ... как было ... */ setCurrentScheduleData(prev => ({...prev, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value}));};
    const handlePriorityChange = (e) => { setCurrentScheduleData(prev => ({ ...prev, priority: e.target.value })); };
    const handleSubtaskChange = (index, field, value) => { setCurrentScheduleData(prev => { const n = [...prev.subtasks]; n[index] = { ...n[index], [field]: value }; return { ...prev, subtasks: n }; }); };
    const handleAddSubtask = () => { setCurrentScheduleData(prev => ({ ...prev, subtasks: [...prev.subtasks, { id: generateId(), text: '', completed: false }] })); };
    const handleRemoveSubtask = (index) => { setCurrentScheduleData(prev => ({ ...prev, subtasks: prev.subtasks.filter((_, i) => i !== index) })); };
    const handleToggleTaskCompleted = () => { setCurrentScheduleData(prev => ({ ...prev, completed: !prev.completed })); };


    const handleSaveEvent = () => {
        if (!currentScheduleData || !currentScheduleData.title?.trim()) return alert('Название не может быть пустым!');
        const currentAppCategories = Array.isArray(categoriesRef.current) ? categoriesRef.current : [];
        if (!currentScheduleData.categoryId && currentAppCategories.length > 0) {
            // Если категория не выбрана, но есть категории, можно попросить выбрать или назначить первую
            currentScheduleData.categoryId = currentAppCategories[0].id; // Или показать ошибку
        } else if (!currentScheduleData.categoryId && currentAppCategories.length === 0) {
            // Нет категорий, событие будет "без категории" (id: 'default' в TUI)
            currentScheduleData.categoryId = null; // или undefined
        }

        // ... (валидация дат как была) ...
        try { if (!currentScheduleData.start || isNaN(new Date(currentScheduleData.start).getTime())) throw new Error("Неверная дата начала"); if (!currentScheduleData.isAllDay && (!currentScheduleData.end || isNaN(new Date(currentScheduleData.end).getTime()))) throw new Error("Неверная дата конца"); if (!currentScheduleData.isAllDay && new Date(currentScheduleData.end) < new Date(currentScheduleData.start)) throw new Error("Конец раньше начала"); } catch (e) { return alert(e.message); }

        const scheduleForState = formatModalDataForState(currentScheduleData);
        if (isEditing) {
            onSchedulesChange(prev => prev.map(s => s.id === scheduleForState.id ? scheduleForState : s));
        } else {
            onSchedulesChange(prev => [...prev, scheduleForState]);
        }
        setModalOpen(false); setCurrentScheduleData(null); setIsEditing(false);
    };

    const handleDeleteEvent = () => {
        if (!currentScheduleData || !currentScheduleData.id) return;
        onSchedulesChange(prev => prev.filter(s => s.id !== currentScheduleData.id));
        setModalOpen(false); setCurrentScheduleData(null); setIsEditing(false);
    };


    return (
        // Убираем .calendar-wrapper и .calendar-container, если .app-content уже flex-контейнер
        // Компонент теперь занимает всю область, предоставленную ему <main class="app-content">
        <>
            {/* Тулбар календаря */}
            <div className="calendar-toolbar-main">
                {/* Здесь может быть название текущего месяца/недели, извлекаемое из TUI */}
                <div className="calendar-toolbar-nav">
                    <button onClick={() => navigate('today')} className="button secondary">Сегодня</button>
                    <button onClick={() => navigate('prev')} className="button secondary">prev</button>
                    <button onClick={() => navigate('next')} className="button secondary">></button>
                </div>
                <div className="calendar-current-range"> {/* Сюда можно вставить текущий диапазон дат */} </div>
                <div className="calendar-toolbar-viewmodes">
                    <button onClick={() => changeView('month')} className="button secondary">Месяц</button>
                    <button onClick={() => changeView('week')} className="button secondary">Неделя</button>
                    <button onClick={() => changeView('day')} className="button secondary">День</button>
                </div>
                {/* Поиск можно будет добавить сюда */}
            </div>

            {/* Контейнер TUI */}
            <div ref={calendarContainerRef} className="tui-calendar-container-customtheme"></div>

            {/* Модальное окно */}
            {modalOpen && currentScheduleData && (
                <div className="modal-backdrop">
                    <div className="modal-content">
                        <h3>{isEditing ? 'Редактировать Задачу' : 'Новая Задача'}</h3>
                        {isEditing && (
                            <label className="modal-checkbox-label main-task-completed">
                                <input
                                    type="checkbox"
                                    name="completed"
                                    checked={!!currentScheduleData.completed}
                                    onChange={handleToggleTaskCompleted}
                                />
                                {currentScheduleData.completed ? 'Задача выполнена' : 'Отметить как выполненную'}
                            </label>
                        )}
                        <label>Название:
                            <input type="text" name="title" value={currentScheduleData.title} onChange={handleModalChange} required />
                        </label>
                        <label>Категория:
                            <select name="categoryId" value={currentScheduleData.categoryId || ''} onChange={handleModalChange}>
                                <option value="">Без категории</option> {/* Для событий без категории */}
                                {(Array.isArray(categoriesRef.current) ? categoriesRef.current : []).map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </label>
                        <div className="modal-datetime-row">
                            <label className="modal-datetime-item">Начало:
                                <input type={currentScheduleData.isAllDay?"date":"datetime-local"} name="start" value={currentScheduleData.start} onChange={handleModalChange}/>
                            </label>
                            {!currentScheduleData.isAllDay && (
                                <label className="modal-datetime-item">Конец:
                                    <input type="datetime-local" name="end" value={currentScheduleData.end} onChange={handleModalChange} min={currentScheduleData.start} />
                                </label>
                            )}
                            <label className="modal-checkbox-label">
                                <input type="checkbox" name="isAllDay" checked={!!currentScheduleData.isAllDay} onChange={handleModalChange} />
                                Весь день
                            </label>
                        </div>
                        <label>Приоритет:
                            <select name="priority" value={currentScheduleData.priority} onChange={handlePriorityChange}>
                                <option value="Low">Низкий</option>
                                <option value="Medium">Средний</option>
                                <option value="High">Высокий</option>
                            </select>
                        </label>
                        <label>Место:
                            <input type="text" name="location" value={currentScheduleData.location} onChange={handleModalChange} />
                        </label>
                        <label>Описание:
                            <textarea name="description" value={currentScheduleData.description} onChange={handleModalChange} rows={3}></textarea>
                        </label>

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
                            <button type="button" onClick={handleSaveEvent} className="button primary">
                                {isEditing ? 'Сохранить' : 'Создать'}
                            </button>
                            {isEditing && (
                                <button type="button" onClick={handleDeleteEvent} className="button danger">
                                    Удалить
                                </button>
                            )}
                            <button type="button" onClick={() => { setModalOpen(false); }} className="button secondary">
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default CalendarComponent;