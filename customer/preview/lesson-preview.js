(() => {
  const grade = document.body.dataset.grade || 'G10';
  const kind = document.body.dataset.previewKind;
  const content = document.getElementById('lesson-content');
  const addText = (parent, text, className) => {
    const element = document.createElement('p');
    if (className) element.className = className;
    element.textContent = String(text ?? '');
    parent.append(element);
  };

  if (kind === 'definitions') {
    (window.PREVIEW_DEFINITIONS || []).forEach((definition, index) => {
      const card = document.createElement('article');
      card.className = 'preview-card definition-copy';
      const heading = document.createElement('h2');
      heading.textContent = `${index + 1}. ${definition.title || 'Definition'}`;
      card.append(heading);
      (definition.paragraphs || []).forEach((paragraphParts) => {
        const paragraph = document.createElement('p');
        const parts = typeof paragraphParts === 'string' ? [{ text: paragraphParts }] : paragraphParts;
        parts.forEach((part) => {
          if (part.text !== undefined) paragraph.append(document.createTextNode(part.text));
          else if (part.math) {
            const math = document.createElement('span');
            math.textContent = part.plain || part.tex || '';
            paragraph.append(math);
          }
        });
        card.append(paragraph);
      });
      content.append(card);
    });
    document.title = `Definitions · ${grade} Chapter 1 Preview`;
    return;
  }

  if (kind === 'objectives') {
    const quizData = window.PREVIEW_OBJECTIVES;
    if (!Array.isArray(quizData?.sections) || !quizData.sections.length) {
      content.textContent = 'Objective preview is unavailable.';
      return;
    }
    const styles = document.createElement('link');
    styles.rel = 'stylesheet';
    styles.href = '../page/objective-quiz.css';
    document.head.append(styles);
    content.replaceChildren();
    const heading = document.createElement('div');
    heading.className = 'chapter-content-heading preview-quiz-heading';
    const label = document.createElement('span');
    label.className = 'chapter-content-label';
    label.id = 'chapter-content-label';
    const title = document.createElement('h2');
    title.id = 'chapter-content-title';
    heading.append(label, title);
    const notice = document.createElement('p');
    notice.className = 'objective-notice';
    notice.id = 'objective-notice';
    notice.hidden = true;
    const quiz = document.createElement('section');
    quiz.className = 'objective-quiz-card';
    quiz.id = 'objective-quiz';
    quiz.setAttribute('aria-live', 'polite');
    const progress = document.createElement('p');
    progress.className = 'objective-progress';
    progress.id = 'objective-progress';
    quiz.append(progress);
    const summary = document.createElement('section');
    summary.className = 'objective-summary';
    summary.id = 'objective-summary';
    summary.hidden = true;
    summary.innerHTML = '<h3>လေ့ကျင့်မှုပြီးပါပြီ။</h3><p data-objective-score></p><button class="primary-button objective-retry" id="objective-retry" type="button">ပြန်လည်ဖြေဆိုရန်</button>';
    content.append(heading, notice, quiz, summary);
    document.body.dataset.grade = grade;
    document.body.dataset.chapter = '1';
    const chapterCount = { G10: 11, G11: 12, G12: 13 }[grade] || 1;
    const gradeChapters = Array.from({ length: chapterCount }, () => ({ sections: [] }));
    gradeChapters[0] = { sections: quizData.sections.map((section) => ({
        type: section.type,
        questions: (section.questions || []).map(({ number, ...question }) => question)
      })) };
    window.OBJECTIVE_QUIZ_DATA = { [grade]: gradeChapters };
    const quizScript = document.createElement('script');
    quizScript.src = '../page/objective-quiz.js';
    document.body.append(quizScript);
    document.title = `Objectives · ${grade} Chapter 1 Preview`;
    return;
  }
  content.textContent = 'Preview content is unavailable.';
})();
