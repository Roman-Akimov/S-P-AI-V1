import React, {useCallback, useState} from 'react';
import './AiAssistant.css';

// --- Конфигурация AI ---
const API_ENDPOINT = 'https://api.aimlapi.com/v1/chat/completions';
const AI_MODEL = 'gpt-4o-mini';
const HARDCODED_API_KEY = '7c4a597d298949fc8d6a97c1c5fa1484';

// --- Функция вызова AI Service ---
const callAIService = async (prompt, systemPrompt) => {
    console.log("--- Вызов AI Service ---");
    console.log("System Prompt:", systemPrompt || "N/A");
    console.log("User Prompt:", prompt);

    const messages = [];
    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${HARDCODED_API_KEY}`,
            },
            body: JSON.stringify({
                model: AI_MODEL,
                messages: messages,
                temperature: 0.2, // Adjusted temperature, similar to Python's 0.3, can be tuned
            }),
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            console.error("AI API Error Response:", response.status, errorBody);
            throw new Error(`AI API Error: ${response.status} ${response.statusText}. ${errorBody.error?.message || ''}`);
        }

        const data = await response.json();
        console.log("AI Raw Response Data:", data);
        const aiText = data.choices?.[0]?.message?.content?.trim();

        if (!aiText) {
            console.error("Не удалось извлечь текстовый ответ из AI Response:", data);
            throw new Error("Не удалось получить текстовый ответ от AI.");
        }

        console.log("AI Text Response:", aiText);
        return { success: true, text: aiText };

    } catch (error) {
        console.error("Ошибка при вызове AI Service:", error);
        return { success: false, message: `Ошибка сети или API: ${error.message}` };
    }
};

// --- ОБНОВЛЕННАЯ Функция парсинга ТЕКСТОВОГО ответа AI ---
const parseAiTextResponse = (fullAiText, categories) => {
    console.log("Parsing full AI text:", fullAiText);

    const allParsedTasks = [];
    let overallParseError = null;

    const taskSeparator = "--- НОВАЯ ЗАДАЧА ---";
    const taskBlocks = fullAiText.split(taskSeparator).map(block => block.trim()).filter(block => block.length > 0);

    if (taskBlocks.length === 0 && fullAiText.trim().length > 0) {
        taskBlocks.push(fullAiText.trim());
        console.log("No separators found, parsing as a single task block.");
    } else if (taskBlocks.length === 0) {
        console.log("No task blocks found in AI response.");
        return { success: false, tasks: [], message: "AI не предоставил текст для разбора задач." };
    }

    console.log(`Found ${taskBlocks.length} task block(s) to parse.`);

    taskBlocks.forEach((text, blockIndex) => {
        console.log(`\nParsing task block #${blockIndex + 1}:\n`, text);
        let parseErrorForBlock = null;

        try {
            let title = "Без названия";
            let startDate = new Date(); startDate.setHours(0, 0, 0, 0);
            let startTime = null;
            let endDate = null;
            let isAllDay = true;
            let description = ""; let location = ""; let categoryGuess = ""; let priority = "Medium";
            const lines = text.split('\n'); const now = new Date();

            const titleMatch = text.match(/^(.*?)(?:сегодня|завтра|послезавтра|\d{1,2}[./]\d{1,2}|\d{4}-\d{2}-\d{2}|в\s+\d{1,2}:\d{2}|с\s+\d{1,2}:\d{2}\s*(?:до|по)\s*\d{1,2}:\d{2}|\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}|$)/i);
            if (titleMatch && titleMatch[1].trim()) { title = titleMatch[1].trim().replace(/[:\-]+$/, '').trim(); }
            else if (lines.length > 0 && lines[0].trim().length < 100 && !lines[0].toLowerCase().startsWith("дата:") && !lines[0].toLowerCase().startsWith("время:")) { title = lines[0].trim(); }
            console.log(`  [Block ${blockIndex + 1}] Parsed Title:`, title);

            let dateFound = false;
            const dateRegex = /(\d{1,2}[./]\d{1,2}[./]\d{4})|(\d{4}-\d{2}-\d{2})/;
            let dateMatchInBlock = text.match(dateRegex);
            if (dateMatchInBlock) {
                const dateStr = dateMatchInBlock[1] || dateMatchInBlock[2];
                const parts = dateStr.includes('.') ? dateStr.split('.') : dateStr.split('-');
                const formattedDateStr = parts.length === 3 ? (dateStr.includes('.') ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateStr) : null;
                if (formattedDateStr) { const parsedDate = new Date(formattedDateStr); if (!isNaN(parsedDate.getTime())) { startDate = parsedDate; startDate.setHours(0, 0, 0, 0); dateFound = true; } }
            } else if (/завтра/i.test(text)) { const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1); startDate = tomorrow; startDate.setHours(0,0,0,0); dateFound = true; }
            else if (/послезавтра/i.test(text)) { const dayAfterTomorrow = new Date(now); dayAfterTomorrow.setDate(now.getDate() + 2); startDate = dayAfterTomorrow; startDate.setHours(0,0,0,0); dateFound = true; }
            else if (/сегодня/i.test(text)) { startDate = new Date(now); startDate.setHours(0,0,0,0); dateFound = true; }
            if (dateFound) console.log(`  [Block ${blockIndex + 1}] Parsed Date:`, startDate.toLocaleDateString());
            else console.log(`  [Block ${blockIndex + 1}] Date not explicitly found, using today.`);

            let timeParsedSuccessfully = false;
            const timeRangeRegex = /(?:с\s+)?(\d{1,2}):(\d{2})\s*(?:-|до|по)\s*(\d{1,2}):(\d{2})/i;
            const timeRangeMatch = text.match(timeRangeRegex);

            if (timeRangeMatch) {
                const startHours = parseInt(timeRangeMatch[1], 10); const startMinutes = parseInt(timeRangeMatch[2], 10);
                const endHours = parseInt(timeRangeMatch[3], 10); const endMinutes = parseInt(timeRangeMatch[4], 10);
                if (startHours >= 0 && startHours < 24 && startMinutes >= 0 && startMinutes < 60 &&
                    endHours >= 0 && endHours < 24 && endMinutes >= 0 && endMinutes < 60) {
                    startDate.setHours(startHours, startMinutes, 0, 0);
                    startTime = { hours: startHours, minutes: startMinutes };
                    endDate = new Date(startDate.getTime());
                    endDate.setHours(endHours, endMinutes, 0, 0);
                    isAllDay = false; timeParsedSuccessfully = true;
                    console.log(`  [Block ${blockIndex + 1}] Parsed Time Range: ${startHours}:${startMinutes} to ${endHours}:${endMinutes}`);
                    console.log(`  [Block ${blockIndex + 1}] Calculated Start: ${startDate}`);
                    console.log(`  [Block ${blockIndex + 1}] Calculated End: ${endDate}`);
                }
            }

            if (!timeParsedSuccessfully) {
                const singleTimeRegex = /(\d{1,2}):(\d{2})/; const singleTimeMatch = text.match(singleTimeRegex);
                if (singleTimeMatch) {
                    const hours = parseInt(singleTimeMatch[1], 10); const minutes = parseInt(singleTimeMatch[2], 10);
                    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
                        startDate.setHours(hours, minutes); startTime = { hours, minutes }; isAllDay = false;
                        endDate = new Date(startDate.getTime() + 3600 * 1000); timeParsedSuccessfully = true;
                        console.log(`  [Block ${blockIndex + 1}] Parsed Single Time: ${hours}:${minutes}`);
                    }
                } else if (/утром/i.test(text)) { startDate.setHours(9, 0); startTime = { hours: 9, minutes: 0 }; isAllDay = false; endDate = new Date(startDate.getTime() + 3600 * 1000); timeParsedSuccessfully = true; }
                else if (/днем|в обед/i.test(text)) { startDate.setHours(13, 0); startTime = { hours: 13, minutes: 0 }; isAllDay = false; endDate = new Date(startDate.getTime() + 3600 * 1000); timeParsedSuccessfully = true; }
                else if (/вечером/i.test(text)) { startDate.setHours(18, 0); startTime = { hours: 18, minutes: 0 }; isAllDay = false; endDate = new Date(startDate.getTime() + 3600 * 1000); timeParsedSuccessfully = true; }
            }

            if (timeParsedSuccessfully && /весь день/i.test(text)) {
                isAllDay = true; startTime = null; endDate = null;
                console.log(`  [Block ${blockIndex + 1}] Overridden by "весь день"`);
            } else if (!timeParsedSuccessfully && /весь день/i.test(text)) {
                isAllDay = true; startTime = null; endDate = null;
                console.log(`  [Block ${blockIndex + 1}] Parsed: All day event`);
            }

            if (!isAllDay && startTime) console.log(`  [Block ${blockIndex + 1}] Final Time: Start ${startTime.hours}:${startTime.minutes}${endDate ? ', End ' + endDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : ''}`);
            else if (isAllDay) console.log(`  [Block ${blockIndex + 1}] Final: All day event`);
            else console.log(`  [Block ${blockIndex + 1}] Time not explicitly found, assuming all day.`);

            const descMarker = "описание:"; const descIndex = text.toLowerCase().indexOf(descMarker);
            if (descIndex !== -1) {
                let descCandidate = text.substring(descIndex + descMarker.length).trim();
                const nextMarkersRegex = /\n\s*(?:место:|где:|локация:|категория:|приоритет:)/i;
                const nextMarkerMatch = descCandidate.match(nextMarkersRegex);
                if (nextMarkerMatch && nextMarkerMatch.index !== undefined) { descCandidate = descCandidate.substring(0, nextMarkerMatch.index).trim(); }
                description = descCandidate;
            }
            if (description) console.log(`  [Block ${blockIndex + 1}] Parsed Description:`, description.substring(0,50) + "...");

            const locMatch = text.match(/(?:место|где|локация)[:\s@]+(.*?)(?:\n|$)/i);
            if (locMatch && locMatch[1].trim()) { location = locMatch[1].trim(); }
            if (location) console.log(`  [Block ${blockIndex + 1}] Parsed Location:`, location);

            const lowerText = text.toLowerCase();
            const foundCategory = categories.find(cat => lowerText.includes(cat.name.toLowerCase()));
            if (foundCategory) { categoryGuess = foundCategory.name; }
            if (categoryGuess) console.log(`  [Block ${blockIndex + 1}] Parsed Category Guess:`, categoryGuess);

            if (/\b(важно|срочно|высокий)\b/i.test(text)) { priority = "High"; }
            else if (/\b(неважно|низкий)\b/i.test(text)) { priority = "Low"; }
            console.log(`  [Block ${blockIndex + 1}] Parsed Priority:`, priority);

            if (title === "Без названия" && !description && !location && !dateFound && isAllDay && !startTime) {
                console.log(`  [Block ${blockIndex + 1}] Skipping due to lack of meaningful data.`);
                parseErrorForBlock = "Блок не содержит достаточно информации для создания задачи.";
            } else {
                const task = { _originalIndex: blockIndex, title: title, start: new Date(startDate.getTime()), end: isAllDay ? new Date(startDate.getTime()) : (endDate ? new Date(endDate.getTime()) : null), isAllDay: isAllDay, description: description, location: location, categoryGuess: categoryGuess, priority: priority };
                allParsedTasks.push(task);
            }
        } catch (e) {
            console.error(`Ошибка парсинга блока #${blockIndex + 1}:`, e);
            parseErrorForBlock = `Не удалось разобрать блок #${blockIndex + 1}: ${e.message}`;
        }
        if (parseErrorForBlock && !overallParseError) { overallParseError = parseErrorForBlock; }
        else if (parseErrorForBlock) { overallParseError += `; ${parseErrorForBlock}`; }
    });

    console.log("Total parsed tasks:", allParsedTasks.length);
    return { success: allParsedTasks.length > 0, tasks: allParsedTasks, message: overallParseError };
};

