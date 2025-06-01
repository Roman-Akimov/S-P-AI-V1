// src/components/OnboardingQuestionnairePage.js
import React, { useState, useEffect } from 'react';
import './OnboardingQuestionnairePage.css'; // Импортируем новые стили

const OnboardingQuestionnairePage = ({ initialConfig, onComplete, userName }) => {
    const [config, setConfig] = useState(initialConfig);

    useEffect(() => {
        // При монтировании или изменении initialConfig, обновляем локальное состояние
        // но только если initialConfig действительно объект, чтобы избежать ошибок с null/undefined
        if (initialConfig && typeof initialConfig === 'object') {
            setConfig(prevConfig => ({ ...prevConfig, ...initialConfig }));
        }
    }, [initialConfig]);

    const handleChange = (event) => {
        const { name, value, type, checked } = event.target;
        setConfig(prev => {
            const keys = name.split('.');
            let newState = { ...prev }; // Копируем предыдущее состояние

            // Обеспечиваем, что newState не undefined перед присвоением
            if (!newState) newState = {};
            if (keys.length === 1) {
                if (name === 'preferredWorkDays') {
                    const day = value;
                    // Убеждаемся, что prev.preferredWorkDays существует и является массивом
                    const currentDays = Array.isArray(prev.preferredWorkDays) ? prev.preferredWorkDays : [];
                    const newDays = checked
                        ? [...new Set([...currentDays, day])].sort()
                        : currentDays.filter(d => d !== day);
                    newState.preferredWorkDays = newDays;
                } else if (type === 'number') {
                    // Для числовых полей позволяем пустое значение, чтобы пользователь мог стереть
                    newState[name] = value === '' ? '' : (parseInt(value, 10) || (name === "concentrationLevel" ? 1 : 0));
                } else if (type === 'checkbox' && name !== 'preferredWorkDays') {
                    newState[name] = checked;
                } else {
                    newState[name] = value;
                }
            } else if (keys.length === 2) { // Для вложенных объектов типа energyLevelByDayTime
                const [group, key] = keys;
                // Обеспечиваем, что prev[group] существует перед тем, как его расширять
                const prevGroup = prev[group] && typeof prev[group] === 'object' ? prev[group] : {};
                newState[group] = {
                    ...prevGroup,
                    [key]: value === '' ? '' : (parseInt(value, 10) || 0) // Позволяем пустое значение
                };
            }
            return newState;
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Перед отправкой можно пройтись по config и преобразовать пустые строки чисел в 0 или дефолтные значения, если нужно
        const finalConfig = { ...config };
        for (const key in finalConfig) {
            if (typeof finalConfig[key] === 'object' && finalConfig[key] !== null) {
                for (const subKey in finalConfig[key]) {
                    if (finalConfig[key][subKey] === '') {
                        if (key === 'energyLevelByDayTime') finalConfig[key][subKey] = 1; // Дефолт для энергии
                        // другие дефолты для числовых полей во вложенных объектах
                    }
                }
            } else if (finalConfig[key] === '' && (key === 'taskChunkingMinutes' || key === 'breakMinutes' || key === 'concentrationLevel')) {
                if (key === 'taskChunkingMinutes') finalConfig[key] = 90;
                if (key === 'breakMinutes') finalConfig[key] = 15;
                if (key === 'concentrationLevel') finalConfig[key] = 7;
                // другие дефолты для числовых полей верхнего уровня
            }
        }
        onComplete(finalConfig);
    };

    return (
        <div className="onboarding-page-container">
            <div className="onboarding-form-container">
                <h2>Настройка AI-ассистента, {userName}!</h2>
                <p className="welcome-text"> {/* Добавлен класс для стилизации */}
                    Пожалуйста, ответьте на несколько вопросов, чтобы AI-ассистент мог лучше вам помогать. Вы всегда сможете изменить эти настройки позже в Профиле.
                </p>

                <form onSubmit={handleSubmit} className="ai-config-form">
                    <label>Кем вы работаете (ученик/студент/профессия):
                        <input type="text" name="occupation" value={config.occupation || ''} onChange={handleChange} />
                    </label>
                    <label>График вашей работы (описательно, если отличается от настроек ниже):
                        <input type="text" name="workScheduleText" value={config.workScheduleText || ''} onChange={handleChange} />
                    </label>

                    <div className="form-row"> {/* Группировка для стилей */}
                        <label>Начало стандартного рабочего дня:
                            <input type="time" name="workStartTime" value={config.workStartTime || '09:00'} onChange={handleChange} />
                        </label>
                        <label>Конец стандартного рабочего дня:
                            <input type="time" name="workEndTime" value={config.workEndTime || '18:00'} onChange={handleChange} />
                        </label>
                    </div>

                    <fieldset>
                        <legend>Предпочитаемые рабочие дни (для стандартного графика):</legend>
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                            const dayTranslations = {Mon: "Пн", Tue: "Вт", Wed: "Ср", Thu: "Чт", Fri: "Пт", Sat: "Сб", Sun: "Вс"};
                            return (
                                <label key={day} className="checkbox-label-inline">
                                    <input type="checkbox" name="preferredWorkDays" value={day}
                                           checked={Array.isArray(config.preferredWorkDays) && config.preferredWorkDays.includes(day)}
                                           onChange={handleChange} /> {dayTranslations[day]}
                                </label>
                            );
                        })}
                    </fieldset>
                    <label>Как далеко находится место вашей работы/учебы:
                        <input type="text" name="commuteDistance" value={config.commuteDistance || ''} onChange={handleChange} />
                    </label>
                    <label>На каком транспорте вы обычно передвигаетесь:
                        <input type="text" name="transportMode" value={config.transportMode || ''} onChange={handleChange} />
                    </label>
                    <label>Наилучшее время вашей продуктивности (описательно):
                        <input type="text" name="peakProductivityTime" value={config.peakProductivityTime || ''} onChange={handleChange} />
                    </label>
                    <fieldset>
                        <legend>Уровень энергии (1-низкий, 5-высокий) по времени суток:</legend>
                        <div className="form-grid"> {/* Группировка для стилей */}
                            <label>Утро (6-12): <input type="number" name="energyLevelByDayTime.morning" value={config.energyLevelByDayTime?.morning ?? '3'} onChange={handleChange} min="1" max="5"/></label>
                            <label>День (12-17): <input type="number" name="energyLevelByDayTime.afternoon" value={config.energyLevelByDayTime?.afternoon ?? '3'} onChange={handleChange} min="1" max="5"/></label>
                            <label>Вечер (17-22): <input type="number" name="energyLevelByDayTime.evening" value={config.energyLevelByDayTime?.evening ?? '2'} onChange={handleChange} min="1" max="5"/></label>
                            <label>Ночь (22-6): <input type="number" name="energyLevelByDayTime.night" value={config.energyLevelByDayTime?.night ?? '1'} onChange={handleChange} min="1" max="5"/></label>
                        </div>
                    </fieldset>
                    <label>Предпочитаемый стиль работы:
                        <select name="workStylePreference" value={config.workStylePreference || 'с перерывами'} onChange={handleChange}>
                            <option value="подряд">Делать дела подряд</option>
                            <option value="с перерывами">Брать перерывы между делами</option>
                        </select>
                    </label>
                    {config.workStylePreference === 'с перерывами' && (
                        <div className="form-row"> {/* Группировка для стилей */}
                            <label>Длительность рабочего блока (мин):
                                <input type="number" name="taskChunkingMinutes" value={config.taskChunkingMinutes ?? '90'} onChange={handleChange} min="15" step="15" />
                            </label>
                            <label>Длительность перерыва (мин):
                                <input type="number" name="breakMinutes" value={config.breakMinutes ?? '15'} onChange={handleChange} min="5" step="5" />
                            </label>
                        </div>
                    )}
                    <div className="form-row"> {/* Группировка для стилей */}
                        <label>Скорость чтения:
                            <input type="text" name="readingSpeed" value={config.readingSpeed || ''} onChange={handleChange} placeholder="напр. 'средняя', '250 слов/мин'"/>
                        </label>
                        <label>Скорость набора текста:
                            <input type="text" name="typingSpeed" value={config.typingSpeed || ''} onChange={handleChange} placeholder="напр. 'быстрая', '300 зн/мин'"/>
                        </label>
                    </div>
                    <label>Уровень вашей усидчивости (от 1 до 10):
                        <input type="number" name="concentrationLevel" value={config.concentrationLevel ?? '7'} onChange={handleChange} min="1" max="10" />
                    </label>
                    <label>Ваш тип личности (если знаете, необязательно):
                        <input type="text" name="personalityType" value={config.personalityType || ''} onChange={handleChange} placeholder="напр. 'интроверт', 'ENTJ'"/>
                    </label>
                    <label>Ваше образование:
                        <select name="educationBackground" value={config.educationBackground || ''} onChange={handleChange}>
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
                        <textarea name="personalPreferencesNotes" value={config.personalPreferencesNotes || ''} onChange={handleChange} rows="4" placeholder="Например: 'обязательно оставлять время для встречи с друзьями по пятницам вечером', 'не планировать важные дела на раннее утро'"></textarea>
                    </label>

                    <div className="submit-button-container"> {/* Обертка для центрирования кнопки */}
                        <button type="submit" className="submit-button">Завершить настройку и начать</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default OnboardingQuestionnairePage;