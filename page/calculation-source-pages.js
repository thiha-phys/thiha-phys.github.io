const pageList = document.getElementById('chapter-page-list');
const pageStatus = document.getElementById('chapter-pages-status');
const pageDialog = document.getElementById('calculation-image-dialog');
const viewerImage = document.getElementById('calculation-image-viewer');
const viewerPageNumber = document.getElementById('calculation-image-page');
const previousPageButton = document.getElementById('previous-source-page');
const nextPageButton = document.getElementById('next-source-page');
const chapterNumber = Number(document.body.dataset.chapter);
const firstSourcePage = Number(document.body.dataset.startPage);
const lastSourcePage = Number(document.body.dataset.endPage);
const chapterTitle = document.getElementById('chapter-title').textContent;
let activeSourcePage = firstSourcePage;

if (
    !Number.isInteger(chapterNumber) || chapterNumber < 1 || chapterNumber > 10 ||
    !Number.isInteger(firstSourcePage) || !Number.isInteger(lastSourcePage) ||
    firstSourcePage < 1 || lastSourcePage < firstSourcePage || lastSourcePage > 68
) {
    throw new Error('Invalid source page range for this Grade 12 calculations chapter.');
}

function sourcePagePath(pageNumber) {
    return `../pictures/g12-calculation-pages/g12-cal-pdf-page-${String(pageNumber).padStart(2, '0')}.png`;
}

function updateViewer() {
    viewerImage.src = sourcePagePath(activeSourcePage);
    viewerImage.alt = `Chapter ${chapterNumber}, PDF page ${activeSourcePage}`;
    viewerPageNumber.textContent = `စာမျက်နှာ ${activeSourcePage} / ${lastSourcePage}`;
    previousPageButton.disabled = activeSourcePage === firstSourcePage;
    nextPageButton.disabled = activeSourcePage === lastSourcePage;
}

for (let sourcePage = firstSourcePage; sourcePage <= lastSourcePage; sourcePage += 1) {
    const card = document.createElement('article');
    card.className = 'problem-card source-page-card';

    const number = document.createElement('div');
    number.className = 'problem-number';
    const numberLabel = document.createElement('span');
    numberLabel.textContent = `စာမျက်နှာ ${sourcePage - firstSourcePage + 1}`;
    number.append(numberLabel);

    const openButton = document.createElement('button');
    openButton.className = 'source-page-image-button';
    openButton.type = 'button';
    openButton.dataset.sourcePage = String(sourcePage);
    openButton.setAttribute('aria-label', `Chapter ${chapterNumber} မူရင်း PDF စာမျက်နှာ ${sourcePage} ကို ချဲ့ကြည့်ရန်`);

    const image = document.createElement('img');
    image.src = sourcePagePath(sourcePage);
    image.alt = `${chapterTitle} — မူရင်း PDF စာမျက်နှာ ${sourcePage}`;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => {
        console.error(`Unable to load Grade 12 calculation PDF page ${sourcePage}.`);
        pageStatus.hidden = false;
        pageStatus.textContent = `စာမျက်နှာ ${sourcePage} ကို ဖွင့်မရပါ။ ဖိုင်လမ်းကြောင်းကို စစ်ဆေးပါ။`;
    }, { once: true });
    openButton.append(image);

    const hint = document.createElement('p');
    hint.className = 'source-page-hint';
    hint.textContent = 'ပုံကိုနှိပ်ပြီး စာမျက်နှာကို ချဲ့ကြည့်ပါ။';

    card.append(number, openButton, hint);
    pageList.append(card);
}

pageList.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const openButton = event.target.closest('[data-source-page]');
    if (!openButton) return;

    activeSourcePage = Number(openButton.dataset.sourcePage);
    updateViewer();
    pageDialog.showModal();
});

document.getElementById('close-calculation-image').addEventListener('click', () => {
    pageDialog.close();
});

pageDialog.addEventListener('click', (event) => {
    if (event.target === pageDialog) pageDialog.close();
});

previousPageButton.addEventListener('click', () => {
    if (activeSourcePage > firstSourcePage) {
        activeSourcePage -= 1;
        updateViewer();
    }
});

nextPageButton.addEventListener('click', () => {
    if (activeSourcePage < lastSourcePage) {
        activeSourcePage += 1;
        updateViewer();
    }
});

pageDialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft' && activeSourcePage > firstSourcePage) {
        activeSourcePage -= 1;
        updateViewer();
    } else if (event.key === 'ArrowRight' && activeSourcePage < lastSourcePage) {
        activeSourcePage += 1;
        updateViewer();
    }
});
