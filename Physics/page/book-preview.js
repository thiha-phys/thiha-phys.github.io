const requestedBookId = new URLSearchParams(window.location.search).get('book');
const book = PHYSICS_BOOKS.find((item) => item.id === requestedBookId);
const image = document.getElementById('sample-page');
const message = document.getElementById('sample-message');
const indicator = document.getElementById('page-indicator');
const previousButton = document.getElementById('previous-page');
const nextButton = document.getElementById('next-page');
let currentPage = 1;

function showPage() {
    indicator.textContent = `စာမျက်နှာ ${currentPage} / 10`;
    previousButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === 10;
    image.hidden = true;
    message.textContent = 'ဤစာအုပ်၏ နမူနာစာမျက်နှာများကို မတင်ရသေးပါ။';
    image.src = `../pictures/book%20samples/${encodeURIComponent(book.id)}/page-${String(currentPage).padStart(2, '0')}.jpeg`;
}

if (!book) {
    document.getElementById('reader-title').textContent = 'စာအုပ်ကို ရှာမတွေ့ပါ';
    message.textContent = 'စာအုပ်စာရင်းသို့ ပြန်သွားပြီး စာအုပ်တစ်အုပ်ကို ရွေးချယ်ပါ။';
    previousButton.disabled = true;
    nextButton.disabled = true;
} else {
    document.title = `${book.name} နမူနာ | Physics Learning Hub`;
    document.getElementById('reader-title').textContent = book.name;
    image.alt = `${book.name} နမူနာစာမျက်နှာ`;
    image.addEventListener('load', () => {
        image.hidden = false;
        message.textContent = '';
    });
    image.addEventListener('error', () => {
        image.hidden = true;
        message.textContent = 'ဤစာအုပ်၏ နမူနာစာမျက်နှာများကို မတင်ရသေးပါ။';
    });
    previousButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage -= 1;
            showPage();
        }
    });
    nextButton.addEventListener('click', () => {
        if (currentPage < 10) {
            currentPage += 1;
            showPage();
        }
    });
    showPage();
}

document.addEventListener('contextmenu', (event) => event.preventDefault());
document.addEventListener('dragstart', (event) => event.preventDefault());
