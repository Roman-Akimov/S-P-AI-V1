// src/components/OnboardingQuestionnairePage.js
import React, { useState, useEffect } from 'react';
// Используйте стили, аналогичные UserProfile.css или создайте свои
import './OnboardingQuestionnairePage.css';
const OnboardingQuestionnairePage = ({ initialConfig, onComplete, userName }) => {
    const [config, setConfig] = useState(initialConfig);

    useEffect(() => {
        setConfig(initialConfig);
    }, [initialConfig]);

    const handleChange = (event) => {
        const { name, value, type, checked } = event.target;
        setConfig(prev => {
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
                    // Убедимся, что парсим числа, где это ожидается (например, energyLevel)
                    [key]: (typeof prev[group]?.[key] === 'number' || ['morning','afternoon','evening','night'].includes(key))
                        ? (parseInt(value, 10) || 0)
                        : value
                };
            }
            return newState;
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onComplete(config);
    };

    return (
        <div className="onboarding-page-container">
            <div className="onboarding-form-container">
                <h2>Настройка AI-ассистента, {userName}!</h2>
                <p>Пожалуйста, ответьте на несколько вопросов, чтобы AI-ассистент мог лучше вам помогать. Вы всегда сможете изменить эти настройки позже в Профиле.</p>

                {/* Используем класс ai-config-form для возможного переиспользования стилей из UserProfile.css */}
                <form onSubmit={handleSubmit} className="ai-config-form">
                    {/* Копируем поля из UserProfile.js (режим редактирования) */}
                    {/* Важно, чтобы имена полей (name атрибут) совпадали с ключами в INITIAL_AI_CONFIG */}
                    {/* и использовали `config` для value и `handleChange` для onChange */}

                    <label>Кем вы работаете (ученик/студент/профессия):
                        <input type="text" name="occupation" value={config.occupation || ''} onChange={handleChange} />
                    </label>
                    <label>График вашей работы (описательно, если отличается от настроек ниже):
                        <input type="text" name="workScheduleText" value={config.workScheduleText || ''} onChange={handleChange} />
                    </label>
                    <label>Начало стандартного рабочего дня:
                        <input type="time" name="workStartTime" value={config.workStartTime || '09:00'} onChange={handleChange} />
                    </label>
                    <label>Конец стандартного рабочего дня:
                        <input type="time" name="workEndTime" value={config.workEndTime || '18:00'} onChange={handleChange} />
                    </label>
                    <fieldset>
                        <legend>Предпочитаемые рабочие дни (для стандартного графика):</legend>
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                            const dayTranslations = {Mon: "Пн", Tue: "Вт", Wed: "Ср", Thu: "Чт", Fri: "Пт", Sat: "Сб", Sun: "Вс"};
                            return (
                                <label key={day} className="checkbox-label-inline">
                                    <input type="checkbox" name="preferredWorkDays" value={day} checked={config.preferredWorkDays?.includes(day) || false} onChange={handleChange} /> {dayTranslations[day]}
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
                        <label>Утро (6-12): <input type="number" name="energyLevelByDayTime.morning" value={config.energyLevelByDayTime?.morning || '3'} onChange={handleChange} min="1" max="5"/></label>
                        <label>День (12-17): <input type="number" name="energyLevelByDayTime.afternoon" value={config.energyLevelByDayTime?.afternoon || '3'} onChange={handleChange} min="1" max="5"/></label>
                        <label>Вечер (17-22): <input type="number" name="energyLevelByDayTime.evening" value={config.energyLevelByDayTime?.evening || '2'} onChange={handleChange} min="1" max="5"/></label>
                        <label>Ночь (22-6): <input type="number" name="energyLevelByDayTime.night" value={config.energyLevelByDayTime?.night || '1'} onChange={handleChange} min="1" max="5"/></label>
                    </fieldset>
                    <label>Предпочитаемый стиль работы:
                        <select name="workStylePreference" value={config.workStylePreference || 'с перерывами'} onChange={handleChange}>
                            <option value="подряд">Делать дела подряд</option>
                            <option value="с перерывами">Брать перерывы между делами</option>
                        </select>
                    </label>
                    {config.workStylePreference === 'с перерывами' && (
                        <>
                            <label>Длительность рабочего блока (мин), если предпочитаете перерывы:
                                <input type="number" name="taskChunkingMinutes" value={config.taskChunkingMinutes || '90'} onChange={handleChange} min="15" step="15" />
                            </label>
                            <label>Длительность перерыва (мин), если предпочитаете перерывы:
                                <input type="number" name="breakMinutes" value={config.breakMinutes || '15'} onChange={handleChange} min="5" step="5" />
                            </label>
                        </>
                    )}
                    <label>Скорость чтения:
                        <input type="text" name="readingSpeed" value={config.readingSpeed || ''} onChange={handleChange} placeholder="напр. 'средняя', '250 слов/мин'"/>
                    </label>
                    <label>Скорость набора текста:
                        <input type="text" name="typingSpeed" value={config.typingSpeed || ''} onChange={handleChange} placeholder="напр. 'быстрая', '300 зн/мин'"/>
                    </label>
                    <label>Уровень вашей усидчивости (от 1 до 10):
                        <input type="number" name="concentrationLevel" value={config.concentrationLevel || '7'} onChange={handleChange} min="1" max="10" />
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

                    <button type="submit" className="submit-button">Завершить настройку и начать</button>
                </form>
            </div>
        </div>
    );
};

export default OnboardingQuestionnairePage;