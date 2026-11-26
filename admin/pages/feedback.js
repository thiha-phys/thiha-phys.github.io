const feedbackList = document.getElementById('feedback-list');
const feedbackAdminStatus = document.getElementById('feedback-admin-status');

function appendFeedbackText(parent, tagName, text, className) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text;
    parent.append(element);
}

function formatFeedbackDate(value) {
    const raw = String(value || '');
    if (!raw) return '';
    const parsedDate = new Date(raw.replace(' ', 'T'));
    return Number.isNaN(parsedDate.getTime())
        ? raw
        : new Intl.DateTimeFormat('my-MM', {
            dateStyle: 'medium',
            timeStyle: 'short'
        }).format(parsedDate);
}

function renderFeedbackCard(feedback) {
    if (!feedback || typeof feedback !== 'object' || !Array.isArray(feedback.books)) {
        throw new Error('The feedback service returned an invalid feedback record.');
    }

    const item = document.createElement('details');
    item.className = 'feedback-inbox-item';
    const summary = document.createElement('summary');
    summary.className = 'feedback-inbox-summary';
    const name = String(feedback.name || 'အမည်မရှိ');
    const avatar = document.createElement('span');
    avatar.className = 'feedback-inbox-avatar';
    avatar.textContent = name.trim().charAt(0).toUpperCase() || '?';

    const copy = document.createElement('span');
    copy.className = 'feedback-inbox-copy';
    appendFeedbackText(copy, 'strong', name, 'feedback-inbox-name');
    const role = feedback.job === 'teacher' ? 'ဆရာ / ဆရာမ' : feedback.job === 'student' ? 'ကျောင်းသား / ကျောင်းသူ' : 'Customer';
    appendFeedbackText(copy, 'span', role, 'feedback-inbox-role');
    const preview = feedback.otherSuggestion ||
        feedback.books.find((book) => book && typeof book.suggestion === 'string' && book.suggestion.trim())?.suggestion ||
        `${feedback.books.length} book rating${feedback.books.length === 1 ? '' : 's'} submitted`;
    appendFeedbackText(copy, 'span', String(preview).replace(/\s+/g, ' ').trim(), 'feedback-inbox-preview');

    const submittedAt = feedback.createdAt || feedback.submittedAt;
    const time = document.createElement('time');
    time.className = 'feedback-inbox-time';
    time.textContent = formatFeedbackDate(submittedAt);
    if (submittedAt) {
        const timestamp = new Date(submittedAt);
        time.dateTime = Number.isNaN(timestamp.getTime()) ? String(submittedAt) : timestamp.toISOString();
    }
    const chevron = document.createElement('i');
    chevron.className = 'feedback-inbox-chevron fa-solid fa-chevron-down';
    chevron.setAttribute('aria-hidden', 'true');
    summary.append(avatar, copy, time, chevron);

    const body = document.createElement('div');
    body.className = 'feedback-inbox-details';
    const contact = document.createElement('div');
    contact.className = 'feedback-inbox-contact';
    appendFeedbackText(contact, 'span', role);
    if (feedback.phone) {
        const phone = document.createElement('a');
        phone.href = `tel:${String(feedback.phone).replace(/[^\d+]/g, '')}`;
        phone.textContent = String(feedback.phone);
        contact.append(phone);
    }
    if (submittedAt) appendFeedbackText(contact, 'time', formatFeedbackDate(submittedAt));
    body.append(contact);

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
    body.append(books);
    if (feedback.otherSuggestion) {
        const other = document.createElement('section');
        other.className = 'feedback-admin-other';
        appendFeedbackText(other, 'h3', 'အခြားအကြံပြုချက်');
        appendFeedbackText(other, 'p', String(feedback.otherSuggestion));
        body.append(other);
    }
    item.append(summary, body);
    return item;
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
        feedbackAdminStatus.textContent = `${feedback.length.toLocaleString('en-US')} ${feedback.length === 1 ? 'submission' : 'submissions'}`;
    } catch (error) {
        console.error('Unable to load customer feedback.', error);
        feedbackAdminStatus.textContent = 'အကြံပြုစာစာရင်းကို ရယူမရပါ။ ပြန်လည်စမ်းကြည့်ပါ။';
        feedbackAdminStatus.classList.add('error');
        feedbackList.innerHTML = '<div class="empty-state error">Feedback could not be loaded. Check the database connection and try again.</div>';
    } finally {
        if (button) button.disabled = false;
    }
}

loadFeedback();
