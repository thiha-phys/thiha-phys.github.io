const grade = document.getElementById('grade');
const category = document.getElementById('category');
const chapter = document.getElementById('chapter');
const records = document.getElementById('records');
const message = document.getElementById('message');
const editor = document.getElementById('editor');
const contentFields = document.getElementById('content-fields');
const titleLabel = document.getElementById('title-label');
const chapterCounts = {
    10: { objectives: 11, calculations: 11, definitions: 11 },
    11: { objectives: 12, calculations: 12, definitions: 12 },
    12: { objectives: 13, calculations: 13, short_questions: 13, definitions: 13, old_questions: 13 }
};
let editingRow = null;
let initialContentFields = {};

function setMessage(text, isError = false) {
    message.textContent = text;
    message.style.color = isError ? '#b42336' : '#63738c';
}

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function makeField(labelText, value = '', options = {}) {
    const label = element('label', 'content-field', labelText);
    const control = element(options.multiline ? 'textarea' : 'input');
    if (!options.multiline) control.type = options.type || 'text';
    if (options.rows) control.rows = options.rows;
    if (options.placeholder) control.placeholder = options.placeholder;
    if (options.step) control.step = options.step;
    if (options.min !== undefined) control.min = options.min;
    if (options.max !== undefined) control.max = options.max;
    if (options.required) control.required = true;
    if (options.field) control.dataset.field = options.field;
    control.value = value ?? '';
    label.append(control);
    return label;
}

function makeSelect(labelText, choices, selected, field) {
    const label = element('label', 'content-field', labelText);
    const select = element('select');
    if (field) select.dataset.field = field;
    choices.forEach(([value, text]) => {
        const option = element('option', '', text);
        option.value = value;
        select.append(option);
    });
    select.value = selected;
    label.append(select);
    return label;
}

function makeCheckbox(labelText, checked, field) {
    const label = element('label', 'content-field');
    const input = element('input');
    input.type = 'checkbox';
    input.checked = Boolean(checked);
    input.dataset.field = field;
    label.append(input, document.createTextNode(labelText));
    return label;
}

function getField(field) {
    return contentFields.querySelector(`[data-field="${field}"]`);
}

function paragraphsToText(paragraphs) {
    if (typeof paragraphs === 'string') return paragraphs;
    if (!Array.isArray(paragraphs)) return '';
    return paragraphs.map((paragraph) => {
        const parts = typeof paragraph === 'string' ? [{ text: paragraph }]
            : Array.isArray(paragraph) ? paragraph : [paragraph];
        return parts.map((part) => part?.text ?? part?.plain ?? '').join('');
    }).join('\n');
}

function textToParagraphs(text) {
    return text.split(/\r?\n/).map((line) => [{ text: line }]);
}

function splitDefinitionLanguages(paragraphs) {
    let english = '';
    let myanmar = '';
    const append = (value) => {
        String(value).split(/([\u1000-\u109f]+)/).forEach((part) => {
            if (!part) return;
            if (/^[\u1000-\u109f]+$/.test(part)) myanmar += part;
            else english += part;
        });
    };
    (Array.isArray(paragraphs) ? paragraphs : []).forEach((paragraph) => {
        const parts = Array.isArray(paragraph) ? paragraph : [paragraph];
        parts.forEach((part) => append(part?.text ?? part?.plain ?? ''));
        english += '\n';
        myanmar += '\n';
    });
    return { english: english.trim(), myanmar: myanmar.trim() };
}

function getObjectiveKind(content = {}) {
    return ['trueFalse', 'fillBlank', 'multipleChoice'].includes(content.section)
        ? content.section
        : 'trueFalse';
}

