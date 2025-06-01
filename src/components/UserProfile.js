// UserProfile.js
import React, { useState, useEffect, useMemo } from 'react';
import './UserProfile.css'; // Убедитесь, что файл стилей существует и импортирован

// Получаем dbApi из глобального window, если он там есть (для кнопки синхронизации)
const dbApi = window.dbApi;

const UserProfile = ({
                         schedules,
                         categories,
                         // onCategoriesChange, // Пока не используется для изменения категорий из профиля
                         currentAiConfig,
                         onAiConfigChange,
                         userCredentials,
                         onForceSync,      // Функция для принудительной синхронизации
                         isOnlineMode      // Статус доступности БД
                     }) => {
    const [isEditingConfig, setIsEditingConfig] = useState(false);
    const [tempAiConfig, setTempAiConfig] = useState(currentAiConfig);
    const [isSyncing, setIsSyncing] = useState(false); // Состояние для индикации процесса синхронизации

    useEffect(() => {
        if (!isEditingConfig) {
            setTempAiConfig(currentAiConfig);
        }
    }, [currentAiConfig, isEditingConfig]);

    const handleAiConfigChange = (event) => {
        const { name, value, type, checked } = event.target;
        setTempAiConfig(prev => {
            const keys = name.split('.');
            let newState = { ...prev };

            if (keys.length === 1) {
                if (name === 'preferredWorkDays') {
                    const day = value;
                    const currentDays = Array.isArray(prev.preferredWorkDays) ? prev.preferredWorkDays : [];
                    const newDays = checked
                        ? [...new Set([...currentDays, day])].sort() // Добавляем и сортируем
                        : currentDays.filter(d => d !== day);
                    newState.preferredWorkDays = newDays;
                } else if (type === 'number') {
                    newState[name] = value === '' ? '' : (parseInt(value, 10) || (name === "concentrationLevel" ? 1 : 0));
                } else if (type === 'checkbox' && name !== 'preferredWorkDays') { // Для других чекбоксов, если появятся
                    newState[name] = checked;
                } else {
                    newState[name] = value;
                }
            } else if (keys.length === 2) { // Для вложенных объектов типа energyLevelByDayTime
                const [group, key] = keys;
                newState[group] = {
                    ...(prev[group] || {}),
                    [key]: value === '' ? '' : (parseInt(value, 10) || 0)
                };
            }
            return newState;
        });
    };

    const handleEditConfig = () => {
        setTempAiConfig({ ...currentAiConfig });
        setIsEditingConfig(true);
    };

    const handleCancelEdit = () => {
        setTempAiConfig({ ...currentAiConfig });
        setIsEditingConfig(false);
    };

    const handleSaveChanges = () => {
        onAiConfigChange(tempAiConfig);
        setIsEditingConfig(false);
        alert("Настройки AI-ассистента обновлены локально. Для сохранения в облако используйте кнопку синхронизации.");
    };

    const handleSyncClick = async () => {
        if (onForceSync && typeof onForceSync === 'function') {
            setIsSyncing(true);
            try {
                await onForceSync(); // Функция onForceSync должна сама обработать alert и ошибки
            } catch (e) {
                console.error("Error during onForceSync call from UserProfile:", e);
                // Alert об ошибке должен быть в onForceSync
            }
            setIsSyncing(false);
        } else {
            console.warn("onForceSync function is not provided to UserProfile");
            alert("Функция синхронизации недоступна.");
        }
    };

    const todaysSchedules = useMemo(() => {
        if (!Array.isArray(schedules)) {
            return [];
        }
        const today = new Date();
        const todayDateString = today.toISOString().split('T')[0];

        return schedules
            .filter(task => {
                if (!task.start) return false;
                try {
                    const taskStartDate = new Date(task.start);
                    if (isNaN(taskStartDate.getTime())) return false;
                    if (task.isAllDay) {
                        return taskStartDate.toISOString().split('T')[0] === todayDateString;
                    }
                    const taskEndDate = task.end ? new Date(task.end) : taskStartDate;
                    if (isNaN(taskEndDate.getTime())) return false; // Если дата окончания невалидна, считаем ее равной началу

                    // Для событий НЕ на весь день, проверяем пересечение с текущим днем
                    const dayStart = new Date(todayDateString + "T00:00:00.000Z"); // Начало сегодняшнего дня в UTC
                    const dayEnd = new Date(todayDateString + "T23:59:59.999Z");   // Конец сегодняшнего дня в UTC

                    // Приводим даты задач к UTC для корректного сравнения, если они могут быть в разных таймзонах
                    // Однако, если даты хранятся как строки datetime-local, new Date() их парсит в локальной таймзоне.
                    // Для простоты будем считать, что все даты в одной (локальной) таймзоне.
                    return taskStartDate <= dayEnd && taskEndDate >= dayStart;

                } catch (e) {
                    console.error("Error filtering today's schedule:", task, e);
                    return false;
                }
            })
            .sort((a, b) => {
                try {
                    const dateA = new Date(a.start).getTime();
                    const dateB = new Date(b.start).getTime();
                    if (isNaN(dateA) && isNaN(dateB)) return 0;
                    if (isNaN(dateA)) return 1;
                    if (isNaN(dateB)) return -1;
                    return dateA - dateB;
                } catch { return 0;}
            });
    }, [schedules]);

    const configToDisplay = isEditingConfig ? tempAiConfig : currentAiConfig;

    return (
        <div className="user-profile-page">
            <div className="profile-header">
                <h2>Профиль пользователя</h2>
                {dbApi && ( // Показываем кнопку и статус только если dbApi доступен (т.е. мы в Electron)
                    <div className="sync-section">
                        <button
                            onClick={handleSyncClick}
                            disabled={isSyncing || !isOnlineMode}
                            className="button primary sync-button"
                            title={!isOnlineMode ? "Синхронизация недоступна (нет подключения к БД)" : "Синхронизировать все данные с облаком"}
                        >
                            {isSyncing ? 'Синхронизация...' : 'Синхронизировать с облаком'}
                        </button>
                    </div>
                )}
            </div>

            <div className="profile-section">
                <h3>Основная информация</h3>
                <p><strong>Имя:</strong> {userCredentials?.name || 'Не указано'}</p>
                <p><strong>Email:</strong> {userCredentials?.email || 'Не указан'}</p>
            </div>

            <div className="profile-section">
                <h3>Задачи на сегодня ({todaysSchedules.length})</h3>
                {todaysSchedules.length > 0 ? (
                    <ul className="todays-tasks-list">
                        {todaysSchedules.map(task => {
                            const category = Array.isArray(categories) ? categories.find(c => c.id === task.categoryId) : null;
                            let timeString = '';
                            try {
                                if (task.isAllDay) { timeString = 'Весь день'; }
                                else {
                                    const startTimeObj = new Date(task.start);
                                    const startTime = !isNaN(startTimeObj.getTime()) ? startTimeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '??:??';

                                    let endTime = '';
                                    if (task.end) {
                                        const endTimeObj = new Date(task.end);
                                        endTime = !isNaN(endTimeObj.getTime()) ? endTimeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                                    }
                                    timeString = endTime ? `${startTime} - ${endTime}` : startTime;
                                }
                            } catch { timeString = 'Ошибка времени'; }

                            return (
                                <li key={task.id} className={`task-item priority-${task.priority?.toLowerCase()} ${task.completed ? 'completed' : ''}`}>
                                    <span className="task-time">{timeString}</span>
                                    {category && <span className="task-category-tag" style={{ backgroundColor: category.color }}>{category.name}</span>}
                                    {!category && <span className="task-category-tag no-category-tag">Без кат.</span>}
                                    <span className="task-title">{task.title}</span>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p>На сегодня задач нет.</p>
                )}
            </div>

            <div className="profile-section">
                <div className="section-header">
                    <h3>Анкета и настройки AI-ассистента</h3>
                    {!isEditingConfig && (
                        <button onClick={handleEditConfig} className="button secondary edit-button">
                            Редактировать
                        </button>
                    )}
                </div>
                {isEditingConfig ? (
                    <form className="ai-config-form" onSubmit={(e) => { e.preventDefault(); handleSaveChanges(); }}>
                        <label>Кем вы работаете (ученик/студент/профессия):
                            <input type="text" name="occupation" value={tempAiConfig.occupation || ''} onChange={handleAiConfigChange} />
                        </label>
                        <label>График вашей работы (описательно, если отличается от настроек ниже):
                            <input type="text" name="workScheduleText" value={tempAiConfig.workScheduleText || ''} onChange={handleAiConfigChange} />
                        </label>
                        <div className="form-row">
                            <label>Начало стандартного рабочего дня:
                                <input type="time" name="workStartTime" value={tempAiConfig.workStartTime || '09:00'} onChange={handleAiConfigChange} />
                            </label>
                            <label>Конец стандартного рабочего дня:
                                <input type="time" name="workEndTime" value={tempAiConfig.workEndTime || '18:00'} onChange={handleAiConfigChange} />
                            </label>
                        </div>
                        <fieldset>
                            <legend>Предпочитаемые рабочие дни:</legend>
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                                const dayTranslations = {Mon: "Пн", Tue: "Вт", Wed: "Ср", Thu: "Чт", Fri: "Пт", Sat: "Сб", Sun: "Вс"};
                                return (
                                    <label key={day} className="checkbox-label-inline">
                                        <input type="checkbox" name="preferredWorkDays" value={day} checked={Array.isArray(tempAiConfig.preferredWorkDays) && tempAiConfig.preferredWorkDays.includes(day)} onChange={handleAiConfigChange} /> {dayTranslations[day]}
                                    </label>
                                );
                            })}
                        </fieldset>
                        {/* ... остальные поля формы ... */}
                        <label>Как далеко находится место вашей работы/учебы:
                            <input type="text" name="commuteDistance" value={configToDisplay.commuteDistance || ''} onChange={handleAiConfigChange} />
                        </label>
                        <label>На каком транспорте вы обычно передвигаетесь:
                            <input type="text" name="transportMode" value={configToDisplay.transportMode || ''} onChange={handleAiConfigChange} />
                        </label>
                        <label>Наилучшее время вашей продуктивности (описательно):
                            <input type="text" name="peakProductivityTime" value={configToDisplay.peakProductivityTime || ''} onChange={handleAiConfigChange} />
                        </label>
                        <fieldset>
                            <legend>Уровень энергии (1-низкий, 5-высокий) по времени суток:</legend>
                            <div className="form-grid">
                                <label>Утро (6-12): <input type="number" name="energyLevelByDayTime.morning" value={configToDisplay.energyLevelByDayTime?.morning || '3'} onChange={handleAiConfigChange} min="1" max="5"/></label>
                                <label>День (12-17): <input type="number" name="energyLevelByDayTime.afternoon" value={configToDisplay.energyLevelByDayTime?.afternoon || '3'} onChange={handleAiConfigChange} min="1" max="5"/></label>
                                <label>Вечер (17-22): <input type="number" name="energyLevelByDayTime.evening" value={configToDisplay.energyLevelByDayTime?.evening || '2'} onChange={handleAiConfigChange} min="1" max="5"/></label>
                                <label>Ночь (22-6): <input type="number" name="energyLevelByDayTime.night" value={configToDisplay.energyLevelByDayTime?.night || '1'} onChange={handleAiConfigChange} min="1" max="5"/></label>
                            </div>
                        </fieldset>
                        <label>Предпочитаемый стиль работы:
                            <select name="workStylePreference" value={configToDisplay.workStylePreference || 'с перерывами'} onChange={handleAiConfigChange}>
                                <option value="подряд">Делать дела подряд</option>
                                <option value="с перерывами">Брать перерывы между делами</option>
                            </select>
                        </label>
                        {configToDisplay.workStylePreference === 'с перерывами' && (
                            <div className="form-row">
                                <label>Длительность рабочего блока (мин):
                                    <input type="number" name="taskChunkingMinutes" value={configToDisplay.taskChunkingMinutes || '90'} onChange={handleAiConfigChange} min="15" step="15" />
                                </label>
                                <label>Длительность перерыва (мин):
                                    <input type="number" name="breakMinutes" value={configToDisplay.breakMinutes || '15'} onChange={handleAiConfigChange} min="5" step="5" />
                                </label>
                            </div>
                        )}
                        <div className="form-row">
                            <label>Скорость чтения:
                                <input type="text" name="readingSpeed" value={configToDisplay.readingSpeed || ''} onChange={handleAiConfigChange} placeholder="напр. 'средняя', '250 слов/мин'"/>
                            </label>
                            <label>Скорость набора текста:
                                <input type="text" name="typingSpeed" value={configToDisplay.typingSpeed || ''} onChange={handleAiConfigChange} placeholder="напр. 'быстрая', '300 зн/мин'"/>
                            </label>
                        </div>
                        <label>Уровень вашей усидчивости (от 1 до 10):
                            <input type="number" name="concentrationLevel" value={configToDisplay.concentrationLevel || '7'} onChange={handleAiConfigChange} min="1" max="10" />
                        </label>
                        <label>Ваш тип личности (если знаете, необязательно):
                            <input type="text" name="personalityType" value={configToDisplay.personalityType || ''} onChange={handleAiConfigChange} placeholder="напр. 'интроверт', 'ENTJ'"/>
                        </label>
                        <label>Ваше образование:
                            <select name="educationBackground" value={configToDisplay.educationBackground || ''} onChange={handleAiConfigChange}>
                                <option value="">Не указано</option>
                                <option value="Гуманитарное">Гуманитарное</option>
                                <option value="Техническое">Техническое</option>
                                <option value="Естественнонаучное">Естественнонаучное</option>
                                <option value="Экономическое">Экономическое</option>
                                <option value="Медицинское">Медицинское</option>
                                <option value="Творческое">Творческое</option>
                                <option value="Другое">Другое</option>
                            </select>
                        </label>
                        <label>Личные предпочтения для AI (что обязательно учесть):
                            <textarea name="personalPreferencesNotes" value={configToDisplay.personalPreferencesNotes || ''} onChange={handleAiConfigChange} rows="4" placeholder="Например: 'обязательно оставлять время для встречи с друзьями по пятницам вечером'"></textarea>
                        </label>

                        <div className="form-actions">
                            <button type="submit" className="button primary">Сохранить анкету</button>
                            <button type="button" onClick={handleCancelEdit} className="button secondary">Отмена</button>
                        </div>
                    </form>
                ) : (
                    <div className="ai-config-display">
                        <p><strong>Профессия/статус:</strong> {currentAiConfig.occupation || 'Не указано'}</p>
                        <p><strong>График работы (описательно):</strong> {currentAiConfig.workScheduleText || 'Не указано'}</p>
                        <p><strong>Стандартное время работы:</strong> {currentAiConfig.workStartTime || 'N/A'} - {currentAiConfig.workEndTime || 'N/A'} ({ (Array.isArray(currentAiConfig.preferredWorkDays) ? currentAiConfig.preferredWorkDays : []).join(', ') || 'дни не указаны'})</p>
                        <p><strong>Дорога до работы/учебы:</strong> {currentAiConfig.commuteDistance || 'Не указано'}</p>
                        <p><strong>Основной транспорт:</strong> {currentAiConfig.transportMode || 'Не указано'}</p>
                        <p><strong>Пик продуктивности (описательно):</strong> {currentAiConfig.peakProductivityTime || 'Не указано'}</p>
                        <p><strong>Уровни энергии (У/Д/В/Н):</strong> {currentAiConfig.energyLevelByDayTime?.morning ?? '?'}/{currentAiConfig.energyLevelByDayTime?.afternoon ?? '?'}/{currentAiConfig.energyLevelByDayTime?.evening ?? '?'}/{currentAiConfig.energyLevelByDayTime?.night ?? '?'}</p>
                        <p><strong>Стиль работы:</strong> {currentAiConfig.workStylePreference === 'подряд' ? 'Предпочитаю делать дела подряд' : 'Предпочитаю брать перерывы'}</p>
                        {currentAiConfig.workStylePreference === 'с перерывами' && (
                            <p><strong>Рабочий блок / перерыв:</strong> {currentAiConfig.taskChunkingMinutes || '?'} мин / {currentAiConfig.breakMinutes || '?'} мин</p>
                        )}
                        <p><strong>Скорость чтения:</strong> {currentAiConfig.readingSpeed || 'Не указана'}</p>
                        <p><strong>Скорость набора текста:</strong> {currentAiConfig.typingSpeed || 'Не указана'}</p>
                        <p><strong>Усидчивость (1-10):</strong> {currentAiConfig.concentrationLevel || 'Не указан'}</p>
                        <p><strong>Тип личности:</strong> {currentAiConfig.personalityType || 'Не указан'}</p>
                        <p><strong>Образование:</strong> {currentAiConfig.educationBackground || 'Не указано'}</p>
                        <p><strong>Особые пожелания для AI:</strong></p>
                        <pre className="personal-notes-display">{currentAiConfig.personalPreferencesNotes || 'Нет особых пожеланий.'}</pre>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UserProfile;