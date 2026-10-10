document.querySelectorAll('.problem-content details > div').forEach((answer) => {
    if (!answer.classList.contains('problem-answer')) {
        answer.classList.add('problem-answer', 'legacy-calculation-answer');
    }
});

document.querySelectorAll('.problem-answer').forEach((answer) => {
    const paragraphs = answer.querySelectorAll('p');
    const paragraph = paragraphs[paragraphs.length - 1];
    if (!paragraph) return;

    const text = paragraph.textContent.trim();
    const lastEquals = text.lastIndexOf('=');
    const range = document.createRange();
    range.selectNodeContents(paragraph);

    if (lastEquals >= 0) {
        const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
        let node;
        let offset = 0;
        let resultNode = null;
        let resultOffset = 0;

        while ((node = walker.nextNode())) {
            const index = node.textContent.lastIndexOf('=');
            if (index >= 0) {
                resultNode = node;
                resultOffset = index + 1;
            }
        }
        if (!resultNode) return;
        range.setStart(resultNode, resultOffset);
    } else if (text.length <= 48 && /\d/.test(text)) {
        range.selectNodeContents(paragraph);
    } else {
        return;
    }

    if (!range.toString().trim()) return;
    const result = document.createElement('span');
    result.className = 'calculation-result';
    result.append(range.extractContents());
    range.insertNode(result);
});

document.querySelectorAll('.problem-card').forEach((card) => {
    const label = card.querySelector('.problem-number span, :scope > div:first-child > span')?.textContent.trim();
    const firstParagraph = card.querySelector('.problem-question p, .problem-content > p');
    if (!label || !firstParagraph) return;

    const match = label.match(/^(No|Eg|Rev)\.?(\d+)$/i);
    if (!match) return;

    const prefix = new RegExp(`^\\s*${match[1]}\\s*\\.?\\s*${match[2]}\\s*\\.\\s*`, 'i');
    const walker = document.createTreeWalker(firstParagraph, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let text = '';
    let node;
    while ((node = walker.nextNode())) {
        nodes.push({ node, start: text.length });
        text += node.textContent;
    }

    const duplicate = prefix.exec(text);
    if (!duplicate) return;

    const range = document.createRange();
    let start = null;
    let end = null;
    for (const entry of nodes) {
        const nodeEnd = entry.start + entry.node.textContent.length;
        if (!start && duplicate.index < nodeEnd) {
            start = { node: entry.node, offset: duplicate.index - entry.start };
        }
        if (duplicate.index + duplicate[0].length <= nodeEnd) {
            end = { node: entry.node, offset: duplicate.index + duplicate[0].length - entry.start };
            break;
        }
    }
    if (!start || !end) return;

    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    range.deleteContents();
});
