// UserProfile.js
import React, { useState, useEffect, useMemo } from 'react';
import './UserProfile.css';

// INITIAL_AI_CONFIG здесь больше не нужен, так как App.js предоставляет полный и актуальный конфиг

const UserProfile = ({ schedules, categories, currentAiConfig, onAiConfigChange, userCredentials }) => {
    const [isEditingConfig, setIsEditingConfig] = useState(false);
    // tempAiConfig используется для временного хранения изменений во время редактирования формы
    const [tempAiConfig, setTempAiConfig] = useState(currentAiConfig);

    // Синхронизация tempAiConfig, если currentAiConfig (из App.js) изменился,
    // или при инициализации компонента.
    useEffect(() => {
        if (!isEditingConfig) { // Обновляем temp только если не в режиме редактирования
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
                    const currentDays = prev.preferredWorkDays || [];
                    const newDays = checked
                        ? [...new Set([...currentDays, day])].sort()
                        : currentDays.filter(d => d !== day);
                    newState.preferredWorkDays = newDays;
                } else if (type === 'number') {
                    newState[name] = parseInt(value, 10) || (name === "concentrationLevel" ? 1 : 0);
                } else if (type === 'checkbox' && name !== 'preferredWorkDays') {
                    newState[name] = checked;
                } else {
                    newState[name] = value;
                }
            } else if (keys.length === 2) {
                const [group, key] = keys;
                newState[group] = {
                    ...(prev[group] || {}),
                    [key]: parseInt(value, 10) || 0 // Используем parseInt для числовых полей в объектах
                };
            }
            return newState;
        });
    };

    const handleEditConfig = () => {
        setTempAiConfig({ ...currentAiConfig }); // Загружаем актуальный конфиг в temp для редактирования
        setIsEditingConfig(true);
    };

    const handleCancelEdit = () => {
        setTempAiConfig({ ...currentAiConfig }); // Сбрасываем изменения в temp к актуальным
        setIsEditingConfig(false);
    };

    const handleSaveChanges = () => {
        onAiConfigChange(tempAiConfig); // Передаем изменения в App.js
        setIsEditingConfig(false);
        alert("Настройки AI-ассистента отправлены на сохранение."); // App.js обработает фактическое сохранение
    };

    // --- Фильтрация задач на сегодня (как было) ---
    const todaysSchedules = useMemo(() => {
        // ... (код без изменений)
        if (!Array.isArray(schedules)) {
            console.warn("UserProfile: schedules prop is not an array in useMemo");
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
                    if (isNaN(taskEndDate.getTime())) return false;
                    const todayStart = new Date(today); todayStart.setHours(0, 0, 0, 0);
                    const todayEnd = new Date(today); todayEnd.setHours(23, 59, 59, 999);
                    return taskStartDate <= todayEnd && taskEndDate >= todayStart;
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


    // Для отображения используется currentAiConfig (из App.js)
    // Для формы редактирования используется tempAiConfig
    const configToUseInForm = isEditingConfig ? tempAiConfig : currentAiConfig;

    return (
        <div className="user-profile-page">
            <h2>Профиль пользователя</h2>

            <div className="profile-section">
                <h3>Основная информация</h3>
                <p>Имя: {userCredentials?.name || 'Пользователь не указан'}</p>
                <p>Email: {userCredentials?.email || 'Email не указан'}</p>
            </div>

            <div className="profile-section">
                <h3>Задачи на сегодня ({todaysSchedules.length})</h3>
                {/* ... (код списка задач без изменений) ... */}
                {todaysSchedules.length > 0 ? (
                    <ul className="todays-tasks-list">
                        {todaysSchedules.map(task => {
                            const category = Array.isArray(categories) ? categories.find(c => c.id === task.categoryId) : null;
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
                                    {category && <span className="task-category" style={{ backgroundColor: category.color }}>{category.name}</span>}
                                    {!category && <span className="task-category" style={{ backgroundColor: '#ccc', color: '#000' }}>Без кат.</span>}
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
                <h3>
                    Анкета и настройки AI-ассистента
                    {!isEditingConfig && (
                        <button onClick={handleEditConfig} className="edit-button">
                            Редактировать
                        </button>
                    )}
                </h3>
                {isEditingConfig ? (
                    <form className="ai-config-form" onSubmit={(e) => { e.preventDefault(); handleSaveChanges(); }}>
                        {/* Поля формы используют tempAiConfig и handleAiConfigChange */}
                        <label>Кем вы работаете (ученик/студент/профессия):
                            <input type="text" name="occupation" value={tempAiConfig.occupation || ''} onChange={handleAiConfigChange} />
                        </label>
                        <label>График вашей работы (описательно, если отличается от настроек ниже):
                            <input type="text" name="workScheduleText" value={tempAiConfig.workScheduleText || ''} onChange={handleAiConfigChange} />
                        </label>
                        <label>Начало стандартного рабочего дня:
                            <input type="time" name="workStartTime" value={tempAiConfig.workStartTime || ''} onChange={handleAiConfigChange} />
                        </label>
                        <label>Конец стандартного рабочего дня:
                            <input type="time" name="workEndTime" value={tempAiConfig.workEndTime || ''} onChange={handleAiConfigChange} />
                        </label>
                        <fieldset>
                            <legend>Предпочитаемые рабочие дни (для стандартного графика):</legend>
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                                const dayTranslations = {Mon: "Пн", Tue: "Вт", Wed: "Ср", Thu: "Чт", Fri: "Пт", Sat: "Сб", Sun: "Вс"};
                                return (
                                    <label key={day} className="checkbox-label-inline">
                                        <input type="checkbox" name="preferredWorkDays" value={day} checked={tempAiConfig.preferredWorkDays?.includes(day) || false} onChange={handleAiConfigChange} /> {dayTranslations[day]}
                                    </label>
                                );
                            })}
                        </fieldset>
                        <label>Как далеко находится место вашей работы/учебы:
                            <input type="text" name="commuteDistance" value={tempAiConfig.commuteDistance || ''} onChange={handleAiConfigChange} />
                        </label>
                        <label>На каком транспорте вы обычно передвигаетесь:
                            <input type="text" name="transportMode" value={tempAiConfig.transportMode || ''} onChange={handleAiConfigChange} />
                        </label>
                        <label>Наилучшее время вашей продуктивности (описательно):
                            <input type="text" name="peakProductivityTime" value={tempAiConfig.peakProductivityTime || ''} onChange={handleAiConfigChange} />
                        </label>
                        <fieldset>
                            <legend>Уровень энергии (1-низкий, 5-высокий) по времени суток:</legend>
                            <label>Утро (6-12): <input type="number" name="energyLevelByDayTime.morning" value={tempAiConfig.energyLevelByDayTime?.morning || '3'} onChange={handleAiConfigChange} min="1" max="5"/></label>
                            <label>День (12-17): <input type="number" name="energyLevelByDayTime.afternoon" value={tempAiConfig.energyLevelByDayTime?.afternoon || '3'} onChange={handleAiConfigChange} min="1" max="5"/></label>
                            <label>Вечер (17-22): <input type="number" name="energyLevelByDayTime.evening" value={tempAiConfig.energyLevelByDayTime?.evening || '2'} onChange={handleAiConfigChange} min="1" max="5"/></label>
                            <label>Ночь (22-6): <input type="number" name="energyLevelByDayTime.night" value={tempAiConfig.energyLevelByDayTime?.night || '1'} onChange={handleAiConfigChange} min="1" max="5"/></label>
                        </fieldset>
                        <label>Предпочитаемый стиль работы:
                            <select name="workStylePreference" value={tempAiConfig.workStylePreference || 'с перерывами'} onChange={handleAiConfigChange}>
                                <option value="подряд">Делать дела подряд</option>
                                <option value="с перерывами">Брать перерывы между делами</option>
                            </select>
                        </label>
                        {tempAiConfig.workStylePreference === 'с перерывами' && (
                            <>
                                <label>Длительность рабочего блока (мин), если предпочитаете перерывы:
                                    <input type="number" name="taskChunkingMinutes" value={tempAiConfig.taskChunkingMinutes || '90'} onChange={handleAiConfigChange} min="15" step="15" />
                                </label>
                                <label>Длительность перерыва (мин), если предпочитаете перерывы:
                                    <input type="number" name="breakMinutes" value={tempAiConfig.breakMinutes || '15'} onChange={handleAiConfigChange} min="5" step="5" />
                                </label>
                            </>
                        )}
                        <label>Скорость чтения:
                            <input type="text" name="readingSpeed" value={tempAiConfig.readingSpeed || ''} onChange={handleAiConfigChange} placeholder="напр. 'средняя', '250 слов/мин'"/>
                        </label>
                        <label>Скорость набора текста:
                            <input type="text" name="typingSpeed" value={tempAiConfig.typingSpeed || ''} onChange={handleAiConfigChange} placeholder="напр. 'быстрая', '300 зн/мин'"/>
                        </label>
                        <label>Уровень вашей усидчивости (от 1 до 10):
                            <input type="number" name="concentrationLevel" value={tempAiConfig.concentrationLevel || '7'} onChange={handleAiConfigChange} min="1" max="10" />
                        </label>
                        <label>Ваш тип личности (если знаете, необязательно):
                            <input type="text" name="personalityType" value={tempAiConfig.personalityType || ''} onChange={handleAiConfigChange} placeholder="напр. 'интроверт', 'ENTJ'"/>
                        </label>
                        <label>Ваше образование:
                            <select name="educationBackground" value={tempAiConfig.educationBackground || ''} onChange={handleAiConfigChange}>
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
                            <textarea name="personalPreferencesNotes" value={tempAiConfig.personalPreferencesNotes || ''} onChange={handleAiConfigChange} rows="4" placeholder="Например: 'обязательно оставлять время для встречи с друзьями по пятницам вечером', 'не планировать важные дела на раннее утро'"></textarea>
                        </label>
                        <div className="form-actions">
                            <button type="submit">Сохранить анкету</button>
                            <button type="button" onClick={handleCancelEdit}>Отмена</button>
                        </div>
                    </form>
                ) : (
                    /* Отображение текущих настроек из currentAiConfig */
                    <div className="ai-config-display">
                        <p><strong>Профессия/статус:</strong> {currentAiConfig.occupation || 'Не указано'}</p>
                        <p><strong>График работы (описательно):</strong> {currentAiConfig.workScheduleText || 'Не указано'}</p>
                        <p><strong>Стандартное время работы:</strong> {currentAiConfig.workStartTime || 'N/A'} - {currentAiConfig.workEndTime || 'N/A'} ({currentAiConfig.preferredWorkDays?.join(', ') || 'дни не указаны'})</p>
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