import React, { useState, useEffect, useMemo } from 'react';
import './UserProfile.css'; // Стили для профиля

// --- Константы ---
const PROFILE_CONFIG_FILENAME = 'profileConfig.json';

// --- API Файловой системы ---
const fileSystemApi = window.electronFs;
if (!fileSystemApi) {
    console.error("UserProfile: Electron FS API not available.");
}

// --- Начальная структура анкеты ИИ ---
const INITIAL_AI_CONFIG = {
    workStartTime: '09:00',
    workEndTime: '18:00',
    preferredWorkDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    taskChunkingMinutes: 90,
    breakMinutes: 15,
    energyLevelByDayTime: { morning: 4, afternoon: 3, evening: 2, night: 1, },
    priorityWeights: { High: 3, Medium: 2, Low: 1, deadlineProximityDays: 3, },
};

const UserProfile = ({ schedules, categories }) => {
    // --- Состояние для данных профиля ---
    const [basicInfo, setBasicInfo] = useState({ name: 'Пользователь', email: 'user@example.com' }); // Заглушка
    const [aiConfig, setAiConfig] = useState(INITIAL_AI_CONFIG);
    const [isLoadingConfig, setIsLoadingConfig] = useState(true);
    const [isEditingConfig, setIsEditingConfig] = useState(false);

    // --- Загрузка конфига ИИ ---
    useEffect(() => {
        const loadConfig = async () => {
            if (!fileSystemApi) { setIsLoadingConfig(false); return; }
            setIsLoadingConfig(true);
            console.log('UserProfile: Loading AI config...');
            try {
                await fileSystemApi.ensureDataDir();
                const loadedConfig = await fileSystemApi.readFile(PROFILE_CONFIG_FILENAME);
                if (loadedConfig) {
                    setAiConfig(prev => ({ ...INITIAL_AI_CONFIG, ...loadedConfig })); // Мержим с дефолтным
                    console.log('UserProfile: AI config loaded.');
                } else {
                    setAiConfig(INITIAL_AI_CONFIG);
                    console.log('UserProfile: No saved AI config, using initial.');
                }
            } catch (error) {
                console.error('UserProfile: Failed to load AI config:', error);
                setAiConfig(INITIAL_AI_CONFIG);
            } finally {
                setIsLoadingConfig(false);
            }
        };
        loadConfig();
    }, []); // Загрузка один раз при монтировании

    // --- Сохранение конфига ИИ ---
    const saveAiConfig = async (configToSave) => {
        if (!fileSystemApi) {
            console.error("UserProfile: Cannot save AI config, FS API not available.");
            // Можно показать уведомление пользователю
            return;
        }
        console.log('UserProfile: Saving AI config...');
        try {
            await fileSystemApi.writeFile(PROFILE_CONFIG_FILENAME, configToSave);
            console.log('UserProfile: AI config saved.');
        } catch (error) {
            console.error('UserProfile: Failed to save AI config:', error);
            // Можно показать ошибку пользователю
        }
    };

    // --- Обработчики изменений анкеты ---
    const handleAiConfigChange = (event) => {
        const { name, value, type, checked } = event.target;

        setAiConfig(prev => {
            const keys = name.split('.');
            let newState = { ...prev }; // Клонируем предыдущее состояние

            if (keys.length === 1) { // Простое поле
                if (name === 'preferredWorkDays') { // Особая обработка для дней недели
                    const day = value;
                    const currentDays = prev.preferredWorkDays || [];
                    const newDays = checked
                        ? [...currentDays, day].sort() // Добавляем
                        : currentDays.filter(d => d !== day); // Удаляем
                    newState.preferredWorkDays = newDays;
                } else if (type === 'number') {
                    newState[name] = parseInt(value, 10) || 0;
                } else {
                    newState[name] = value;
                }
            } else if (keys.length === 2) { // Вложенное поле (energyLevelByDayTime, priorityWeights)
                const [group, key] = keys;
                // Клонируем вложенный объект перед изменением
                newState[group] = {
                    ...(prev[group] || {}),
                    [key]: parseInt(value, 10) || 0 // Предполагаем числа
                };
            }
            return newState; // Возвращаем новый объект состояния
        });
    };

    const handleSaveChanges = () => {
        saveAiConfig(aiConfig); // Вызываем сохранение актуального состояния
        setIsEditingConfig(false); // Выходим из режима редактирования
    };

    // --- Фильтрация задач на сегодня (ИСПРАВЛЕНО: использует пропсы) ---
    const todaysSchedules = useMemo(() => {
        // Используем 'schedules' из пропсов
        if (!Array.isArray(schedules)) {
            console.warn("UserProfile: schedules prop is not an array in useMemo");
            return [];
        }
        const today = new Date();
        const todayDateString = today.toISOString().split('T')[0];

        console.log("UserProfile: Recalculating today's schedules. Total schedules:", schedules.length);

        return schedules
            .filter(task => {
                if (!task.start) return false;
                try {
                    const taskStartDate = new Date(task.start);
                    if (isNaN(taskStartDate.getTime())) return false; // Пропускаем невалидные даты

                    // Для allday задач сравниваем только дату
                    if (task.isAllDay) {
                        return taskStartDate.toISOString().split('T')[0] === todayDateString;
                    }
                    // Для задач со временем - проверяем пересечение с сегодняшним днем
                    const taskEndDate = task.end ? new Date(task.end) : taskStartDate;
                    if (isNaN(taskEndDate.getTime())) return false; // Пропускаем невалидные даты конца

                    const todayStart = new Date(today); todayStart.setHours(0, 0, 0, 0);
                    const todayEnd = new Date(today); todayEnd.setHours(23, 59, 59, 999);

                    // Пересечение интервалов: (StartA <= EndB) and (EndA >= StartB)
                    return taskStartDate <= todayEnd && taskEndDate >= todayStart;
                } catch (e) {
                    console.error("Error filtering today's schedule:", task, e);
                    return false;
                }
            })
            .sort((a, b) => { // Сортируем по времени начала
                try {
                    const dateA = new Date(a.start).getTime();
                    const dateB = new Date(b.start).getTime();
                    if (isNaN(dateA) && isNaN(dateB)) return 0;
                    if (isNaN(dateA)) return 1; // Невалидные даты в конец
                    if (isNaN(dateB)) return -1;
                    return dateA - dateB;
                } catch { return 0;}
            });
        // ---> ЗАВИСИМОСТЬ ОТ ПРОПСА 'schedules' <---
    }, [schedules]);

    // --- Рендер ---
    if (isLoadingConfig) {
        return <div className="loading-indicator">Загрузка профиля...</div>;
    }

    return (
        <div className="user-profile-page">
            <h2>Профиль пользователя</h2>

            {/* Основная информация (заглушка) */}
            <div className="profile-section">
                <h3>Основная информация</h3>
                <p>Имя: {basicInfo.name}</p>
                <p>Email: {basicInfo.email}</p>
            </div>

            {/* Задачи на сегодня */}
            <div className="profile-section">
                <h3>Задачи на сегодня ({todaysSchedules.length})</h3>
                {todaysSchedules.length > 0 ? (
                    <ul className="todays-tasks-list">
                        {todaysSchedules.map(task => {
                            const category = Array.isArray(categories) ? categories.find(c => c.id === task.categoryId) : null; // Проверка categories
                            let timeString = '';
                            try {
                                if (task.isAllDay) { timeString = 'Весь день'; }
                                else {
                                    const startTime = new Date(task.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    const endTime = task.end ? new Date(task.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                                    timeString = endTime ? `${startTime} - ${endTime}` : startTime;
                                }
                            } catch {}

                            return (
                                <li key={task.id} className={`priority-${task.priority?.toLowerCase()} ${task.completed ? 'completed' : ''}`}>
                                    <span className="task-time">{timeString}</span>
                                    <span className="task-category" style={{ backgroundColor: category?.color || '#ccc' }}>
                                        {category?.name || 'Без кат.'}
                                    </span>
                                    <span className="task-title">{task.title}</span>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p>На сегодня задач нет.</p>
                )}
            </div>

            {/* Анкета для ИИ */}
            <div className="profile-section">
                <h3>
                    Настройки AI-ассистента
                    {!isEditingConfig && (
                        <button onClick={() => setIsEditingConfig(true)} className="edit-button">
                            Редактировать
                        </button>
                    )}
                </h3>
                {isEditingConfig ? (
                    /* Форма редактирования */
                    <div className="ai-config-form">
                        <label>Начало рабочего дня:
                            <input
                                type="time"
                                name="workStartTime"
                                value={aiConfig.workStartTime || ''}
                                onChange={handleAiConfigChange}
                            />
                        </label>
                        <label>Конец рабочего дня:
                            <input
                                type="time"
                                name="workEndTime"
                                value={aiConfig.workEndTime || ''}
                                onChange={handleAiConfigChange}
                            />
                        </label>

                        <fieldset>
                            <legend>Предпочитаемые рабочие дни:</legend>
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                <label key={day} className="checkbox-label-inline">
                                    <input
                                        type="checkbox"
                                        name="preferredWorkDays"
                                        value={day}
                                        checked={aiConfig.preferredWorkDays?.includes(day) || false}
                                        onChange={handleAiConfigChange}
                                    /> {day}
                                </label>
                            ))}
                        </fieldset>

                        <label>Длительность рабочего блока (мин):
                            <input
                                type="number"
                                name="taskChunkingMinutes"
                                value={aiConfig.taskChunkingMinutes || ''}
                                onChange={handleAiConfigChange}
                                min="15"
                                step="15"
                            />
                        </label>
                        <label>Длительность перерыва (мин):
                            <input
                                type="number"
                                name="breakMinutes"
                                value={aiConfig.breakMinutes || ''}
                                onChange={handleAiConfigChange}
                                min="5"
                                step="5"
                            />
                        </label>

                        <fieldset>
                            <legend>Уровень энергии (1-5):</legend>
                            <label>Утро (6-12):
                                <input type="number" name="energyLevelByDayTime.morning" value={aiConfig.energyLevelByDayTime?.morning || ''} onChange={handleAiConfigChange} min="1" max="5"/>
                            </label>
                            <label>День (12-17):
                                <input type="number" name="energyLevelByDayTime.afternoon" value={aiConfig.energyLevelByDayTime?.afternoon || ''} onChange={handleAiConfigChange} min="1" max="5"/>
                            </label>
                            <label>Вечер (17-22):
                                <input type="number" name="energyLevelByDayTime.evening" value={aiConfig.energyLevelByDayTime?.evening || ''} onChange={handleAiConfigChange} min="1" max="5"/>
                            </label>
                            <label>Ночь (22-6):
                                <input type="number" name="energyLevelByDayTime.night" value={aiConfig.energyLevelByDayTime?.night || ''} onChange={handleAiConfigChange} min="1" max="5"/>
                            </label>
                        </fieldset>

                        {/* TODO: Добавить поля для priorityWeights и deadlineProximityDays */}

                        <div className="form-actions">
                            <button onClick={handleSaveChanges}>Сохранить</button>
                            <button type="button" onClick={() => { setIsEditingConfig(false); /* TODO: Перезагрузить конфиг для отмены */ }}>Отмена</button>
                        </div>

                    </div>
                ) : (
                    /* Отображение текущих настроек */
                    <div className="ai-config-display">
                        <p>Время работы: {aiConfig.workStartTime || 'Не уст.'} - {aiConfig.workEndTime || 'Не уст.'}</p>
                        <p>Рабочие дни: {aiConfig.preferredWorkDays?.join(', ') || 'Не указаны'}</p>
                        <p>Блок работы / перерыв: {aiConfig.taskChunkingMinutes || '?'} мин / {aiConfig.breakMinutes || '?'} мин</p>
                        <p>
                            Энергия (У/Д/В/Н):
                            {aiConfig.energyLevelByDayTime?.morning ?? '?'}/
                            {aiConfig.energyLevelByDayTime?.afternoon ?? '?'}/
                            {aiConfig.energyLevelByDayTime?.evening ?? '?'}/
                            {aiConfig.energyLevelByDayTime?.night ?? '?'}
                        </p>
                        {/* Отобразить другие параметры */}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserProfile;