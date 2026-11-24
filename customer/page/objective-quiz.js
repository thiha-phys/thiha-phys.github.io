const grade = document.body.dataset.grade;
const chapterNumber = Number(document.body.dataset.chapter || 0);
const gradeData = window.OBJECTIVE_QUIZ_DATA && window.OBJECTIVE_QUIZ_DATA[grade];

if (!Array.isArray(gradeData)) {
    throw new Error(`Objective question data is missing for ${grade}.`);
}

const chapterTitles = {
    G10: [
        'Units and Measurements', 'Motion', 'Forces', 'Pressure', 'Work and Energy',
        'Heat and Temperature', 'Wave and Sound', 'Light', 'Electricity', 'Magnetism',
        'Quantum and Atomic Physics'
    ],
    G11: [
        'Motion in a Plane', 'Rotational Dynamics', 'Pressure', 'Power and Efficiency',
        'Heat and Thermal Phenomena',
        'Vibration of Strings, Resonance and Vibration of Air Columns',
        'Refraction of Light', 'Lenses', 'Electric Field',
        'Electric Current and Magnetic Effect of Electric Current',
        'Fundamentals of Electronics', 'Modern Physics'
    ],
    G12: [
        'Rotational Motion', 'Forces in Circular Motion', 'Fluid Dynamics',
        'Sources of Energy and Environmental Impacts', 'Heat Transfer and Thermodynamics',
        'Effects and Characteristics of Sound', 'Applications of Light and Optical Instruments',
        'Interference and Diffraction of Light', 'Capacitor and Capacitance',
        'Electrical Energy, Power and Heating Effect of Electric Current',
        'Electromagnetic Induction, Generation and Distribution of Electricity',
        'Digital Electronics and Communication System', 'Modern Physics'
    ]
};
const titles = chapterTitles[grade];

if (!titles || titles.length !== gradeData.length) {
    throw new Error(`Objective question chapters are incomplete for ${grade}.`);
}

const sectionTitles = {
    trueFalse: 'မှန် / မှား',
    fillBlank: 'ကွက်လပ်ဖြည့်',
    multipleChoice: 'ရွေးချယ်မေးခွန်း'
};
const allQuestions = (chapter) => chapter.sections.flatMap((section) =>
    section.questions.map((question) => ({ ...question, type: section.type }))
);

