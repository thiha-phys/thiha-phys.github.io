const chapterTitles = [
    'Motion in a plane',
    'Rotational Dynamics',
    'Pressure',
    'Power and Efficiency',
    'Heat and Thermal Phenomena',
    'Vibration of strings, resonance and vibration of air columns',
    'Refraction of light',
    'Lenses',
    'Electric field',
    'Electric Current and Magnetic Effect of Electric Current',
    'Fundamentals of Electronics',
    'Modern Physics'
];

const chapterNumber = Number(document.body.dataset.chapter);
const chapter = window.G11_DEFINITION_CHAPTERS[chapterNumber - 1];
if (!chapter || chapterNumber < 1 || chapterNumber > chapterTitles.length) {
    throw new Error(`Invalid Grade 11 definitions chapter: ${document.body.dataset.chapter}`);
}

document.title = `Chapter ${chapterNumber}: ${chapterTitles[chapterNumber - 1]} | Grade 11 Definitions`;
document.getElementById('chapter-label').textContent = `CHAPTER ${chapterNumber}`;
document.getElementById('chapter-title').textContent = chapterTitles[chapterNumber - 1];

const definitionList = document.getElementById('definition-list');
chapter.forEach((definition, index) => {
    const card = document.createElement('article');
    card.className = 'definition-card';
    const heading = document.createElement('h3');
    heading.textContent = `${index + 1}. ${definition.title || 'Definition'}`;
    card.append(heading);

    definition.paragraphs.forEach((parts) => {
        const paragraph = document.createElement('p');
        const segments = typeof parts === 'string' ? [{ text: parts }] : parts;
        segments.forEach((segment) => {
            if (segment.text !== undefined) {
                const chunks = segment.text.split(/([\u1000-\u109f]+)/);
                chunks.forEach((chunk) => {
                    if (!chunk) {
                        return;
                    }
                    if (/^[\u1000-\u109f]+$/.test(chunk)) {
                        const myanmar = document.createElement('span');
                        myanmar.className = 'myanmar-text';
                        myanmar.textContent = chunk;
                        paragraph.append(myanmar);
                    } else {
                        paragraph.append(document.createTextNode(chunk));
                    }
                });
                return;
            }
            const equation = document.createElement('span');
            equation.className = 'math-expression';
            equation.textContent = segment.plain;
            equation.dataset.tex = segment.tex;
            equation.dataset.plain = segment.plain;
            paragraph.append(equation);
        });
        card.append(paragraph);
    });
    definitionList.append(card);
});

window.MathJax = {
    tex: { inlineMath: [['\\(', '\\)']] },
    startup: { typeset: false }
};

const mathJaxScript = document.createElement('script');
mathJaxScript.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js';
mathJaxScript.async = true;
mathJaxScript.onload = () => {
    const equations = [...document.querySelectorAll('.math-expression')];
    equations.forEach((equation) => {
        equation.textContent = `\\(${equation.dataset.tex}\\)`;
    });
    window.MathJax.typesetPromise(equations).catch((error) => {
        console.error('Unable to typeset the Grade 11 definition equations.', error);
        equations.forEach((equation) => {
            equation.textContent = equation.dataset.plain || equation.textContent;
        });
    });
};
mathJaxScript.onerror = (error) => {
    console.error('Unable to load the equation renderer for Grade 11 definitions.', error);
};
document.head.append(mathJaxScript);