function addObjectiveFields(kind, content = {}) {
    const question = makeField('Question', content.text || '', {
        field: 'objective-question', multiline: true, rows: 3, required: true
    });
    contentFields.append(question);
    if (kind === 'trueFalse') {
        contentFields.append(makeSelect('Answer', [['true', 'True'], ['false', 'False']],
            String(content.answer === true), 'objective-answer'));
        return;
    }
    if (kind === 'fillBlank') {
        const answers = Array.isArray(content.answer) ? content.answer.join('\n')
            : content.answer == null ? '' : String(content.answer);
        contentFields.append(makeField('Answer (one accepted answer per line)', answers, {
            field: 'objective-answer', multiline: true, rows: 3, required: true
        }));
        return;
    }
    const options = Array.isArray(content.options) ? content.options.join('\n') : '';
    const correct = Array.isArray(content.options) ? content.options[content.correct] || '' : '';
    contentFields.append(makeField('Options (one option per line)', options, {
        field: 'objective-options', multiline: true, rows: 4, required: true
    }));
    contentFields.append(makeField('Correct option', correct, {
        field: 'objective-answer', required: true
    }));
    const hint = element('p', 'field-note', 'Correct option သည် Options ထဲရှိ စာသားတစ်ခုနှင့် တိတိကျကျ တူရပါမည်။');
    contentFields.append(hint);
}

function addSolutionLine(value = '') {
    const line = element('div', 'line-row');
    const input = element('input');
    input.type = 'text';
    input.value = value;
    input.placeholder = `Solution line ${contentFields.querySelectorAll('[data-solution-line]').length + 1}`;
    input.dataset.solutionLine = 'true';
    const remove = element('button', 'secondary', 'Remove');
    remove.type = 'button';
    remove.addEventListener('click', () => line.remove());
    line.append(input, remove);
    return line;
}