// --- Компонент AiAssistant ---
const AiAssistant = ({ aiConfig, categories, onAddSchedules }) => {
    const [userPrompt, setUserPrompt] = useState('');
    const [useSystemPrompt, setUseSystemPrompt] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [aiResponseText, setAiResponseText] = useState('');
    const [suggestedTasks, setSuggestedTasks] = useState([]);
    const [selectedTaskIndices, setSelectedTaskIndices] = useState([]);
    const [error, setError] = useState('');

    const generateSystemPrompt = useCallback(() => {
        if (!aiConfig) return "Ошибка: Данные конфигурации пользователя (aiConfig) отсутствуют."; // Guard clause

        const todayFullString = new Date().toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const currentDayOfWeekJS = new Date().getDay();
        const jsDayToPythonDay = [7, 1, 2, 3, 4, 5, 6];
        const pythonDayOfWeek = jsDayToPythonDay[currentDayOfWeekJS];
        const taskSeparator = "\n--- НОВАЯ ЗАДАЧА ---\n";

        // Constructing the "personal_card" equivalent from aiConfig
        let userDataSection = "### Данные пользователя (на основе анкеты и настроек):\n";
        userDataSection += `- **Род занятий:** ${aiConfig.occupation || 'Не указано'}\n`;
        userDataSection += `- **График работы (описательно):** ${aiConfig.workScheduleText || 'Не указано'}\n`;
        userDataSection += `- **Стандартное время работы:** с ${aiConfig.workStartTime || 'N/A'} до ${aiConfig.workEndTime || 'N/A'}\n`;
        userDataSection += `- **Предпочитаемые рабочие дни (для стандартного графика):** ${aiConfig.preferredWorkDays?.join(', ') || 'не указаны'}\n`;
        userDataSection += `- **Удаленность работы/учебы:** ${aiConfig.commuteDistance || 'Не указано'}\n`;
        userDataSection += `- **Обычный транспорт:** ${aiConfig.transportMode || 'Не указано'}\n`;
        userDataSection += `- **Наилучшее время продуктивности (описательно):** ${aiConfig.peakProductivityTime || 'Не указано'}\n`;
        userDataSection += `- **Уровни продуктивности (по времени суток, 1-низкий, 5-высокий):** Утро: ${aiConfig.energyLevelByDayTime?.morning || '?'}, День: ${aiConfig.energyLevelByDayTime?.afternoon || '?'}, Вечер: ${aiConfig.energyLevelByDayTime?.evening || '?'}, Ночь: ${aiConfig.energyLevelByDayTime?.night || '?'}\n`;
        userDataSection += `- **Предпочитаемый стиль работы:** ${aiConfig.workStylePreference === 'подряд' ? 'Делать дела подряд' : 'Брать перерывы между делами'}\n`;
        if (aiConfig.workStylePreference === 'с перерывами') {
            userDataSection += `  - Длительность рабочего блока: ~${aiConfig.taskChunkingMinutes || 'N/A'} минут\n`;
            userDataSection += `  - Длительность перерыва: ~${aiConfig.breakMinutes || 'N/A'} минут\n`;
        }
        userDataSection += `- **Скорость чтения:** ${aiConfig.readingSpeed || 'Не указана'}\n`;
        userDataSection += `- **Скорость набора текста:** ${aiConfig.typingSpeed || 'Не указана'}\n`;
        userDataSection += `- **Уровень усидчивости (1-10):** ${aiConfig.concentrationLevel || 'Не указан'}\n`;
        userDataSection += `- **Тип личности:** ${aiConfig.personalityType || 'Не указан'}\n`;
        userDataSection += `- **Образование:** ${aiConfig.educationBackground || 'Не указано'}\n`;
        userDataSection += `- **Личные предпочтения/заметки для AI:** ${aiConfig.personalPreferencesNotes || 'Нет особых пожеланий.'}\n`;
        userDataSection += `- **Доступные категории задач:** ${categories.map(c => c.name).join(', ') || 'Нет категорий'}\n`;


        let generalConsiderations = "### Как учитывать анкету и общие принципы планирования:\n";
        generalConsiderations += "1.  **Рабочий/учебный график и занятость:** Нельзя планировать задачи в стандартное рабочее/учебное время, указанное в анкете. Учитывай описательный график работы, если он есть. Также помни о времени на дорогу (поле 'Удаленность работы/учебы' и 'Обычный транспорт').\n";
        generalConsiderations += "2.  **Продуктивность:** Выбирай время для задач, когда пользователь наиболее продуктивен, основываясь на полях 'Наилучшее время продуктивности (описательно)' и 'Уровни продуктивности (по времени суток)'.\n";
        generalConsiderations += "3.  **Перерывы:** Если пользователь предпочитает 'Брать перерывы между делами', не ставь задачи подряд. Учитывай указанную длительность рабочего блока и перерыва.\n";
        generalConsiderations += "4.  **Скорость выполнения и тип задач:** Задачи, связанные с направленностью образования пользователя (поле 'Образование'), могут выполняться быстрее (например, гуманитарные задачи для гуманитария). Учитывай 'Скорость чтения' и 'Скорость набора текста' для оценки времени на письменные/читаемые задачи.\n";
        generalConsiderations += "5.  **Усидчивость и тип личности:** 'Уровень усидчивости' может влиять на максимальную продолжительность одного блока работы. 'Тип личности' может влиять на предпочтение работы в одиночестве или с кем-то (если это релевантно задаче).\n";
        generalConsiderations += "6.  **Личные предпочтения:** Обязательно учитывай информацию из поля 'Личные предпочтения/заметки для AI'. Например, если пользователь хочет видеть друзей раз в неделю, старайся оставить для этого время или предложи это, если задача не конфликтует.\n";
        generalConsiderations += `7.  **Категории задач:** Отнеси задачу к одной из доступных категорий.\n`;

        let durationInterpretationRules = "### Правила интерпретации срока выполнения (если пользователь указывает период):\n";
        durationInterpretationRules += "- Если \"на этой неделе\": до ближайшего воскресенья включительно.\n";
        durationInterpretationRules += "- Если \"на этом месяце\": до последнего дня текущего месяца включительно.\n";
        durationInterpretationRules += "- Если \"до пятницы\" и т.п.: вычисли разницу в днях, включая конечный день.\n";
        durationInterpretationRules += "- Если \"за X дней\", \"до завтра\": вычисли явное количество дней.\n";
        durationInterpretationRules += "- Если срок не указан: используй значение по умолчанию `3 дня` (если задача не выглядит очень маленькой или большой) для определения окна планирования.\n";

        return `Ты — интеллектуальный планировщик задач. Твоя задача — анализировать информацию из запроса пользователя и его анкеты, чтобы выбрать **оптимальное время и параметры** для выполнения каждой задачи.

---
${userDataSection}
---
${generalConsiderations}
---
### Текущая дата и время:
${todayFullString}
(Текущий номер дня недели: ${pythonDayOfWeek}, где Понедельник = 1, ..., Воскресенье = 7)
---
${durationInterpretationRules}
---
### Формат твоего ответа (строго соблюдать!):
Проанализируй запрос пользователя. Если в запросе несколько задач, ОПИШИ КАЖДУЮ ЗАДАЧУ ОТДЕЛЬНО, разделяя их специальным маркером: "${taskSeparator.trim()}".

Для КАЖДОЙ задачи в ответе предоставь информацию в следующем формате (каждый пункт с новой строки, если присутствует):
- **Название задачи:** (Четкое название)
- **Дата:** (День.Месяц.Год или "сегодня", "завтра")
- **Время:** (Часы:Минуты, или "с ЧЧ:ММ до ЧЧ:ММ", или "весь день")
- **Описание:** (Краткое описание/детали задачи)
- **Место:** (Если применимо)
- **Категория:** (Одна из доступных)
- **Приоритет:** (Например, Важно, Средний, Низкий)
- **Примерное время выполнения:** (Твоя оценка, например, "1 час 30 минут", "около 2 часов")

**Пример ответа для запроса "Нужно подготовить отчет к среде и сходить на тренировку завтра вечером":**
Подготовить отчет
Дата: (выбери подходящий день до среды)
Время: (выбери оптимальное время, учитывая продуктивность)
Описание: Составить ежемесячный отчет по продажам.
Категория: Работа
Приоритет: Важно
Примерное время выполнения: 2 часа
${taskSeparator.trim()}
Тренировка
Дата: завтра
Время: вечером (например, 19:00 - 20:30)
Описание: Сходить на запланированную тренировку.
Категория: Личное
Приоритет: Средний
Примерное время выполнения: 1 час 30 минут

**Никакого лишнего текста! Только информация в указанном формате.**
`;
    }, [aiConfig, categories]);

    const handleSendPrompt = async () => {
        if (!userPrompt.trim()) { setError("Введите ваш запрос."); return; }
        if (!HARDCODED_API_KEY || HARDCODED_API_KEY === 'ВАШ_API_КЛЮЧ_СЮДА') {
            setError("Ошибка: API ключ не задан в исходном коде компонента AiAssistant.");
            return;
        }

        setIsLoading(true); setError(''); setAiResponseText('');
        setSuggestedTasks([]); setSelectedTaskIndices([]);
        const systemPrompt = useSystemPrompt ? generateSystemPrompt() : null;
        const aiResult = await callAIService(userPrompt, systemPrompt);

        if (!aiResult.success) {
            setError(aiResult.message || "Произошла неизвестная ошибка при вызове AI.");
            setIsLoading(false); return;
        }
        setAiResponseText(aiResult.text);
        const parseResult = parseAiTextResponse(aiResult.text, categories);

        let currentError = '';
        if (parseResult.message) {
            currentError = `Предупреждение при парсинге: ${parseResult.message}`;
        }

        if (parseResult.success && parseResult.tasks.length > 0) {
            const validTasks = parseResult.tasks.filter(task => task.title && task.start && !isNaN(task.start.getTime()));
            if (validTasks.length > 0) {
                setSuggestedTasks(validTasks);
                setSelectedTaskIndices(validTasks.map((_, index) => index));
            } else if (!parseResult.message) { // Если задачи были, но невалидны, и нет сообщения от парсера
                currentError = currentError ? `${currentError}; AI ответил, но не удалось извлечь корректные задачи из текста.` : "AI ответил, но не удалось извлечь корректные задачи из текста.";
            }
        } else if (!parseResult.message) { // Если парсер не вернул задач и нет сообщения об ошибке
            currentError = currentError ? `${currentError}; AI ответил, но в тексте не найдено задач для добавления.` : "AI ответил, но в тексте не найдено задач для добавления.";
        }

        if(currentError) setError(currentError);
        setIsLoading(false);
    };

    const handleTaskSelectionChange = (index) => {
        setSelectedTaskIndices(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
    };

    const formatParsedTaskForState = useCallback((parsedTask) => {
        const category = categories.find(cat => cat.name === parsedTask.categoryGuess);
        const categoryId = category ? category.id : (categories[0]?.id || null);
        const formatDateToDateTimeLocalString = (d) => { if (!d || !(d instanceof Date) || isNaN(d.getTime())) { const n=new Date(), lN=new Date(n.getTime()-(n.getTimezoneOffset()*60000)); return lN.toISOString().slice(0,16); } const lD = new Date(d.getTime()-(d.getTimezoneOffset()*60000)); return lD.toISOString().slice(0,16); };
        const formatDateToDateString = (d) => { if (!d || !(d instanceof Date) || isNaN(d.getTime())) { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; } return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
        let startStr = ''; let endStr = ''; const startDate = parsedTask.start; const endDate = parsedTask.end;
        if (parsedTask.isAllDay) { startStr = formatDateToDateString(startDate); endStr = startStr; }
        else {
            startStr = formatDateToDateTimeLocalString(startDate);
            if (endDate && endDate instanceof Date && !isNaN(endDate.getTime())) {
                endStr = formatDateToDateTimeLocalString(endDate);
            } else { // Если нет валидного endDate (например, для одиночного времени без указания длительности)
                const defaultEndDate = new Date(startDate.getTime() + 3600 * 1000); // Ставим +1 час
                endStr = formatDateToDateTimeLocalString(defaultEndDate);
            }
        }
        const generateId = () => `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        return { id: generateId(), categoryId: categoryId, title: parsedTask.title, description: parsedTask.description || '', isAllDay: parsedTask.isAllDay, start: startStr, end: endStr, location: parsedTask.location || '', priority: parsedTask.priority || 'Medium', completed: false, subtasks: [] };
    }, [categories]);

    const handleAddSelectedTasks = () => {
        const tasksToAdd = selectedTaskIndices.map(index => suggestedTasks[index]).map(formatParsedTaskForState).filter(task => task !== null);
        if (tasksToAdd.length > 0) { console.log("Adding schedules from AI (parsed text):", tasksToAdd); onAddSchedules(tasksToAdd); setAiResponseText(''); setSuggestedTasks([]); setSelectedTaskIndices([]); }
        else { setError("Нет выбранных корректных задач для добавления."); }
    };

    return (
        <div className="ai-assistant-container">
            <h2>AI Ассистент</h2>
            {(!HARDCODED_API_KEY || HARDCODED_API_KEY === 'ВАШ_API_КЛЮЧ_СЮДА') && (
                <p className="ai-error-message">
                    Внимание! API ключ не задан или некорректен в исходном коде (AiAssistant.jsx).
                    Функциональность AI будет недоступна.
                </p>
            )}
            <p>Введите ваш запрос для добавления задач.</p>
            <div className="ai-prompt-section">
                <textarea
                    rows="4"
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    placeholder="Например: Совещание завтра в 10 и обед с клиентом с 13:30 до 14:30"
                    disabled={isLoading}
                />
                <div className="ai-options">
                    <label>
                        <input type="checkbox" checked={useSystemPrompt} onChange={(e) => setUseSystemPrompt(e.target.checked)} disabled={isLoading} />
                        Использовать системный промпт (контекст)
                    </label>
                    <button onClick={handleSendPrompt} disabled={isLoading || !userPrompt.trim() || !HARDCODED_API_KEY || HARDCODED_API_KEY === 'ВАШ_API_КЛЮЧ_СЮДА'}>
                        {isLoading ? 'Обработка...' : 'Отправить AI'}
                    </button>
                </div>
            </div>
            {error && <p className="ai-error-message">{error}</p>}
            {isLoading && <div className="ai-loading-indicator">AI думает...</div>}
            {aiResponseText && !isLoading && ( <div className="ai-raw-response"> <h4>Текстовый ответ AI:</h4> <pre>{aiResponseText}</pre> </div> )}
            {suggestedTasks.length > 0 && (
                <div className="ai-response-section">
                    <h3>Предложенные задачи (разобрано из текста):</h3>
                    <p>Отметьте задачи, которые хотите добавить.</p>
                    <ul className="suggested-tasks-list">
                        {suggestedTasks.map((task, index) => {
                            const category = categories.find(cat => cat.name === task.categoryGuess);
                            let displayTime = ''; try { const date = task.start; if (task.isAllDay) { displayTime = date.toLocaleDateString('ru-RU'); } else { displayTime = date.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }); if (task.end && !task.isAllDay && task.end.getTime() !== task.start.getTime() ) { displayTime += ` - ${new Date(task.end).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})}`;} } } catch { displayTime = 'Неверная дата'}
                            return ( <li key={task._originalIndex}> <label> <input type="checkbox" checked={selectedTaskIndices.includes(index)} onChange={() => handleTaskSelectionChange(index)} /> <strong>{task.title}</strong> {category && <span className="task-category-ai" style={{backgroundColor: category.color}}>{category.name}</span>} {!category && task.categoryGuess && <span className="task-category-ai guess">({task.categoryGuess}?)</span>} <span className="task-time-ai"> [{displayTime}]</span> {task.location && <span className="task-location-ai"> @ {task.location}</span>} {task.description && <span className="task-desc-ai"> - {task.description}</span>} </label> </li> );
                        })}
                    </ul>
                    <button onClick={handleAddSelectedTasks} disabled={selectedTaskIndices.length === 0} className="add-selected-button"> Добавить выбранные ({selectedTaskIndices.length}) </button>
                </div>
            )}
            {!isLoading && suggestedTasks.length === 0 && aiResponseText && !error && ( <p>AI ответил, но не удалось распознать задачи в его тексте.</p> )}
        </div>
    );
};

export default AiAssistant;