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
const chapterNav = document.getElementById('oq-chapter-nav');

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

const chapterNumber = Number(document.body.dataset.chapter);
if (!chapterNumber) {
    document.title = 'Grade 12 Old Questions | Physics Learning Hub';
} else {
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

    const sectionA = chapter.sectionA;
    const sectionB = chapter.sectionB;
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
                const source = document.createElement('span');
                source.className = 'oq-source-tag';
                source.textContent = question.source;
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
            ? sectionLabels.map((entry) => ({ ...entry, questions: sectionA[entry.id] || [] }))
            : Object.keys(sectionB).map((id) => ({
                id,
                label: id.slice(1).replace(/([ab])$/i, '($1)'),
                questions: sectionB[id]
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
}
