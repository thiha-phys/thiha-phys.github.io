const feedbackList = document.getElementById('feedback-list');
const feedbackAdminStatus = document.getElementById('feedback-admin-status');
const feedbackConversation = document.getElementById('feedback-conversation');
const feedbackInbox = document.querySelector('.feedback-admin-inbox');
const feedbackRefresh = document.getElementById('feedback-refresh');
let feedbackThreads = [];
let activeThreadKey = null;

function appendFeedbackText(parent, tagName, text, className) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text;
    parent.append(element);
    return element;
}

function parseFeedbackDate(value) {
    const raw = String(value || '');
    if (!raw) return null;
    const date = new Date(raw.replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatFeedbackDate(value) {
    const raw = String(value || '');
    const date = parseFeedbackDate(raw);
    return date
        ? new Intl.DateTimeFormat('my-MM', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
        : raw;
}

function feedbackRole(feedback) {
    return feedback.job === 'teacher' ? 'ဆရာ / ဆရာမ' : feedback.job === 'student' ? 'ကျောင်းသား / ကျောင်းသူ' : 'Customer';
}

function feedbackPreview(feedback) {
    const suggestion = feedback.otherSuggestion ||
        feedback.books.find((book) => book && typeof book.suggestion === 'string' && book.suggestion.trim())?.suggestion;
    return suggestion
        ? String(suggestion).replace(/\s+/g, ' ').trim()
        : `${feedback.books.length} book rating${feedback.books.length === 1 ? '' : 's'} submitted`;
}

function groupFeedback(records) {
    if (!Array.isArray(records)) {
        throw new Error('The feedback service returned an invalid feedback list.');
    }

    const threads = new Map();
    for (const feedback of records) {
        if (!feedback || typeof feedback !== 'object' || typeof feedback.id !== 'string' || !Array.isArray(feedback.books)) {
            throw new Error('The feedback service returned an invalid feedback record.');
        }
        const accountId = typeof feedback.userId === 'string' ? feedback.userId.trim() : '';
        const key = accountId ? `account:${accountId}` : `feedback:${feedback.id}`;
        if (!threads.has(key)) {
            threads.set(key, {
                key,
                accountId,
                name: String(feedback.name || 'အမည်မရှိ'),
                phone: String(feedback.phone || ''),
                messages: []
            });
        }
        threads.get(key).messages.push(feedback);
    }

    return [...threads.values()]
        .map((thread) => {
            thread.messages.sort((left, right) =>
                (parseFeedbackDate(left.createdAt || left.submittedAt)?.getTime() || 0) -
                (parseFeedbackDate(right.createdAt || right.submittedAt)?.getTime() || 0)
            );
            thread.latestMessage = thread.messages[thread.messages.length - 1];
            return thread;
        })
        .sort((left, right) =>
            (parseFeedbackDate(right.latestMessage.createdAt || right.latestMessage.submittedAt)?.getTime() || 0) -
            (parseFeedbackDate(left.latestMessage.createdAt || left.latestMessage.submittedAt)?.getTime() || 0)
        );
}

function createFeedbackAvatar(name, className) {
    const avatar = document.createElement('span');
    avatar.className = className;
    avatar.textContent = name.trim().charAt(0).toUpperCase() || '?';
    return avatar;
}

function renderFeedbackThread(thread) {
    const button = document.createElement('button');
    button.className = 'feedback-thread-button';
    button.type = 'button';
    button.dataset.threadKey = thread.key;
    button.setAttribute('aria-pressed', String(thread.key === activeThreadKey));
    button.addEventListener('click', () => openFeedbackThread(thread.key));

    const name = thread.name;
    const copy = document.createElement('span');
    copy.className = 'feedback-thread-copy';
    appendFeedbackText(copy, 'strong', name, 'feedback-thread-name');
    appendFeedbackText(copy, 'span', feedbackPreview(thread.latestMessage), 'feedback-thread-preview');
    const date = document.createElement('time');
    date.className = 'feedback-thread-date';
    date.textContent = formatFeedbackDate(thread.latestMessage.createdAt || thread.latestMessage.submittedAt);
    const parsedDate = parseFeedbackDate(thread.latestMessage.createdAt || thread.latestMessage.submittedAt);
    if (parsedDate) date.dateTime = parsedDate.toISOString();

    const count = document.createElement('span');
    count.className = 'feedback-thread-count';
    count.textContent = String(thread.messages.length);
    count.setAttribute('aria-label', `${thread.messages.length} ${thread.messages.length === 1 ? 'message' : 'messages'}`);
    button.append(createFeedbackAvatar(name, 'feedback-thread-avatar'), copy, date, count);
    return button;
}

function renderMessageContent(message) {
    if (!message || typeof message !== 'object' || !Array.isArray(message.books)) {
        throw new Error('The feedback service returned an invalid feedback record.');
    }

    const content = document.createElement('div');
    content.className = 'feedback-message-content';
    message.books.forEach((book) => {
        if (!book || typeof book !== 'object') {
            throw new Error('The feedback service returned an invalid book recommendation.');
        }
        const section = document.createElement('section');
        section.className = 'feedback-message-book';
        const bookName = (window.AdminBooks || []).find((item) => item.id === book.id)?.name ||
            String(book.id || 'စာအုပ်');
        appendFeedbackText(section, 'h3', bookName);
        const rating = Number(book.rating);
        if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
            appendFeedbackText(section, 'p', `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} (${rating}/5)`, 'feedback-stars');
        }
        if (book.suggestion) appendFeedbackText(section, 'p', String(book.suggestion));
        content.append(section);
    });
    if (message.otherSuggestion) {
        const other = document.createElement('section');
        other.className = 'feedback-message-other';
        appendFeedbackText(other, 'h3', 'အခြားအကြံပြုချက်');
        appendFeedbackText(other, 'p', String(message.otherSuggestion));
        content.append(other);
    }

    if (!content.childElementCount) {
        appendFeedbackText(content, 'p', 'Feedback submitted.', 'feedback-message-fallback');
    }
    return content;
}

function renderConversation(thread) {
    feedbackConversation.replaceChildren();
    feedbackConversation.classList.toggle('has-thread', Boolean(thread));
    if (!thread) {
        const empty = document.createElement('div');
        empty.className = 'feedback-conversation-empty';
        appendFeedbackText(empty, 'i', '', 'fa-regular fa-comments');
        appendFeedbackText(empty, 'strong', 'Select a customer to view the conversation.');
        appendFeedbackText(empty, 'span', 'New feedback from the same account will appear in this thread.');
        feedbackConversation.append(empty);
        return;
    }

    const header = document.createElement('header');
    header.className = 'feedback-conversation-header';
    const back = document.createElement('button');
    back.className = 'feedback-conversation-back';
    back.type = 'button';
    back.setAttribute('aria-label', 'Back to feedback inbox');
    const backIcon = document.createElement('i');
    backIcon.className = 'fa-solid fa-arrow-left';
    back.append(backIcon);
    back.addEventListener('click', closeFeedbackThread);

    const identity = document.createElement('div');
    identity.className = 'feedback-conversation-identity';
    identity.append(createFeedbackAvatar(thread.name, 'feedback-conversation-avatar'));
    const identityCopy = document.createElement('div');
    identityCopy.className = 'feedback-conversation-copy';
    appendFeedbackText(identityCopy, 'strong', thread.name);
    appendFeedbackText(identityCopy, 'span', feedbackRole(thread.latestMessage));
    header.append(back, identity);
    identity.append(identityCopy);

    const contact = document.createElement('div');
    contact.className = 'feedback-conversation-contact';
    if (thread.phone) {
        const phone = document.createElement('a');
        phone.href = `tel:${thread.phone.replace(/[^\d+]/g, '')}`;
        phone.textContent = thread.phone;
        contact.append(phone);
    }
    appendFeedbackText(
        contact,
        'span',
        thread.accountId ? `Account ID: ${thread.accountId}` : 'Account ID unavailable'
    );
    header.append(contact);

    const timeline = document.createElement('div');
    timeline.className = 'feedback-message-timeline';
    thread.messages.forEach((message) => {
        const bubble = document.createElement('article');
        bubble.className = 'feedback-message-bubble';
        appendFeedbackText(bubble, 'span', 'Customer feedback', 'feedback-message-label');
        bubble.append(renderMessageContent(message));
        const submittedAt = message.createdAt || message.submittedAt;
        if (submittedAt) {
            const time = appendFeedbackText(bubble, 'time', formatFeedbackDate(submittedAt), 'feedback-message-time');
            const parsedDate = parseFeedbackDate(submittedAt);
            time.dateTime = parsedDate ? parsedDate.toISOString() : String(submittedAt);
        }
        timeline.append(bubble);
    });

    feedbackConversation.append(header, timeline);
    requestAnimationFrame(() => { timeline.scrollTop = timeline.scrollHeight; });
}

function renderFeedbackList() {
    feedbackList.replaceChildren();
    if (!feedbackThreads.length) {
        appendFeedbackText(feedbackList, 'div', 'အကြံပြုစာ မရှိသေးပါ။', 'feedback-inbox-empty');
        return;
    }
    feedbackThreads.forEach((thread) => feedbackList.append(renderFeedbackThread(thread)));
}

function openFeedbackThread(threadKey) {
    activeThreadKey = threadKey;
    feedbackInbox.classList.add('has-active-thread');
    renderFeedbackList();
    const thread = feedbackThreads.find((item) => item.key === activeThreadKey);
    renderConversation(thread || null);
}

function closeFeedbackThread() {
    activeThreadKey = null;
    feedbackInbox.classList.remove('has-active-thread');
    renderFeedbackList();
    renderConversation(null);
}

async function loadFeedback(button) {
    if (button) button.disabled = true;
    feedbackAdminStatus.classList.remove('error');
    if (!feedbackThreads.length) {
        feedbackAdminStatus.textContent = 'Loading feedback…';
        appendFeedbackText(feedbackList, 'div', 'Loading messages…', 'feedback-inbox-empty');
    }
    try {
        const feedback = await AdminApi.getFeedback();
        feedbackThreads = groupFeedback(feedback);
        if (!feedbackThreads.some((thread) => thread.key === activeThreadKey)) {
            activeThreadKey = null;
            feedbackInbox.classList.remove('has-active-thread');
        }
        renderFeedbackList();
        renderConversation(feedbackThreads.find((thread) => thread.key === activeThreadKey) || null);
        const messageCount = feedbackThreads.reduce((total, thread) => total + thread.messages.length, 0);
        feedbackAdminStatus.textContent = `${feedbackThreads.length.toLocaleString('en-US')} ${feedbackThreads.length === 1 ? 'account' : 'accounts'} · ${messageCount.toLocaleString('en-US')} ${messageCount === 1 ? 'message' : 'messages'}`;
    } catch (error) {
        console.error('Unable to load customer feedback.', error);
        feedbackAdminStatus.textContent = 'အကြံပြုစာစာရင်းကို ရယူမရပါ။ ပြန်လည်စမ်းကြည့်ပါ။';
        feedbackAdminStatus.classList.add('error');
        if (!feedbackThreads.length) {
            feedbackList.replaceChildren();
            appendFeedbackText(feedbackList, 'div', 'Feedback could not be loaded. Check the connection and try again.', 'feedback-inbox-empty error');
            renderConversation(null);
        }
    } finally {
        if (button) button.disabled = false;
    }
}

feedbackRefresh.addEventListener('click', () => loadFeedback(feedbackRefresh));
renderConversation(null);
loadFeedback();
