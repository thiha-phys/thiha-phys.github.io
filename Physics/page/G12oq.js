const chapterTitles = [
    'Rotational Motion',
    'Forces in Circular Motion',
    'Fluid Dynamics',
    'Sources of Energy and Environmental Impacts',
    'Heat Transfer and Thermodynamics',
    'Effects and Characteristics of Sound',
    'Applications of Light and Optical Instruments',
    'Interference and Diffraction of Light',
    'Capacitor and Capacitance',
    'Electrical Energy, Power and Heating Effect of Electric Current',
    'Electromagnetic Induction, Generation and Distribution of Electricity',
    'Digital Electronics and Communication System',
    'Modern Physics'
];

function paperLabel(paper) {
    if (paper.sample) return `${paper.year} Sample Question`;
    return `${paper.year} Set ${paper.set}${paper.foreign ? ' (Foreign)' : ''}`;
}

function paperFileName(paper) {
    return `G12oq${String(paper.year).slice(-2)}${paper.sample ? 'Sq' : `Set${paper.set}`}.html`;
}

function paperFileNameFromSource(source) {
    const match = source.match(/^(\d{4})\s+\((SQ|Set\s+(\d+))\)$/i);
    if (!match) return null;

    const year = match[1].slice(-2);
    const paper = match[2].toUpperCase() === 'SQ' ? 'Sq' : `Set${match[3]}`;
    return `G12oq${year}${paper}.html`;
}

const chapterNav = document.getElementById('oq-chapter-nav');
if (chapterNav) {
    chapterTitles.forEach((title, index) => {
        const chapterNumber = index + 1;
        const link = document.createElement('a');
        link.className = 'oq-chapter-link';
        link.href = `G12oqCh${chapterNumber}.html`;
        if (Number(document.body.dataset.chapter) === chapterNumber) {
            link.classList.add('is-current');
            link.setAttribute('aria-current', 'page');
        }

        const number = document.createElement('span');
        number.className = 'oq-chapter-number';
        number.textContent = String(chapterNumber).padStart(2, '0');
        const label = document.createElement('span');
        label.textContent = `Chapter ${chapterNumber}`;
        link.append(number, label);
        chapterNav.append(link);
    });
}

