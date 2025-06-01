import React, {useCallback, useState} from 'react';
import './AiAssistant.css';

const API_ENDPOINT = 'https://api.aimlapi.com/v1/chat/completions';
const AI_MODEL = 'gpt-4o-mini';
const HARDCODED_API_KEY = '7c4a597d298949fc8d6a97c1c5fa1484'; // ЗАМЕНИТЕ НА ВАШ КЛЮЧ

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
                temperature: 0.2,
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


const parseAiTextResponse = (fullAiText, categoriesFromApp) => {
    console.log("--- Начало парсинга ответа AI --- \nПолный текст:\n", fullAiText);

    const allParsedTasks = [];
    let overallParseError = null;

    const taskSeparator = "--- НОВАЯ ЗАДАЧА ---";
    const taskBlocks = fullAiText.split(taskSeparator)
        .map(block => block.trim())
        .filter(block => block.length > 0);

    if (taskBlocks.length === 0 && fullAiText.trim().length > 0) {
        taskBlocks.push(fullAiText.trim());
        console.log("Сепараторы не найдены, парсинг всего текста как одного блока задачи.");
    } else if (taskBlocks.length === 0) {
        console.log("Блоки задач не найдены в ответе AI.");
        return { success: false, tasks: [], message: "AI не предоставил текст для разбора задач." };
    }

    console.log(`Найдено ${taskBlocks.length} блоков задач для парсинга.`);

    taskBlocks.forEach((textBlock, blockIndex) => {
        console.log(`\n--- Парсинг блока #${blockIndex + 1} --- \nТекст блока:\n`, textBlock);
        let parseErrorForBlock = null;

        try {
            const task = {
                _originalIndex: blockIndex,
                title: "",
                description: "",
                categoryGuess: "",
                priority: "Medium",
                start: new Date(),
                end: null,
                isAllDay: true,
                location: ""
            };
            task.start.setHours(0,0,0,0);

            const lines = textBlock.split('\n').map(line => line.trim()).filter(line => line);
            let descriptionLines = [];
            let titleFound = false;

            lines.forEach(line => {
                const lowerLine = line.toLowerCase();
                let match;

                // Извлечение Названия задачи
                match = line.match(/^(?:\*\*)?Название задачи(?:\*\*)?[:\s-]+(.*)/i);
                if (match && match[1]) {
                    task.title = match[1].trim();
                    titleFound = true;
                    console.log(`  [Блок ${blockIndex + 1}] Название (метка):`, task.title);
                    return; // Переходим к следующей строке
                }

                // Извлечение Описания
                match = line.match(/^(?:\*\*)?Описание(?:\*\*)?[:\s-]+(.*)/i);
                if (match && match[1]) {
                    descriptionLines.push(match[1].trim());
                    console.log(`  [Блок ${blockIndex + 1}] Описание (метка, первая строка):`, match[1].trim());
                    return;
                }

                // Извлечение Категории
                match = line.match(/^(?:\*\*)?Категория(?:\*\*)?[:\s-]+(.*)/i);
                if (match && match[1]) {
                    task.categoryGuess = match[1].trim();
                    console.log(`  [Блок ${blockIndex + 1}] Категория (метка):`, task.categoryGuess);
                    return;
                }

                // Извлечение Приоритета
                match = line.match(/^(?:\*\*)?Приоритет(?:\*\*)?[:\s-]+(.*)/i);
                if (match && match[1]) {
                    const prio = match[1].trim().toLowerCase();
                    if (prio.includes("важно") || prio.includes("высокий")) task.priority = "High";
                    else if (prio.includes("низкий")) task.priority = "Low";
                    else task.priority = "Medium";
                    console.log(`  [Блок ${blockIndex + 1}] Приоритет (метка):`, task.priority);
                    return;
                }

                // Извлечение Даты
                match = line.match(/^(?:\*\*)?Дата(?:\*\*)?[:\s-]+(.*)/i);
                if (match && match[1]) {
                    const dateStr = match[1].trim();
                    let parsedDate = null;
                    if (/сегодня/i.test(dateStr)) parsedDate = new Date();
                    else if (/завтра/i.test(dateStr)) { parsedDate = new Date(); parsedDate.setDate(parsedDate.getDate() + 1); }
                    else if (/послезавтра/i.test(dateStr)) { parsedDate = new Date(); parsedDate.setDate(parsedDate.getDate() + 2); }
                    else { // Пытаемся распарсить ДД.ММ.ГГГГ или ГГГГ-ММ-ДД
                        const datePartsDMY = dateStr.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
                        const datePartsYMD = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
                        if (datePartsDMY) parsedDate = new Date(datePartsDMY[3], datePartsDMY[2] - 1, datePartsDMY[1]);
                        else if (datePartsYMD) parsedDate = new Date(datePartsYMD[1], datePartsYMD[2] - 1, datePartsYMD[3]);
                    }
                    if (parsedDate && !isNaN(parsedDate.getTime())) {
                        task.start = parsedDate;
                        task.start.setHours(0,0,0,0);
                        console.log(`  [Блок ${blockIndex + 1}] Дата (метка):`, task.start.toLocaleDateString());
                    } else {
                        console.log(`  [Блок ${blockIndex + 1}] Не удалось распознать дату из метки:`, dateStr);
                    }
                    return;
                }

                // Извлечение Времени
                match = line.match(/^(?:\*\*)?Время(?:\*\*)?[:\s-]+(.*)/i);
                if (match && match[1]) {
                    const timeStr = match[1].trim();

                    const timeRangeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(?:-|до|по)\s*(\d{1,2}):(\d{2})/i);
                    const singleTimeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);

                    if (timeRangeMatch) {
                        task.start.setHours(parseInt(timeRangeMatch[1]), parseInt(timeRangeMatch[2]), 0, 0);
                        task.end = new Date(task.start);
                        task.end.setHours(parseInt(timeRangeMatch[3]), parseInt(timeRangeMatch[4]), 0, 0);
                        task.isAllDay = false;
                        console.log(`  [Блок ${blockIndex + 1}] Время (метка, диапазон):`, timeStr);
                    } else if (singleTimeMatch) {
                        task.start.setHours(parseInt(singleTimeMatch[1]), parseInt(singleTimeMatch[2]), 0, 0);
                        task.end = new Date(task.start.getTime() + 3600000);
                        task.isAllDay = false;
                        console.log(`  [Блок ${blockIndex + 1}] Время (метка, одно значение):`, timeStr);
                    } else if (/весь день/i.test(timeStr)) {
                        task.isAllDay = true;
                        task.end = null;
                        console.log(`  [Блок ${blockIndex + 1}] Время (метка): Весь день`);
                    } else {
                        console.log(`  [Блок ${blockIndex + 1}] Не удалось распознать время из метки:`, timeStr);
                    }
                    return;
                }

                // Извлечение Места
                match = line.match(/^(?:\*\*)?Место(?:\*\*)?[:\s@-]+(.*)/i);
                if (match && match[1]) {
                    task.location = match[1].trim();
                    console.log(`  [Блок ${blockIndex + 1}] Место (метка):`, task.location);
                    return;
                }

                // Если строка не распознана как специфическое поле
                // и заголовок еще не найден, и это первая строка блока, считаем ее заголовком
                if (!titleFound && lines.indexOf(line.trim()) === 0 && line.length < 100) {
                    task.title = line.trim();
                    titleFound = true;
                    console.log(`  [Блок ${blockIndex + 1}] Название (первая строка):`, task.title);
                } else {
                    // Иначе добавляем к описанию
                    descriptionLines.push(line.trim());
                    console.log(`  [Блок ${blockIndex + 1}] Добавлено в описание:`, line.trim());
                }
            });

            task.description = descriptionLines.join('\n').trim();

            // Если заголовок так и не был найден по метке или как первая строка, но есть описание,
            // можно взять первую строку описания как заголовок.
            if (!task.title && task.description) {
                const descLines = task.description.split('\n');
                task.title = descLines[0].trim();
                task.description = descLines.slice(1).join('\n').trim();
                console.log(`  [Блок ${blockIndex + 1}] Название (из описания):`, task.title);
            }

            // Финальная проверка на пустой заголовок
            if (!task.title || task.title.toLowerCase() === "без названия") {
                if (task.description || task.location || !task.isAllDay) {
                    task.title = "Задача от AI"; // Заглушка, если все остальное есть
                } else {
                    console.log(`  [Блок ${blockIndex + 1}] Пропуск блока: отсутствует осмысленная информация.`);
                    parseErrorForBlock = "Блок не содержит достаточно информации для создания задачи.";
                }
            }

            if (task.title !== "Задача от AI" || task.description || task.location || !task.isAllDay) {
                allParsedTasks.push(task);
            }

        } catch (e) {
            console.error(`Ошибка парсинга блока #${blockIndex + 1}:`, e);
            parseErrorForBlock = `Не удалось разобрать блок #${blockIndex + 1}: ${e.message}`;
        }

        if (parseErrorForBlock && !overallParseError) { overallParseError = parseErrorForBlock; }
        else if (parseErrorForBlock) { overallParseError += `; ${parseErrorForBlock}`; }
    });

    console.log("--- Парсинг завершен --- \nВсего извлечено задач:", allParsedTasks.length);
    if (overallParseError) console.warn("Общие ошибки/предупреждения парсинга:", overallParseError);

    return { success: allParsedTasks.length > 0, tasks: allParsedTasks, message: overallParseError };
};


