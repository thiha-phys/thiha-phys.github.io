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

    let currentSectionIndex = 0;
    let currentQuestionIndex = 0;
    let score = 0;

    quiz.append(progress);
    const sectionCards = sections.map((section, index) => {
        const card = document.createElement('section');
        card.className = 'objective-quiz-card objective-section-card';
        card.setAttribute('aria-label', sectionTitles[section.type]);

        const sectionHeading = document.createElement('h3');
        sectionHeading.className = 'objective-section';
        sectionHeading.textContent = sectionTitles[section.type];

        const sectionNotice = document.createElement('p');
        sectionNotice.className = 'objective-section-notice';
        sectionNotice.textContent = index === 0
            ? ''
            : 'အပေါ်က မေးခွန်းများကို အရင်ဖြေဆိုပါ။';
        sectionNotice.hidden = index === 0;

        const questionProgress = document.createElement('p');
        questionProgress.className = 'objective-question-count';
        questionProgress.hidden = index !== 0;

        const questionText = document.createElement('p');
        questionText.className = 'objective-question';
        questionText.hidden = index !== 0;

        const options = document.createElement('div');
        options.className = 'objective-options';
        options.hidden = index !== 0;

        const result = document.createElement('p');
        result.className = 'objective-result';
        result.setAttribute('role', 'status');
        result.setAttribute('aria-live', 'polite');
        result.hidden = index !== 0;

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

    function finishAnswer(isCorrect, message, elements) {
        if (isCorrect) {
            score += 1;
            elements.result.className = 'objective-result is-correct';
        } else {
            elements.result.className = 'objective-result is-incorrect';
        }
        elements.result.textContent = message;
        progress.textContent = `မေးခွန်း ${getQuestionNumber()} / ${questions.length} · ရမှတ် ${score}`;
        elements.nextButton.hidden = false;
        elements.nextButton.textContent = isLastQuestion()
            ? 'ရလဒ်ကြည့်ရန်'
            : isLastQuestionInSection()
                ? 'နောက်အမျိုးအစား'
                : 'နောက်မေးခွန်း';
    }

    function getQuestionNumber() {
        return sections.slice(0, currentSectionIndex)
            .reduce((total, section) => total + section.questions.length, 0) +
            currentQuestionIndex + 1;
    }

    function isLastQuestionInSection() {
        return currentQuestionIndex === sections[currentSectionIndex].questions.length - 1;
    }

    function isLastQuestion() {
        return currentSectionIndex === sections.length - 1 && isLastQuestionInSection();
    }

    function renderQuestion() {
        const section = sections[currentSectionIndex];
        const question = section.questions[currentQuestionIndex];
        const elements = sectionCards[currentSectionIndex];
        const { questionProgress, questionText, options, result, nextButton } = elements;
        progress.textContent = `မေးခွန်း ${getQuestionNumber()} / ${questions.length} · ရမှတ် ${score}`;
        questionProgress.textContent =
            `မေးခွန်း ${currentQuestionIndex + 1} / ${section.questions.length}`;
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
                    nextButton.textContent = isLastQuestion()
                        ? 'ရလဒ်ကြည့်ရန်'
                        : isLastQuestionInSection()
                            ? 'နောက်အမျိုးအစား'
                            : 'နောက်မေးခွန်း';
                    return;
                }
                const normalize = (value) => value.toLocaleLowerCase().replace(/[\s.,;:!?'"()[\]{}]/g, '');
                const isCorrect = question.answer.some((answer) => normalize(answer) === normalize(input.value));
                finishAnswer(
                    isCorrect,
                    isCorrect ? 'မှန်ပါသည်။' : `မမှန်ပါ။ အဖြေမှန်မှာ ${question.answer.join(' / ')} ဖြစ်ပါသည်။`,
                    elements
                );
            });
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && !checkButton.disabled) checkButton.click();
            });
            options.append(input, checkButton);
            input.focus();
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
                    finishAnswer(true, 'မှန်ပါသည်။', elements);
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
                    elements
                );
            });
            options.append(button);
        });
    }

    sectionCards.forEach(({ nextButton }) => {
        nextButton.addEventListener('click', () => {
            if (isLastQuestion()) {
                quiz.hidden = true;
                summary.hidden = false;
                summary.querySelector('[data-objective-score]').textContent =
                    `ရမှတ် ${score} / ${gradableQuestions}`;
                return;
            }

            if (isLastQuestionInSection()) {
                sectionCards[currentSectionIndex].sectionNotice.hidden = false;
                sectionCards[currentSectionIndex].sectionNotice.textContent =
                    `${sectionTitles[sections[currentSectionIndex].type]} အပိုင်း ပြီးပါပြီ။`;
                nextButton.hidden = true;
                currentSectionIndex += 1;
                const nextSection = sectionCards[currentSectionIndex];
                nextSection.sectionNotice.hidden = true;
                nextSection.questionProgress.hidden = false;
                nextSection.questionText.hidden = false;
                nextSection.options.hidden = false;
                nextSection.result.hidden = false;
                currentQuestionIndex = 0;
            } else {
                currentQuestionIndex += 1;
            }
            renderQuestion();
            sectionCards[currentSectionIndex].questionText.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        });
    });

    document.getElementById('objective-retry').addEventListener('click', () => {
        currentSectionIndex = 0;
        currentQuestionIndex = 0;
        score = 0;
        sectionCards.forEach((elements, index) => {
            elements.sectionNotice.hidden = index === 0;
            elements.sectionNotice.textContent = index === 0
                ? ''
                : 'အပေါ်က အမျိုးအစားကို အရင်ဖြေဆိုပါ။';
            elements.questionProgress.hidden = index !== 0;
            elements.questionText.hidden = index !== 0;
            elements.options.hidden = index !== 0;
            elements.result.hidden = index !== 0;
            elements.nextButton.hidden = true;
        });
        summary.hidden = true;
        quiz.hidden = false;
        renderQuestion();
    });

    renderQuestion();
}
