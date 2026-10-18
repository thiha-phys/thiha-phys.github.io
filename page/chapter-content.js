const grade = document.body.dataset.grade;
const contentType = document.body.dataset.contentType;
const chapterNumber = Number(document.body.dataset.chapter || 0);
const chapterDataKey = `${grade}_${contentType === 'questions' ? 'SHORT_QUESTIONS' : 'DEFINITIONS'}`;
const chapters = window[chapterDataKey];

const chapterTitles = {
    G10: [
        'Units and Measurements', 'Motion', 'Forces', 'Pressure', 'Work and Energy',
        'Heat and Temperature', 'Wave and Sound', 'Light', 'Electricity', 'Magnetism',
        'Quantum and Atomic Physics'
    ],
    G12: [
        'Rotational Motion', 'Forces in Circular Motion', 'Fluid Dynamics',
        'Sources of Energy and Environmental Impacts', 'Heat Transfer and Thermodynamics',
        'Effects and Characteristics of Sound', 'Applications of Light and Optical Instruments',
        'Interference and Diffraction of Light', 'Capacitor and Capacitance',
        'Electrical Energy, Power and Heating Effect of electric Current',
        'Electromagnetic Induction, Generation and Distribution of Electricity',
        'Digital Electronics and Communication System', 'Modern Physics'
    ]
};
const titles = chapterTitles[grade];

if (!chapters || !titles || chapters.length !== titles.length) {
    throw new Error(`Chapter content is missing or incomplete for ${grade} ${contentType}.`);
}

function appendMyanmarText(container, text) {
    text.split(/([\u1000-\u109f]+)/).forEach((chunk) => {
        if (!chunk) {
            return;
        }
        if (/^[\u1000-\u109f]+$/.test(chunk)) {
            const myanmar = document.createElement('span');
            myanmar.className = 'myanmar-text';
            myanmar.textContent = chunk;
            container.append(myanmar);
        } else {
            container.append(document.createTextNode(chunk));
        }
    });
}

function appendParts(container, parts) {
    const segments = typeof parts === 'string' ? [{ text: parts }] : parts;
    segments.forEach((segment) => {
        if (segment.text !== undefined) {
            appendMyanmarText(container, segment.text);
            return;
        }
        if (segment.image) {
            const figure = document.createElement('figure');
            const image = document.createElement('img');
            image.src = segment.image;
            image.alt = segment.alt || 'သင်ခန်းစာပုံ';
            image.loading = 'lazy';
            figure.append(image);
            container.append(figure);
            return;
        }
        if (segment.math) {
            const equation = document.createElement('span');
            equation.className = 'chapter-math';
            equation.textContent = segment.plain;
            equation.dataset.tex = segment.tex;
            equation.dataset.plain = segment.plain;
            equation.setAttribute('aria-label', segment.plain);
            container.append(equation);
        }
    });
}

function appendParagraphs(container, paragraphs) {
    paragraphs.forEach((parts) => {
        const paragraph = document.createElement('p');
        appendParts(paragraph, parts);
        container.append(paragraph);
    });
}

function renderMath() {
    const equations = [...document.querySelectorAll('.chapter-math')];
    if (!equations.length) {
        return;
    }
    window.MathJax = {
        tex: { inlineMath: [['\\(', '\\)']] },
        startup: { typeset: false }
    };
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js';
    script.async = true;
    script.onload = () => {
        equations.forEach((equation) => {
            equation.textContent = `\\(${equation.dataset.tex}\\)`;
        });
        window.MathJax.typesetPromise(equations).catch((error) => {
            console.error('Unable to typeset the chapter equations.', error);
            equations.forEach((equation) => {
                equation.textContent = equation.dataset.plain;
            });
        });
    };
    script.onerror = (error) => {
        console.error('Unable to load the equation renderer for chapter content.', error);
    };
    document.head.append(script);
}

const chapterList = document.getElementById('chapter-content-list');
if (chapterList) {
    titles.forEach((title, index) => {
        const link = document.createElement('a');
        link.href = `${grade}${contentType === 'questions' ? 'sq' : 'def'}${index + 1}.html`;
        const number = document.createElement('span');
        number.className = 'chapter-content-number';
        number.textContent = String(index + 1).padStart(2, '0');
        const label = document.createElement('span');
        label.textContent = title;
        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-chevron-right';
        icon.setAttribute('aria-hidden', 'true');
        link.append(number, label, icon);
        chapterList.append(link);
    });
} else {
    const chapter = chapters[chapterNumber - 1];
    if (!chapter || chapterNumber < 1 || chapterNumber > titles.length) {
        throw new Error(`Invalid ${grade} ${contentType} chapter: ${chapterNumber}`);
    }

    document.title = `Chapter ${chapterNumber}: ${titles[chapterNumber - 1]} | ${grade} Physics`;
    document.getElementById('chapter-content-label').textContent = `CHAPTER ${chapterNumber}`;
    document.getElementById('chapter-content-title').textContent = titles[chapterNumber - 1];
    const cards = document.getElementById('chapter-content-cards');

    chapter.forEach((item, index) => {
        const card = document.createElement('article');
        card.className = 'chapter-content-card';
        const heading = document.createElement('h3');
        heading.textContent = contentType === 'questions'
            ? `${index + 1}. ${item.label || 'Question'}`
            : `${index + 1}. ${item.title || 'Definition'}`;
        card.append(heading);

        const questionOrDefinition = document.createElement('div');
        questionOrDefinition.className = 'chapter-content-body';
        appendParagraphs(questionOrDefinition, contentType === 'questions' ? item.question : item.paragraphs);
        card.append(questionOrDefinition);

        if (contentType === 'questions') {
            const answer = document.createElement('details');
            answer.className = 'chapter-answer';
            const summary = document.createElement('summary');
            summary.textContent = 'အဖြေကြည့်ရန်';
            const answerContent = document.createElement('div');
            answerContent.className = 'chapter-answer-content';
            if (item.answer.length) {
                appendParagraphs(answerContent, item.answer);
            } else {
                const notice = document.createElement('p');
                notice.className = 'chapter-answer-unavailable';
                notice.textContent = 'မူရင်း Word ဖိုင်တွင် ဤမေးခွန်း၏အဖြေကို မဖော်ပြထားပါ။';
                answerContent.append(notice);
            }
            answer.append(summary, answerContent);
            card.append(answer);
        }
        cards.append(card);
    });
}

renderMath();