function htmlToLines(html, selector) {
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    const selected = template.content.querySelector(selector);
    if (!selected) return '';
    selected.querySelectorAll('br').forEach((node) => node.replaceWith('\n'));
    selected.querySelectorAll('p,div,li').forEach((node) => node.append('\n'));
    return (selected.textContent || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join('\n');
}

function calculationFields(content, row) {
    let question = content.question || '';
    let solution = Array.isArray(content.solution) ? content.solution
        : content.solution == null ? [] : String(content.solution).split(/\r?\n/);
    if (content.html) {
        question ||= htmlToLines(content.html, '.problem-question, .problem-content > p, .problem-card p');
        if (!solution.length) {
            const answer = htmlToLines(content.html, '.problem-answer, .problem-content details > div');
            solution = answer ? answer.split('\n') : [];
        }
    }
    question ||= row?.title || '';
    const questionField = makeField('Question', question, {
        field: 'calculation-question', multiline: true, rows: 3, required: true
    });
    const solutionLabel = element('div', 'solution-editor');
    const heading = element('strong', '', 'Solution steps');
    const lines = element('div', 'solution-lines');
    (solution.length ? solution : ['']).forEach((line) => lines.append(addSolutionLine(line)));
    const add = element('button', 'secondary', 'Add line');
    add.type = 'button';
    add.addEventListener('click', () => lines.append(addSolutionLine()));
    solutionLabel.append(heading, lines, add);
    contentFields.append(questionField, solutionLabel);
}

function addQuestionGroup(groupsHost, key, questions = []) {
    const group = element('section', 'question-group');
    const heading = element('h4', '', 'Question group');
    const keyField = makeField('Group ID', key, { field: 'group-key' });
    const rows = element('div', 'question-rows');
    const addRow = (question = {}) => {
        const row = element('div', 'question-row');
        row.append(
            makeField('Number', question.number ?? '', { field: 'question-number' }),
            makeField('Question', question.text ?? '', { field: 'question-text', multiline: true, rows: 2 }),
            makeField('Source', question.source ?? '', { field: 'question-source' })
        );
        const remove = element('button', 'secondary', 'Remove');
        remove.type = 'button';
        remove.addEventListener('click', () => row.remove());
        row.append(remove);
        rows.append(row);
    };
    questions.forEach(addRow);
    const actions = element('div', 'field-actions');
    const addQuestion = element('button', 'secondary', 'Add question');
    addQuestion.type = 'button';
    addQuestion.addEventListener('click', () => addRow());
    const removeGroup = element('button', 'delete-btn', 'Remove group');
    removeGroup.type = 'button';
    removeGroup.addEventListener('click', () => group.remove());
    actions.append(addQuestion, removeGroup);
    group.append(heading, keyField, rows, actions);
    groupsHost.append(group);
}

function addQuestionGroups(sectionName, groups) {
    const section = element('section', 'question-groups');
    section.dataset.questionSection = sectionName;
    section.append(element('h3', '', sectionName === 'sectionA' ? 'Section A' : 'Section B'));
    const list = element('div', 'question-group-list');
    Object.entries(groups || {}).forEach(([key, questions]) => addQuestionGroup(list, key, questions));
    const addGroup = element('button', 'secondary', 'Add question group');
    addGroup.type = 'button';
    addGroup.addEventListener('click', () => addQuestionGroup(list, '', []));
    section.append(list, addGroup);
    contentFields.append(section);
}

function renderOldQuestionFields(content, row, mode) {
    if (mode === 'html') {
        contentFields.append(
            element('p', 'field-note', 'ဤမှတ်တမ်းသည် legacy HTML paper ဖြစ်သည်။ HTML အပိုင်းကိုသာ တည်းဖြတ်နိုင်ပါသည်။'),
            makeField('Paper content (HTML)', content.html || '', {
                field: 'oq-html', multiline: true, rows: 12, required: true
            })
        );
        return;
    }
    const isPaper = mode === 'paper';
    const paper = isPaper ? (content.paper || {}) : content;
    const sectionA = paper.sectionA || (isPaper ? { '1': [], '2': [], '3': [] } : { A1: [], A2: [], A3: [] });
    const defaultSectionB = isPaper
        ? Object.fromEntries(['4a', '4b', '5a', '5b', '6a', '6b', '7a', '7b', '8a', '8b', '9a', '9b'].map((key) => [key, []]))
        : Object.fromEntries(['B4a', 'B4b', 'B5a', 'B5b', 'B6a', 'B6b', 'B7a', 'B7b', 'B8a', 'B8b', 'B9a', 'B9b'].map((key) => [key, []]));
    const sectionB = paper.sectionB || defaultSectionB;
    if (isPaper) {
        const selectedChapter = row?.chapter || document.getElementById('edit-chapter').value;
        const year = paper.year || Number(selectedChapter.match(/\d{4}/)?.[0]) || 2026;
        const set = paper.set || Number(selectedChapter.match(/(\d+)$/)?.[1]) || 1;
        const details = element('div', 'form-grid');
        const yearField = makeField('Paper year', year, { field: 'oq-year', type: 'number', min: 2000, max: 2100, required: true });
        const setField = makeField('Set number', set, { field: 'oq-set', type: 'number', min: 1, required: true });
        const sampleField = makeCheckbox('Sample question', paper.sample || /SQ/i.test(selectedChapter), 'oq-sample');
        const foreignField = makeCheckbox('Foreign paper', paper.foreign, 'oq-foreign');
        const updatePaperChapter = () => {
            const label = getField('oq-sample').checked
                ? `Set ${getField('oq-year').value} · SQ`
                : `Set ${getField('oq-year').value} · ${getField('oq-set').value}`;
            document.getElementById('edit-chapter').value = label;
        };
        yearField.querySelector('input').addEventListener('input', updatePaperChapter);
        setField.querySelector('input').addEventListener('input', updatePaperChapter);
        sampleField.querySelector('input').addEventListener('change', updatePaperChapter);
        details.append(
            yearField,
            setField,
            sampleField,
            foreignField
        );
        contentFields.append(details);
        if (!row?.chapter || !/^Set\s/i.test(row.chapter)) updatePaperChapter();
    } else {
        const selectedChapter = row?.chapter || document.getElementById('edit-chapter').value;
        const chapterNumber = content.chapter || Number(selectedChapter) || 1;
        const chapterField = makeField('Chapter number', chapterNumber, {
            field: 'oq-chapter', type: 'number', min: 1, required: true
        });
        chapterField.querySelector('input').addEventListener('change', (event) => {
            document.getElementById('edit-chapter').value = event.target.value;
        });
        contentFields.append(chapterField);
    }
    addQuestionGroups('sectionA', sectionA);
    addQuestionGroups('sectionB', sectionB);
}

function buildContentFields(row = {}) {
    contentFields.replaceChildren();
    const type = row.category || category.value;
    const content = row.content && typeof row.content === 'object' ? row.content : {};
    initialContentFields = {};
    titleLabel.textContent = type === 'definitions' ? 'Definition title' : 'Record title';

    if (type === 'definitions') {
        const languages = splitDefinitionLanguages(content.paragraphs);
        const title = content.title || row.title || '';
        contentFields.append(
            makeField('English definition', languages.english, {
                field: 'definition-english', multiline: true, rows: 4
            }),
            makeField('Myanmar definition', languages.myanmar, {
                field: 'definition-myanmar', multiline: true, rows: 4
            })
        );
        initialContentFields = {
            english: languages.english,
            myanmar: languages.myanmar
        };
        document.getElementById('edit-title').value = title;
        return;
    }
    if (type === 'objectives') {
        const kind = getObjectiveKind(content);
        const selector = makeSelect('Objective type', [
            ['trueFalse', 'True / False'],
            ['fillBlank', 'Fill in the blank'],
            ['multipleChoice', 'Multiple choice']
        ], kind, 'objective-kind');
        selector.querySelector('select').addEventListener('change', () => {
            contentFields.replaceChildren(selector);
            addObjectiveFields(getField('objective-kind').value);
        });
        contentFields.append(selector);
        addObjectiveFields(kind, content);
        return;
    }
    if (type === 'short_questions') {
        const question = paragraphsToText(content.question);
        const answer = paragraphsToText(content.answer);
        contentFields.append(
            makeField('Question', question, { field: 'short-question', multiline: true, rows: 4, required: true }),
            makeField('Answer', answer, { field: 'short-answer', multiline: true, rows: 4 })
        );
        initialContentFields = { question, answer };
        return;
    }
    if (type === 'calculations') {
        calculationFields(content, row);
        initialContentFields = {
            question: getField('calculation-question')?.value || '',
            solution: [...contentFields.querySelectorAll('[data-solution-line]')].map((line) => line.value).join('\n')
        };
        return;
    }
    if (type === 'old_questions') {
        const selectedChapter = row.chapter || chapter.value || '';
        const inferredMode = content.paper ? 'paper' : content.chapter != null ? 'chapter'
            : content.html ? 'html' : /^Set\s/i.test(selectedChapter) ? 'paper' : 'chapter';
        const modeSelector = makeSelect('OQ format', [
            ['chapter', 'Chapter question groups'],
            ['paper', 'Exam paper'],
            ...(content.html && !content.paper ? [['html', 'Legacy HTML paper']] : [])
        ], inferredMode, 'oq-mode');
        if (content.paper || content.chapter != null) modeSelector.querySelector('select').disabled = true;
        const renderMode = (mode) => {
            contentFields.replaceChildren(modeSelector);
            renderOldQuestionFields(content, row, mode);
        };
        modeSelector.querySelector('select').addEventListener('change', (event) => renderMode(event.target.value));
        renderMode(inferredMode);
        return;
    }
    if (type === 'one_mark') {
        contentFields.append(
            makeField('Question', content.question || content.text || '', {
                field: 'one-mark-question', multiline: true, rows: 3, required: true
            }),
            makeField('Answer', content.answer || '', { field: 'one-mark-answer', multiline: true, rows: 3 })
        );
    }
}

function rebuildChapters() {
    const count = chapterCounts[grade.value]?.[category.value] || 0;
    chapter.replaceChildren();
    const all = element('option', '', 'All chapters / sets');
    all.value = '';
    chapter.append(all);
    for (let i = 1; i <= count; i += 1) {
        const option = element('option', '', `Chapter ${i}`);
        option.value = String(i);
        chapter.append(option);
    }
    if (category.value === 'old_questions' && grade.value === '12') {
        const labels = [
            'Set 2024 · SQ',
            ...Array.from({ length: 7 }, (_, index) => `Set 2024 · ${index + 1}`),
            ...Array.from({ length: 12 }, (_, index) => `Set 2025 · ${index + 1}`),
            ...Array.from({ length: 3 }, (_, index) => `Set 2026 · ${index + 1}`)
        ];
        labels.forEach((label) => {
            const option = element('option', '', label);
            option.value = label;
            chapter.append(option);
        });
    }
}

function showEditor(row = {}) {
    editingRow = row;
    document.getElementById('record-id').value = row.id || '';
    document.getElementById('edit-grade').value = row.grade || grade.value;
    document.getElementById('edit-category').value = row.category || category.value;
    document.getElementById('edit-chapter').value = row.chapter || chapter.value || 'Chapter 1';
    document.getElementById('edit-title').value = row.title || '';
    document.getElementById('edit-order').value = row.sortOrder ?? 0;
    document.getElementById('edit-active').value = String(row.active !== false);
    buildContentFields(row);
    editor.hidden = false;
    editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderRows(rows) {
    records.replaceChildren();
    document.getElementById('count').textContent = `${rows.length} records`;
    if (!rows.length) {
        records.append(element('div', 'empty', 'No content found for this selection.'));
        return;
    }
    rows.forEach((row) => {
        const card = element('article', 'record');
        const top = element('div', 'record-top');
        const info = element('div');
        info.append(
            element('h3', '', row.title),
            element('p', '', `Grade ${row.grade} · ${row.category.replaceAll('_', ' ')} · ${row.chapter}${row.active === false ? ' · Hidden' : ''}`)
        );
        const actions = element('div', 'record-actions');
        const edit = element('button', 'edit-btn', 'Edit');
        edit.type = 'button';
        edit.addEventListener('click', () => showEditor(row));
        const remove = element('button', 'delete-btn', 'Delete');
        remove.type = 'button';
        remove.addEventListener('click', async () => {
            if (!confirm(`Delete “${row.title}”?`)) return;
            try {
                await AdminApi.deleteEducationalContent(row.id);
                await load();
                setMessage('Deleted.');
            } catch (error) {
                setMessage(error.message, true);
            }
        });
        actions.append(edit, remove);
        top.append(info, actions);
        card.append(top);
        records.append(card);
    });
}

async function load() {
    setMessage('Loading…');
    records.replaceChildren();
    try {
        const rows = await AdminApi.getEducationalContent({
            grade: grade.value,
            category: category.value,
            ...(chapter.value ? { chapter: chapter.value } : {})
        });
        renderRows(rows);
        setMessage('Loaded from database.');
    } catch (error) {
        setMessage(error.message, true);
    }
}

function collectQuestionGroups(sectionName) {
    const section = contentFields.querySelector(`[data-question-section="${sectionName}"]`);
    const groups = {};
    section?.querySelectorAll('.question-group').forEach((group) => {
        const key = group.querySelector('[data-field="group-key"]').value.trim();
        if (!key) throw new Error('Question group ID ဖြည့်ပါ။');
        if (Object.hasOwn(groups, key)) throw new Error(`Question group ID ထပ်နေသည်: ${key}`);
        const questions = [];
        group.querySelectorAll('.question-row').forEach((row) => {
            const number = row.querySelector('[data-field="question-number"]').value.trim();
            const text = row.querySelector('[data-field="question-text"]').value.trim();
            const source = row.querySelector('[data-field="question-source"]').value.trim();
            if (!text) throw new Error(`${key} group အတွင်း မေးခွန်းစာသား မဖြည့်ရသေးပါ။`);
            const question = { text };
            if (number) question.number = /^\d+$/.test(number) ? Number(number) : number;
            if (source) question.source = source;
            questions.push(question);
        });
        groups[key] = questions;
    });
    return groups;
}

function createContent() {
    const type = document.getElementById('edit-category').value;
    const content = { ...(editingRow?.content || {}) };
    if (type === 'definitions') {
        const title = document.getElementById('edit-title').value.trim();
        content.title = title;
        const english = getField('definition-english').value;
        const myanmar = getField('definition-myanmar').value;
        if (!english.trim() && !myanmar.trim()) throw new Error('English သို့မဟုတ် Myanmar အဓိပ္ပာယ် အနည်းဆုံးတစ်ခု ဖြည့်ပါ။');
        if (english !== initialContentFields.english || myanmar !== initialContentFields.myanmar) {
            content.paragraphs = [
                ...textToParagraphs(english),
                ...textToParagraphs(myanmar)
            ].filter((paragraph) => paragraph[0].text !== '');
        }
        return content;
    }
    if (type === 'objectives') {
        const kind = getField('objective-kind').value;
        const question = getField('objective-question').value.trim();
        if (!question) throw new Error('မေးခွန်းစာသား ဖြည့်ပါ။');
        const result = {
            ...content,
            section: kind,
            number: Number(content.number ?? 1),
            text: question
        };
        if (kind === 'trueFalse') {
            result.answer = getField('objective-answer').value === 'true';
            delete result.options;
            delete result.correct;
        } else if (kind === 'fillBlank') {
            const answers = getField('objective-answer').value.split(/\r?\n/).map((answer) => answer.trim()).filter(Boolean);
            if (!answers.length) throw new Error('အဖြေ အနည်းဆုံးတစ်ခု ထည့်ပါ။');
            result.answer = answers;
            delete result.options;
            delete result.correct;
        } else {
            const options = getField('objective-options').value.split(/\r?\n/).map((option) => option.trim()).filter(Boolean);
            const answer = getField('objective-answer').value.trim();
            if (options.length < 2) throw new Error('ရွေးချယ်စရာ အနည်းဆုံး ၂ ခု ထည့်ပါ။');
            const correct = options.indexOf(answer);
            if (correct < 0) throw new Error('မှန်ကန်သောအဖြေသည် ရွေးချယ်စရာများထဲမှ တစ်ခုဖြစ်ရပါမည်။');
            result.options = options;
            result.correct = correct;
            delete result.answer;
        }
        return result;
    }
    if (type === 'short_questions') {
        const question = getField('short-question').value;
        const answer = getField('short-answer').value;
        if (!question.trim()) throw new Error('မေးခွန်းစာသား ဖြည့်ပါ။');
        if (question !== initialContentFields.question || !Array.isArray(content.question)) {
            content.question = textToParagraphs(question);
        }
        if (answer !== initialContentFields.answer || !Array.isArray(content.answer)) {
            content.answer = answer.trim() ? textToParagraphs(answer) : [];
        }
        content.label = content.label || document.getElementById('edit-title').value.trim();
        return content;
    }
    if (type === 'calculations') {
        const question = getField('calculation-question').value.trim();
        if (!question) throw new Error('မေးခွန်းစာသား ဖြည့်ပါ။');
        const solution = [...contentFields.querySelectorAll('[data-solution-line]')]
            .map((line) => line.value.trim()).filter(Boolean);
        const currentSolution = solution.join('\n');
        if (question !== initialContentFields.question || currentSolution !== initialContentFields.solution) {
            delete content.html;
            content.question = question;
            content.solution = solution;
        }
        return content;
    }
    if (type === 'old_questions') {
        const mode = getField('oq-mode').value;
        if (mode === 'html') return { ...content, html: getField('oq-html').value };
        const sectionA = collectQuestionGroups('sectionA');
        const sectionB = collectQuestionGroups('sectionB');
        if (mode === 'chapter') {
            delete content.paper;
            content.chapter = Number(getField('oq-chapter').value);
            content.sectionA = sectionA;
            content.sectionB = sectionB;
            return content;
        }
        const oldPaper = content.paper || {};
        const year = Number(getField('oq-year').value);
        const set = Number(getField('oq-set').value);
        const sample = getField('oq-sample').checked;
        const foreign = getField('oq-foreign').checked;
        const key = `${year}-${sample ? 'sample' : `set${set}`}`;
        content.paper = { ...oldPaper, key, year, set, sample, foreign, sectionA, sectionB };
        return content;
    }
    if (type === 'one_mark') {
        content.question = getField('one-mark-question').value.trim();
        content.answer = getField('one-mark-answer').value.trim();
    }
    return content;
}

grade.addEventListener('change', () => { rebuildChapters(); load(); });
category.addEventListener('change', () => { rebuildChapters(); load(); });
chapter.addEventListener('change', load);
document.getElementById('add').addEventListener('click', () => showEditor());
document.getElementById('cancel').addEventListener('click', () => { editor.hidden = true; });
editor.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
        const content = createContent();
        await AdminApi.saveEducationalContent({
            id: document.getElementById('record-id').value || undefined,
            grade: Number(document.getElementById('edit-grade').value),
            category: document.getElementById('edit-category').value,
            chapter: document.getElementById('edit-chapter').value.trim(),
            title: document.getElementById('edit-title').value.trim(),
            sortOrder: Number(document.getElementById('edit-order').value || 0),
            active: document.getElementById('edit-active').value === 'true',
            content
        });
        editor.hidden = true;
        await load();
        setMessage('Saved to database.');
    } catch (error) {
        setMessage(error.message || 'Content could not be saved.', true);
    }
});

rebuildChapters();
load();
