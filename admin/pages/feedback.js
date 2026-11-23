const feedbackList = document.getElementById('feedback-list');
const feedbackAdminStatus = document.getElementById('feedback-admin-status');

function appendFeedbackText(parent, tagName, text, className) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text;
    parent.append(element);
}

function renderFeedbackCard(feedback) {
    if (!feedback || typeof feedback !== 'object' || !Array.isArray(feedback.books)) {
        throw new Error('The feedback service returned an invalid feedback record.');
    }

    const article = document.createElement('article');
    article.className = 'feedback-admin-card';

    const header = document.createElement('header');
    header.className = 'feedback-admin-card-header';
    const identity = document.createElement('div');
    appendFeedbackText(identity, 'h2', String(feedback.name || 'အမည်မရှိ'));
    const meta = [
        feedback.job === 'teacher' ? 'ဆရာ / ဆရာမ' : feedback.job === 'student' ? 'ကျောင်းသား / ကျောင်းသူ' : ''
    ].filter(Boolean).join(' · ');
    if (meta) appendFeedbackText(identity, 'p', meta);
    header.append(identity);

    if (feedback.submittedAt) {
        const time = document.createElement('time');
        const parsedDate = new Date(feedback.submittedAt.replace(' ', 'T'));
        time.textContent = Number.isNaN(parsedDate.getTime())
            ? feedback.submittedAt
            : new Intl.DateTimeFormat('my-MM', {
                dateStyle: 'medium',
                timeStyle: 'short'
            }).format(parsedDate);
        header.append(time);
    }

    const books = document.createElement('div');
    books.className = 'feedback-admin-books';
    feedback.books.forEach((book) => {
        if (!book || typeof book !== 'object') {
            throw new Error('The feedback service returned an invalid book recommendation.');
        }
        const section = document.createElement('section');
        section.className = 'feedback-admin-book';
        const bookName = (window.AdminBooks || []).find((item) => item.id === book.id)?.name ||
            String(book.id || 'စာအုပ်');
        appendFeedbackText(section, 'h3', bookName);
        const rating = Number(book.rating);
        if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
            appendFeedbackText(
                section,
                'p',
                `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} (${rating}/5)`,
                'feedback-stars'
            );
        }
        if (book.suggestion) appendFeedbackText(section, 'p', String(book.suggestion));
        books.append(section);
    });

    article.append(header, books);
    if (feedback.otherSuggestion) {
        const other = document.createElement('section');
        other.className = 'feedback-admin-other';
        appendFeedbackText(other, 'h3', 'အခြားအကြံပြုချက်');
        appendFeedbackText(other, 'p', String(feedback.otherSuggestion));
        article.append(other);
    }
    return article;
}

async function loadFeedback(button) {
    if (button) button.disabled = true;
    feedbackAdminStatus.classList.remove('error');
    feedbackAdminStatus.textContent = 'Loading feedback…';
    feedbackList.innerHTML = '<div class="empty-state">Loading recommendations…</div>';
    try {
        const feedback = await AdminApi.getFeedback();
        const cards = feedback.map(renderFeedbackCard);
        feedbackList.replaceChildren(...cards);
        if (!cards.length) {
            feedbackList.innerHTML = '<div class="empty-state">အကြံပြုစာ မရှိသေးပါ။</div>';
        }
        feedbackAdminStatus.textContent = `${feedback.length.toLocaleString('en-US')} submissions`;
    } catch (error) {
        console.error('Unable to load customer feedback.', error);
        feedbackAdminStatus.textContent = 'အကြံပြုစာစာရင်းကို ရယူမရပါ။ ပြန်လည်စမ်းကြည့်ပါ။';
        feedbackAdminStatus.classList.add('error');
        feedbackList.innerHTML = '<div class="empty-state error">Feedback could not be loaded. Check the database connection and try again.</div>';
    } finally {
        if (button) button.disabled = false;
    }
}

document.getElementById('refresh-feedback').addEventListener('click', (event) =>
    loadFeedback(event.currentTarget)
);
loadFeedback();