const chapterList = document.getElementById('chapter-content-list');
if (chapterList) {
    gradeData.forEach((chapter, index) => {
        const link = document.createElement('a');
        link.href = `${grade}objCh${index + 1}.html`;

        const number = document.createElement('span');
        number.className = 'chapter-content-number';
        number.textContent = String(index + 1).padStart(2, '0');

        const title = document.createElement('span');
        title.textContent = titles[index];

        const count = document.createElement('span');
        count.className = 'objective-question-count';
        count.textContent = `${allQuestions(chapter).length} မေးခွန်း`;

        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-chevron-right';
        icon.setAttribute('aria-hidden', 'true');
        link.append(number, title, count, icon);
        chapterList.append(link);
    });
} else {
    const chapter = gradeData[chapterNumber - 1];
    if (!chapter || chapterNumber < 1 || chapterNumber > titles.length) {
        throw new Error(`Invalid ${grade} objective chapter: ${chapterNumber}`);
    }

    const sections = chapter.sections.map((section) => ({
        ...section,
        questions: section.questions.map((question) => ({
            ...question,
            type: section.type
        }))
    }));
    const questions = allQuestions(chapter);
    const gradableQuestions = questions.filter((question) =>
        question.type === 'multipleChoice' || question.answer !== null
    ).length;
    const title = titles[chapterNumber - 1];
    document.title = `${grade} Chapter ${chapterNumber} Objectives | Physics Learning Hub`;
    document.getElementById('chapter-content-label').textContent = `CHAPTER ${chapterNumber}`;
    document.getElementById('chapter-content-title').textContent = title;

    const quiz = document.getElementById('objective-quiz');
    const progress = document.getElementById('objective-progress');
    const summary = document.getElementById('objective-summary');
    quiz.replaceChildren();
    if (questions.length === 0) {
        throw new Error(`${grade} chapter ${chapterNumber} has no objective questions.`);
    }

    const sectionStates = sections.map((section) => ({ questionIndex: 0, score: 0, complete: false }));
    const scoreableBySection = sections.map((section) => section.questions.filter((question) =>
        question.type === 'multipleChoice' || question.answer !== null
    ).length);
    let answered = 0;

    quiz.append(progress);
    const sectionCards = sections.map((section) => {
        const card = document.createElement('section');
        card.className = 'objective-quiz-card objective-section-card';
        card.setAttribute('aria-label', sectionTitles[section.type]);

        const sectionHeading = document.createElement('h3');
        sectionHeading.className = 'objective-section';
        sectionHeading.textContent = sectionTitles[section.type];

        const sectionNotice = document.createElement('p');
        sectionNotice.className = 'objective-section-notice';
        sectionNotice.textContent = '';
        sectionNotice.hidden = true;

        const questionProgress = document.createElement('p');
        questionProgress.className = 'objective-question-count';

        const questionText = document.createElement('p');
        questionText.className = 'objective-question';

        const options = document.createElement('div');
        options.className = 'objective-options';

        const result = document.createElement('p');
        result.className = 'objective-result';
        result.setAttribute('role', 'status');
        result.setAttribute('aria-live', 'polite');

        const nextButton = document.createElement('button');
        nextButton.className = 'primary-button objective-next';
        nextButton.type = 'button';
        nextButton.hidden = true;

        card.append(sectionHeading, sectionNotice, questionProgress, questionText, options, result, nextButton);
        quiz.append(card);
        return {
            card, sectionNotice, questionProgress, questionText, options, result, nextButton
        };
    });

    function updateCombinedProgress() {
        const score = sectionStates.reduce((total, state) => total + state.score, 0);
        progress.textContent = `ဖြေဆိုပြီး ${answered} / ${questions.length} · စုစုပေါင်းရမှတ် ${score} / ${gradableQuestions}`;
    }

    function finishAnswer(isCorrect, message, elements, sectionIndex) {
        const state = sectionStates[sectionIndex];
        answered += 1;
        if (isCorrect) {
            state.score += 1;
            elements.result.className = 'objective-result is-correct';
        } else {
            elements.result.className = 'objective-result is-incorrect';
        }
        elements.result.textContent = message;
        updateCombinedProgress();
        elements.questionProgress.textContent =
            `မေးခွန်း ${state.questionIndex + 1} / ${sections[sectionIndex].questions.length} · ရမှတ် ${state.score} / ${scoreableBySection[sectionIndex]}`;
        elements.nextButton.hidden = false;
        elements.nextButton.textContent = state.questionIndex === sections[sectionIndex].questions.length - 1
            ? 'ဤအပိုင်းပြီးပါပြီ'
            : 'နောက်မေးခွန်း';
    }

    function renderQuestion(sectionIndex) {
        const state = sectionStates[sectionIndex];
        const section = sections[sectionIndex];
        const question = section.questions[state.questionIndex];
        const elements = sectionCards[sectionIndex];
        const { questionProgress, questionText, options, result, nextButton } = elements;
        updateCombinedProgress();
        questionProgress.textContent = `မေးခွန်း ${state.questionIndex + 1} / ${section.questions.length} · ရမှတ် ${state.score} / ${scoreableBySection[sectionIndex]}`;
        questionText.textContent = question.text;
        result.textContent = '';
        result.className = 'objective-result';
        nextButton.hidden = true;
        options.replaceChildren();

        if (question.type === 'fillBlank') {
            const input = document.createElement('input');
            input.className = 'objective-answer-input';
            input.type = 'text';
            input.autocomplete = 'off';
            input.setAttribute('aria-label', 'အဖြေထည့်ရန်');
            input.placeholder = 'အဖြေကို ရိုက်ထည့်ပါ';

            const checkButton = document.createElement('button');
            checkButton.className = 'primary-button objective-check';
            checkButton.type = 'button';
            checkButton.textContent = 'အဖြေစစ်ဆေးရန်';
            checkButton.addEventListener('click', () => {
                if (!input.value.trim()) {
                    input.focus();
                    result.textContent = 'အဖြေကို အရင်ဖြည့်ပါ။';
                    result.className = 'objective-result is-incorrect';
                    return;
                }
                input.disabled = true;
                checkButton.disabled = true;
                if (!Array.isArray(question.answer) || question.answer.length === 0) {
                    result.textContent = 'ဤမေးခွန်းအတွက် အဖြေစာရင်း မပါဝင်သေးပါ။';
                    result.className = 'objective-result';
                    nextButton.hidden = false;
                    nextButton.textContent = state.questionIndex === section.questions.length - 1
                        ? 'ဤအပိုင်းပြီးပါပြီ'
                        : 'နောက်မေးခွန်း';
                    return;
                }
                const normalize = (value) => value.toLocaleLowerCase().replace(/[\s.,;:!?'"()[\]{}]/g, '');
                const isCorrect = question.answer.some((answer) => normalize(answer) === normalize(input.value));
                finishAnswer(
                    isCorrect,
                    isCorrect ? 'မှန်ပါသည်။' : `မမှန်ပါ။ အဖြေမှန်မှာ ${question.answer.join(' / ')} ဖြစ်ပါသည်။`,
                    elements,
                    sectionIndex
                );
            });
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && !checkButton.disabled) checkButton.click();
            });
            options.append(input, checkButton);
            return;
        }

        const choices = question.type === 'trueFalse'
            ? ['True', 'False']
            : question.options;
        choices.forEach((choice, index) => {
            const button = document.createElement('button');
            button.className = 'objective-option';
            button.type = 'button';
            button.textContent = question.type === 'multipleChoice'
                ? `${String.fromCharCode(65 + index)}. ${choice}`
                : choice;
            button.addEventListener('click', () => {
                options.querySelectorAll('button').forEach((item) => { item.disabled = true; });
                const isCorrect = question.type === 'trueFalse'
                    ? (index === 0) === question.answer
                    : index === question.correct;
                if (isCorrect) {
                    button.classList.add('is-correct');
                    finishAnswer(true, 'မှန်ပါသည်။', elements, sectionIndex);
                    return;
                }
                button.classList.add('is-incorrect');
                const correctIndex = question.type === 'trueFalse'
                    ? (question.answer ? 0 : 1)
                    : question.correct;
                options.children[correctIndex].classList.add('is-correct');
                finishAnswer(
                    false,
                    question.type === 'trueFalse'
                        ? `မမှန်ပါ။ အဖြေမှန်မှာ ${choices[correctIndex]} ဖြစ်ပါသည်။`
                        : `မမှန်ပါ။ အဖြေမှန်မှာ ${String.fromCharCode(65 + correctIndex)} ဖြစ်ပါသည်။`,
                    elements,
                    sectionIndex
                );
            });
            options.append(button);
        });
    }

    sectionCards.forEach(({ nextButton, sectionNotice, questionText }, sectionIndex) => {
        nextButton.addEventListener('click', () => {
            const state = sectionStates[sectionIndex];
            if (state.questionIndex === sections[sectionIndex].questions.length - 1) {
                state.complete = true;
                sectionNotice.hidden = false;
                sectionNotice.textContent = `${sectionTitles[sections[sectionIndex].type]} အပိုင်း ပြီးပါပြီ။ ရမှတ် ${state.score} / ${scoreableBySection[sectionIndex]}`;
                nextButton.hidden = true;
                if (sectionStates.every((item) => item.complete)) {
                    quiz.hidden = true;
                    summary.hidden = false;
                    const score = sectionStates.reduce((total, item) => total + item.score, 0);
                    summary.querySelector('[data-objective-score]').textContent =
                        `စုစုပေါင်းရမှတ် ${score} / ${gradableQuestions}`;
                }
                return;
            }
            state.questionIndex += 1;
            renderQuestion(sectionIndex);
            questionText.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        });
    });

    document.getElementById('objective-retry').addEventListener('click', () => {
        answered = 0;
        sectionStates.forEach((state) => {
            state.questionIndex = 0;
            state.score = 0;
            state.complete = false;
        });
        sectionCards.forEach((elements) => {
            elements.sectionNotice.hidden = true;
            elements.sectionNotice.textContent = '';
            elements.nextButton.hidden = true;
        });
        summary.hidden = true;
        quiz.hidden = false;
        sections.forEach((_, index) => renderQuestion(index));
    });

    sections.forEach((_, index) => renderQuestion(index));
}