const AiAssistant = ({ aiConfig, categories, onAddSchedules }) => {
    const [userPrompt, setUserPrompt] = useState('');
    const [useSystemPrompt, setUseSystemPrompt] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [aiResponseText, setAiResponseText] = useState('');
    const [suggestedTasks, setSuggestedTasks] = useState([]);
    const [selectedTaskIndices, setSelectedTaskIndices] = useState([]);
    const [error, setError] = useState('');


    const generateSystemPrompt = useCallback(() => {
        if (!aiConfig) return "Ошибка: Данные конфигурации пользователя (aiConfig) отсутствуют.";
        const todayFullString = new Date().toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const currentDayOfWeekJS = new Date().getDay();
        const jsDayToPythonDay = [7, 1, 2, 3, 4, 5, 6];
        const pythonDayOfWeek = jsDayToPythonDay[currentDayOfWeekJS];
        const taskSeparator = "\n--- НОВАЯ ЗАДАЧА ---\n";
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
Название задачи: Подготовить отчет
Дата: (выбери подходящий день до среды)
Время: (выбери оптимальное время, учитывая продуктивность)
Описание: Составить ежемесячный отчет по продажам.
Категория: Работа
Приоритет: Важно
Примерное время выполнения: 2 часа
${taskSeparator.trim()}
Название задачи: Тренировка
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
                setSelectedTaskIndices(validTasks.map((_, index) => index)); // Выбираем все по умолчанию
            } else if (!parseResult.message) {
                currentError = currentError ? `${currentError}; AI ответил, но не удалось извлечь корректные задачи из текста.` : "AI ответил, но не удалось извлечь корректные задачи из текста.";
            }
        } else if (!parseResult.message) {
            currentError = currentError ? `${currentError}; AI ответил, но в тексте не найдено задач для добавления.` : "AI ответил, но в тексте не найдено задач для добавления.";
        }

        if(currentError) setError(currentError);
        setIsLoading(false);
    };

    const handleTaskSelectionChange = (index) => {
        setSelectedTaskIndices(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
    };

    const formatDateToDateTimeLocalString = (d) => { /* ... как в CalendarComponent ... */
        if (!d || !(d instanceof Date) || isNaN(d.getTime())) { const n=new Date(), lN=new Date(n.getTime()-(n.getTimezoneOffset()*60000)); return lN.toISOString().slice(0,16); }
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };
    const formatDateToDateString = (d) => { /* ... как в CalendarComponent ... */
        if (!d || !(d instanceof Date) || isNaN(d.getTime())) { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; }
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    };
    const generateId = () => `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;


    const formatParsedTaskForState = useCallback((parsedTask) => {
        const category = categories.find(cat => cat.name.toLowerCase() === parsedTask.categoryGuess?.toLowerCase());
        const categoryId = category ? category.id : null;

        let startStr = '';
        let endStr = '';
        const startDate = parsedTask.start; // это уже объект Date из парсера
        const endDate = parsedTask.end;   // это тоже объект Date или null из парсера

        if (parsedTask.isAllDay) {
            startStr = formatDateToDateString(startDate);
            endStr = startStr; // Для allday end обычно равен start в UI
        } else {
            startStr = formatDateToDateTimeLocalString(startDate);
            if (endDate && endDate instanceof Date && !isNaN(endDate.getTime())) {
                endStr = formatDateToDateTimeLocalString(endDate);
            } else {
                const defaultEndDate = new Date(startDate.getTime() + 3600 * 1000);
                endStr = formatDateToDateTimeLocalString(defaultEndDate);
            }
        }

        return {
            id: generateId(),
            categoryId: categoryId,
            title: parsedTask.title,
            description: parsedTask.description || '',
            isAllDay: parsedTask.isAllDay,
            start: startStr,
            end: endStr,
            location: parsedTask.location || '',
            priority: parsedTask.priority || 'Medium',
            completed: false,
            subtasks: []
        };
    }, [categories]);

    const handleAddSelectedTasks = () => {
        const tasksToAdd = selectedTaskIndices
            .map(index => suggestedTasks[index])
            .map(formatParsedTaskForState) // Преобразуем в формат для состояния App
            .filter(task => task !== null && task.title); // Фильтруем пустые или невалидные

        if (tasksToAdd.length > 0) {
            console.log("Добавление задач из AI (финальный формат):", tasksToAdd);
            onAddSchedules(tasksToAdd);
            setAiResponseText('');
            setSuggestedTasks([]);
            setSelectedTaskIndices([]);
        } else {
            setError("Нет выбранных корректных задач для добавления.");
        }
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
            <p className="intro-text">Введите ваш запрос для добавления задач. AI постарается извлечь информацию и предложить задачи для вашего календаря.</p>
            <div className="ai-prompt-section">
                <textarea
                    rows="4"
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    placeholder="Например: Совещание завтра в 10 по проекту Альфа и обед с клиентом с 13:30 до 14:30 в кафе Центральное"
                    disabled={isLoading}
                />
                <div className="ai-options">
                    <label className="ai-checkbox-label">
                        <input type="checkbox" checked={useSystemPrompt} onChange={(e) => setUseSystemPrompt(e.target.checked)} disabled={isLoading} />
                        Использовать системный промпт (контекст анкеты)
                    </label>
                    <button
                        onClick={handleSendPrompt}
                        disabled={isLoading || !userPrompt.trim() || !HARDCODED_API_KEY || HARDCODED_API_KEY === 'ВАШ_API_КЛЮЧ_СЮДА'}
                        className="button primary submit-ai-button" // Используем глобальные классы
                    >
                        {isLoading ? 'Обработка...' : 'Отправить AI'}
                    </button>
                </div>
            </div>
            {error && <p className="ai-error-message">{error}</p>}
            {isLoading && <div className="ai-loading-indicator">AI думает...</div>}

            {aiResponseText && !isLoading && (
                <div className="ai-raw-response">
                    <h4>Текстовый ответ AI:</h4>
                    <pre>{aiResponseText}</pre>
                </div>
            )}

            {suggestedTasks.length > 0 && !isLoading && (
                <div className="ai-response-section">
                    <h3>Предложенные задачи (разобрано из текста):</h3>
                    <p>Отметьте задачи, которые хотите добавить в календарь.</p>
                    <ul className="suggested-tasks-list">
                        {suggestedTasks.map((task, index) => {
                            const category = categories.find(cat => cat.name.toLowerCase() === task.categoryGuess?.toLowerCase());
                            let displayTime = '';
                            try {
                                const date = task.start; // task.start уже Date объект из парсера
                                if (task.isAllDay) {
                                    displayTime = date.toLocaleDateString('ru-RU', {day: '2-digit', month: '2-digit', year: 'numeric'});
                                } else {
                                    displayTime = date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                                    if (task.end && task.end instanceof Date && !task.isAllDay && task.end.getTime() !== task.start.getTime() ) {
                                        displayTime += ` - ${new Date(task.end).toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'})}`;
                                    }
                                }
                            } catch { displayTime = 'Ошибка даты/времени'}

                            return (
                                <li key={task._originalIndex || index} className="suggested-task-item">
                                    <input
                                        type="checkbox"
                                        checked={selectedTaskIndices.includes(index)}
                                        onChange={() => handleTaskSelectionChange(index)}
                                        id={`suggested-task-${index}`}
                                    />
                                    <div className="task-content-wrapper">
                                        <label htmlFor={`suggested-task-${index}`} className="task-label-clickable"> {/* Оборачиваем в label для кликабельности */}
                                            <strong className="task-title-ai">{task.title}</strong>
                                        </label>
                                        <div className="task-details-ai">
                                            {category && <span className="task-category-ai" style={{backgroundColor: category.color}}>{category.name}</span>}
                                            {!category && task.categoryGuess && <span className="task-category-ai guess">({task.categoryGuess}?)</span>}
                                            {displayTime && <span className="task-time-ai">{displayTime}</span>}
                                            {task.location && <span className="task-location-ai">{task.location}</span>}
                                        </div>
                                        {task.description && <p className="task-desc-ai">{task.description}</p>}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                    <button
                        onClick={handleAddSelectedTasks}
                        disabled={selectedTaskIndices.length === 0}
                        className="button primary add-selected-button"
                    >
                        Добавить выбранные ({selectedTaskIndices.length})
                    </button>
                </div>
            )}
            {!isLoading && suggestedTasks.length === 0 && aiResponseText && !error && (
                <p>AI ответил, но не удалось распознать задачи в его тексте. Попробуйте переформулировать запрос.</p>
            )}
        </div>
    );
};

export default AiAssistant;