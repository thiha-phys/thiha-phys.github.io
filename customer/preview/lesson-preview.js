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
    const sectionNames = { trueFalse: 'True or False', fillBlank: 'Fill in the Blank', multipleChoice: 'Multiple Choice' };
    (window.PREVIEW_OBJECTIVES?.sections || []).forEach((section) => {
      const title = document.createElement('p');
      title.className = 'preview-kicker';
      title.textContent = sectionNames[section.type] || 'Questions';
      content.append(title);
      (section.questions || []).forEach((question) => {
        const card = document.createElement('article');
        card.className = 'preview-card';
        const heading = document.createElement('h2');
        heading.textContent = `${question.number}. ${question.text || ''}`;
        card.append(heading);
        if (Array.isArray(question.options)) {
          const options = document.createElement('ol');
          options.className = 'question-options';
          question.options.forEach((option) => {
            const item = document.createElement('li');
            item.textContent = String(option);
            options.append(item);
          });
          card.append(options);
        }
        const answer = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = 'Show answer';
        const answerText = document.createElement('p');
        if (section.type === 'multipleChoice') answerText.textContent = question.options?.[question.correct] ?? '';
        else answerText.textContent = Array.isArray(question.answer) ? question.answer.join(' / ') : String(question.answer ?? '');
        answer.append(summary, answerText);
        card.append(answer);
        content.append(card);
      });
    });
    document.title = `Objectives · ${grade} Chapter 1 Preview`;
    return;
  }
  content.textContent = 'Preview content is unavailable.';
})();