const mode = document.body.dataset.mode;
if (mode === 'chapter-index') {
    document.title = 'Grade 12 Old Questions by Chapter | Physics Learning Hub';
} else if (mode === 'paper-index') {
    document.title = 'Grade 12 Old Questions by Paper | Physics Learning Hub';
    const paperNav = document.getElementById('oq-paper-nav');
    const papers = window.G12_QUESTION_PAPERS;
    if (!Array.isArray(papers)) {
        throw new Error('Old-question paper data is missing.');
    }

    papers.forEach((paper) => {
        let yearSection = paperNav.querySelector(`[data-year="${paper.year}"]`);
        if (!yearSection) {
            yearSection = document.createElement('section');
            yearSection.className = 'oq-paper-year';
            yearSection.dataset.year = String(paper.year);
            const yearHeading = document.createElement('h3');
            yearHeading.textContent = String(paper.year);
            const paperGrid = document.createElement('div');
            paperGrid.className = 'oq-paper-grid';
            yearSection.append(yearHeading, paperGrid);
            paperNav.append(yearSection);
        }

        const link = document.createElement('a');
        link.className = 'oq-paper-link';
        link.href = paperFileName(paper);
        const icon = document.createElement('i');
        icon.className = 'fa-regular fa-file-lines';
        icon.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.textContent = paperLabel(paper);
        link.append(icon, label);
        yearSection.querySelector('.oq-paper-grid').append(link);
    });
} else {
    const chapterNumber = Number(document.body.dataset.chapter);
    if (chapterNumber) {
        const chapter = window.G12_OLD_QUESTIONS && window.G12_OLD_QUESTIONS[chapterNumber - 1];
        if (!chapter || chapter.chapter !== chapterNumber) {
            throw new Error(`Old-question data is missing for Grade 12 Chapter ${chapterNumber}.`);
        }

        document.title = `Grade 12 Chapter ${chapterNumber} Old Questions | Physics Learning Hub`;
        const intro = document.querySelector('.oq-intro');
        intro.className = 'oq-chapter-heading';
        intro.replaceChildren();
        const title = document.createElement('h2');
        title.textContent = `Chapter ${chapterNumber} - ${chapterTitles[chapterNumber - 1]}`;
        intro.append(title);

        const sectionTabs = document.createElement('div');
        sectionTabs.className = 'oq-section-tabs';
        const sectionPanel = document.createElement('div');
        const questionList = document.createElement('div');
        questionList.className = 'oq-question-list';
        questionList.setAttribute('aria-live', 'polite');
        const prompt = document.createElement('p');
        prompt.className = 'oq-empty-state';
        prompt.textContent = 'မေးခွန်းများကြည့်ရန် Section A သို့မဟုတ် Section B ကို ရွေးပါ။';
        questionList.append(prompt);

        const sectionAButton = document.createElement('button');
        sectionAButton.className = 'oq-section-button';
        sectionAButton.type = 'button';
        sectionAButton.textContent = 'Section A';
        sectionAButton.setAttribute('aria-expanded', 'false');
        const sectionBButton = document.createElement('button');
        sectionBButton.className = 'oq-section-button';
        sectionBButton.type = 'button';
        sectionBButton.textContent = 'Section B';
        sectionBButton.setAttribute('aria-expanded', 'false');
        sectionTabs.append(sectionAButton, sectionBButton);

        const groupTabs = document.createElement('div');
        groupTabs.className = 'oq-group-tabs';
        groupTabs.hidden = true;
        sectionPanel.append(groupTabs, questionList);
        const content = document.getElementById('oq-chapter-content');
        content.replaceChildren(sectionTabs, sectionPanel);

        const sectionLabels = [
            { id: 'A1', label: 'No. 1 · True / False' },
            { id: 'A2', label: 'No. 2 · Blank' },
            { id: 'A3', label: 'No. 3 · Multiple Choice' }
        ];

        function renderQuestions(questions, label) {
            questionList.replaceChildren();
            if (!questions.length) {
                const empty = document.createElement('p');
                empty.className = 'oq-empty-state';
                empty.textContent = `ဤအခန်းအတွက် ${label} မေးခွန်း မပါရှိပါ။`;
                questionList.append(empty);
                return;
            }

            questions.forEach((question) => {
                const card = document.createElement('article');
                card.className = 'oq-question-card';
                const heading = document.createElement('h3');
                heading.className = 'oq-question-heading';
                const number = document.createElement('span');
                number.className = 'oq-question-number';
                number.textContent = `No. ${question.number}`;
                heading.append(number);
                if (question.source) {
                    const sourceHref = paperFileNameFromSource(question.source);
                    const source = document.createElement(sourceHref ? 'a' : 'span');
                    source.className = 'oq-source-tag';
                    source.textContent = question.source;
                    if (sourceHref) {
                        source.href = sourceHref;
                        source.setAttribute('aria-label', `${question.source} မေးခွန်းလွှာသို့ သွားရန်`);
                    }
                    heading.append(source);
                }

                const text = document.createElement('p');
                text.className = 'oq-question-text';
                text.textContent = question.text;
                card.append(heading, text);
                questionList.append(card);
            });
        }

        function selectSection(section) {
            const isA = section === 'A';
            sectionAButton.setAttribute('aria-expanded', String(isA));
            sectionBButton.setAttribute('aria-expanded', String(!isA));
            groupTabs.replaceChildren();
            groupTabs.hidden = false;

            const groups = isA
                ? sectionLabels.map((entry) => ({ ...entry, questions: chapter.sectionA[entry.id] || [] }))
                : Object.keys(chapter.sectionB).map((id) => ({
                    id,
                    label: id.slice(1).replace(/([ab])$/i, '($1)'),
                    questions: chapter.sectionB[id]
                }));

            groups.forEach((group) => {
                const button = document.createElement('button');
                button.className = 'oq-group-button';
                button.type = 'button';
                button.textContent = group.label;
                button.setAttribute('aria-pressed', 'false');
                button.addEventListener('click', () => {
                    groupTabs.querySelectorAll('.oq-group-button').forEach((item) => {
                        item.setAttribute('aria-pressed', String(item === button));
                    });
                    renderQuestions(group.questions, group.label);
                });
                groupTabs.append(button);
            });

            const firstGroup = groupTabs.querySelector('.oq-group-button');
            if (firstGroup) firstGroup.click();
            else renderQuestions([], isA ? 'Section A' : 'Section B');
        }

        sectionAButton.addEventListener('click', () => selectSection('A'));
        sectionBButton.addEventListener('click', () => selectSection('B'));
    } else if (document.body.dataset.paperKey) {
        const papers = window.G12_QUESTION_PAPERS;
        const paper = Array.isArray(papers)
            ? papers.find((item) => item.key === document.body.dataset.paperKey)
            : null;
        if (!paper) {
            throw new Error(`Old-question data is missing for paper ${document.body.dataset.paperKey}.`);
        }

        const label = paperLabel(paper);
        document.title = `${label} | Grade 12 Physics`;
        const intro = document.querySelector('.oq-intro');
        intro.className = 'oq-chapter-heading';
        intro.replaceChildren();
        const title = document.createElement('h2');
        title.textContent = label;
        intro.append(title);

        const sectionTabs = document.createElement('div');
        sectionTabs.className = 'oq-section-tabs';
        const sectionAButton = document.createElement('button');
        sectionAButton.className = 'oq-section-button';
        sectionAButton.type = 'button';
        sectionAButton.textContent = 'Section A';
        sectionAButton.setAttribute('aria-expanded', 'false');
        const sectionBButton = document.createElement('button');
        sectionBButton.className = 'oq-section-button';
        sectionBButton.type = 'button';
        sectionBButton.textContent = 'Section B';
        sectionBButton.setAttribute('aria-expanded', 'false');
        sectionTabs.append(sectionAButton, sectionBButton);

        const groupTabs = document.createElement('div');
        groupTabs.className = 'oq-group-tabs';
        groupTabs.hidden = true;
        const questionList = document.createElement('div');
        questionList.className = 'oq-question-list';
        questionList.setAttribute('aria-live', 'polite');
        const content = document.getElementById('oq-paper-content');
        content.replaceChildren(sectionTabs, groupTabs, questionList);

        function appendQuestion(container, question, number = '') {
            const card = document.createElement('article');
            card.className = 'oq-question-card';
            const text = document.createElement('p');
            text.className = 'oq-question-text';
            text.textContent = question.text;
            if (number) {
                const heading = document.createElement('h3');
                heading.className = 'oq-question-heading';
                const numberLabel = document.createElement('span');
                numberLabel.className = 'oq-question-number';
                numberLabel.textContent = number;
                heading.append(numberLabel);
                card.append(heading);
            }
            card.append(text);
            container.append(card);
        }

        function selectSection(section) {
            const isA = section === 'A';
            sectionAButton.setAttribute('aria-expanded', String(isA));
            sectionBButton.setAttribute('aria-expanded', String(!isA));
            groupTabs.replaceChildren();
            questionList.replaceChildren();
            groupTabs.hidden = !isA;

            if (isA) {
                const categories = [
                    { id: '1', label: 'No. 1 · True / False' },
                    { id: '2', label: 'No. 2 · Blank' },
                    { id: '3', label: 'No. 3 · Multiple Choice' }
                ];
                categories.forEach((category) => {
                    const button = document.createElement('button');
                    button.className = 'oq-group-button';
                    button.type = 'button';
                    button.textContent = category.label;
                    button.setAttribute('aria-pressed', 'false');
                    button.addEventListener('click', () => {
                        groupTabs.querySelectorAll('.oq-group-button').forEach((item) => {
                            item.setAttribute('aria-pressed', String(item === button));
                        });
                        questionList.replaceChildren();
                        paper.sectionA[category.id].forEach((question, index) => {
                            appendQuestion(questionList, question, `(${question.number || index + 1})`);
                        });
                    });
                    groupTabs.append(button);
                });
                groupTabs.querySelector('.oq-group-button')?.click();
                return;
            }

            Object.entries(paper.sectionB).forEach(([group, questions]) => {
                if (!questions.length) return;
                const section = document.createElement('section');
                section.className = 'oq-question-group';
                const heading = document.createElement('h3');
                heading.className = 'oq-question-group-title';
                heading.textContent = `No. ${group[0]} (${group[1]})`;
                section.append(heading);
                questions.forEach((question) => {
                    appendQuestion(section, question);
                });
                questionList.append(section);
            });
        }

        sectionAButton.addEventListener('click', () => selectSection('A'));
        sectionBButton.addEventListener('click', () => selectSection('B'));
    }
}
