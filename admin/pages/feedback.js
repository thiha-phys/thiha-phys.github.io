const feedbackList = document.getElementById('feedback-list');
const feedbackAdminStatus = document.getElementById('feedback-admin-status');
const feedbackConversation = document.getElementById('feedback-conversation');
const feedbackInbox = document.querySelector('.feedback-admin-inbox');
const feedbackRefresh = document.getElementById('feedback-refresh');
let feedbackThreads = [];
let activeThreadKey = null;
let selectedMessageIds = new Set();
let editingMessageId = null;
let replyDraft = '';
let loadingInbox = false;
let inboxReloadRequested = false;

function syncFeedbackViewport() {
    const viewport = window.visualViewport;
    document.documentElement.style.setProperty(
        '--feedback-viewport-height',
        `${viewport?.height || window.innerHeight}px`
    );
    document.documentElement.style.setProperty(
        '--feedback-viewport-top',
        `${viewport?.offsetTop || 0}px`
    );
}

function showFeedbackError(message) {
    const chatError = feedbackConversation.querySelector('.feedback-chat-error');
    if (chatError && activeThreadKey) {
        chatError.textContent = message;
        chatError.hidden = !message;
        return;
    }
    feedbackAdminStatus.textContent = message;
    feedbackAdminStatus.classList.toggle('error', Boolean(message));
}

syncFeedbackViewport();
window.addEventListener('resize', syncFeedbackViewport);
window.visualViewport?.addEventListener('resize', syncFeedbackViewport);
window.visualViewport?.addEventListener('scroll', syncFeedbackViewport);

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
    if (!date) return raw;
    const parts = new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    }).formatToParts(date);
    const part = (type) => parts.find((item) => item.type === type)?.value || '';
    return `${part('day')} ${part('month')} ${part('year')} ${part('hour')}:${part('minute')} ${part('dayPeriod').toUpperCase()}`;
}

function messageSelectionKey(message) {
    return `${message.type}:${message.id}`;
}

function feedbackRole(value) {
    const role = String(value || '').trim().toLowerCase();
    return role === 'teacher' ? 'ဆရာ / ဆရာမ' : role === 'student' ? 'ကျောင်းသား / ကျောင်းသူ' : 'Customer';
}

function feedbackPreview(message) {
    if (message.type === 'discussion') {
        return String(message.data.body || '').replace(/\s+/g, ' ').trim() || 'New message';
    }
    const feedback = message.data;
    const suggestion = feedback.otherSuggestion ||
        feedback.books.find((book) => book && typeof book.suggestion === 'string' && book.suggestion.trim())?.suggestion;
    return suggestion
        ? String(suggestion).replace(/\s+/g, ' ').trim()
        : `${feedback.books.length} book rating${feedback.books.length === 1 ? '' : 's'} submitted`;
}

function groupInbox(feedbackRecords, discussionRecords) {
    if (!Array.isArray(feedbackRecords) || !Array.isArray(discussionRecords)) {
        throw new Error('The feedback or discussion service returned an invalid list.');
    }

    const threads = new Map();
    function getThread(userId, recordId, data) {
        const key = userId ? `account:${userId}` : `feedback:${recordId}`;
        if (!threads.has(key)) {
            threads.set(key, {
                key,
                userId,
                name: String(data.name || 'အမည်မရှိ'),
                phone: String(data.phone || ''),
                job: String(data.job || ''),
                messages: []
            });
        }
        const thread = threads.get(key);
        if (data.name) thread.name = String(data.name);
        if (data.phone) thread.phone = String(data.phone);
        if (data.job || data.occupation) thread.job = String(data.job || data.occupation);
        return thread;
    }

    for (const feedback of feedbackRecords) {
        if (!feedback || typeof feedback !== 'object' || typeof feedback.id !== 'string' || !Array.isArray(feedback.books)) {
            throw new Error('The feedback service returned an invalid feedback record.');
        }
        const userId = typeof feedback.userId === 'string' ? feedback.userId.trim() : '';
        const thread = getThread(userId, feedback.id, feedback);
        thread.messages.push({
            id: feedback.id,
            type: 'feedback',
            senderRole: 'customer',
            createdAt: feedback.createdAt || feedback.submittedAt || '',
            data: feedback
        });
    }

    for (const message of discussionRecords) {
        if (!message || typeof message !== 'object' || typeof message.id !== 'string' ||
            typeof message.userId !== 'string' || typeof message.body !== 'string' ||
            !['customer', 'admin'].includes(message.senderRole)) {
            throw new Error('The discussion service returned an invalid message.');
        }
        const userId = message.userId.trim();
        if (!userId) throw new Error('A discussion message is missing its account association.');
        const thread = getThread(userId, message.id, message);
        thread.messages.push({
            id: message.id,
            type: 'discussion',
            senderRole: message.senderRole,
            createdAt: message.createdAt || '',
            editedAt: message.editedAt || null,
            data: message
        });
    }

    return [...threads.values()]
        .map((thread) => {
            thread.messages.sort((left, right) =>
                (parseFeedbackDate(left.createdAt)?.getTime() || 0) -
                (parseFeedbackDate(right.createdAt)?.getTime() || 0)
            );
            thread.latestMessage = thread.messages[thread.messages.length - 1];
            return thread;
        })
        .sort((left, right) =>
            (parseFeedbackDate(right.latestMessage.createdAt)?.getTime() || 0) -
            (parseFeedbackDate(left.latestMessage.createdAt)?.getTime() || 0)
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
    button.setAttribute('aria-pressed', String(thread.key === activeThreadKey));
    button.addEventListener('click', () => openFeedbackThread(thread.key));

    const copy = document.createElement('span');
    copy.className = 'feedback-thread-copy';
    appendFeedbackText(copy, 'strong', thread.name, 'feedback-thread-name');
    appendFeedbackText(copy, 'span', feedbackPreview(thread.latestMessage), 'feedback-thread-preview');
    const date = appendFeedbackText(button, 'time', formatFeedbackDate(thread.latestMessage.createdAt), 'feedback-thread-date');
    const parsedDate = parseFeedbackDate(thread.latestMessage.createdAt);
    if (parsedDate) date.dateTime = parsedDate.toISOString();

    const count = document.createElement('span');
    count.className = 'feedback-thread-count';
    count.textContent = String(thread.messages.length);
    count.setAttribute('aria-label', `${thread.messages.length} ${thread.messages.length === 1 ? 'message' : 'messages'}`);
    button.append(createFeedbackAvatar(thread.name, 'feedback-thread-avatar'), copy, date, count);
    return button;
}

function renderFeedbackContent(feedback) {
    const content = document.createElement('div');
    content.className = 'feedback-message-content';
    feedback.books.forEach((book) => {
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
    if (feedback.otherSuggestion) {
        const other = document.createElement('section');
        other.className = 'feedback-message-other';
        appendFeedbackText(other, 'h3', 'Other suggestion');
        appendFeedbackText(other, 'p', String(feedback.otherSuggestion));
        content.append(other);
    }
    if (!content.childElementCount) appendFeedbackText(content, 'p', 'Feedback submitted.', 'feedback-message-fallback');
    return content;
}

function renderAdminEditForm(thread, message) {
    const form = document.createElement('form');
    form.className = 'feedback-message-edit-form';
    const textarea = document.createElement('textarea');
    textarea.value = message.data.body;
    textarea.maxLength = 4000;
    textarea.required = true;
    const actions = document.createElement('div');
    actions.className = 'feedback-message-actions';
    const cancel = appendFeedbackText(actions, 'button', 'Cancel', 'feedback-message-action secondary');
    cancel.type = 'button';
    cancel.addEventListener('click', () => {
        editingMessageId = null;
        renderConversation(thread);
    });
    const save = appendFeedbackText(actions, 'button', 'Save', 'feedback-message-action primary');
    save.type = 'submit';
    form.append(textarea, actions);
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const body = textarea.value.trim();
        if (!body) {
            showFeedbackError('Enter a message before saving.');
            textarea.focus();
            return;
        }
        save.disabled = true;
        try {
            await AdminApi.editDiscussionMessage(message.id, body);
            editingMessageId = null;
            await loadFeedback();
        } catch (error) {
            console.error('Unable to edit the discussion message.', error);
            showFeedbackError('Could not save the message. Please try again.');
            save.disabled = false;
        }
    });
    return form;
}

function toggleSelectedMessage(message) {
    const key = messageSelectionKey(message);
    if (selectedMessageIds.has(key)) selectedMessageIds.delete(key);
    else selectedMessageIds.add(key);
}

function addMessageSelectionHandlers(bubble, thread, message) {
    let pressTimer = null;
    let longPressTriggered = false;
    const clearTimer = () => {
        if (pressTimer !== null) window.clearTimeout(pressTimer);
        pressTimer = null;
    };
    bubble.addEventListener('pointerdown', (event) => {
        if (event.target.closest('button,textarea,form')) return;
        longPressTriggered = false;
        pressTimer = window.setTimeout(() => {
            longPressTriggered = true;
            toggleSelectedMessage(message);
            renderConversation(thread);
        }, 550);
    });
    bubble.addEventListener('pointerup', clearTimer);
    bubble.addEventListener('pointercancel', clearTimer);
    bubble.addEventListener('pointerleave', clearTimer);
    bubble.addEventListener('contextmenu', (event) => event.preventDefault());
    bubble.addEventListener('click', (event) => {
        if (event.target.closest('button,textarea,form')) return;
        if (longPressTriggered) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        if (selectedMessageIds.size) {
            toggleSelectedMessage(message);
            renderConversation(thread);
        }
    });
}

function renderDiscussionBubble(thread, message) {
    const row = document.createElement('div');
    row.className = `feedback-chat-row ${message.senderRole === 'admin' ? 'is-admin' : 'is-customer'}`;
    const bubble = document.createElement('article');
    bubble.className = 'feedback-chat-bubble';
    const selectionKey = messageSelectionKey(message);
    const selected = selectedMessageIds.has(selectionKey);
    bubble.classList.toggle('is-selected', selected);
    bubble.setAttribute('aria-selected', String(selected));
    addMessageSelectionHandlers(bubble, thread, message);

    if (editingMessageId === message.id && message.senderRole === 'admin') {
        bubble.append(renderAdminEditForm(thread, message));
    } else {
        appendFeedbackText(
            bubble,
            'span',
            message.senderRole === 'admin' ? 'Admin' : thread.name,
            'feedback-chat-sender'
        );
        appendFeedbackText(bubble, 'p', message.data.body, 'feedback-chat-body');
        const footer = document.createElement('div');
        footer.className = 'feedback-chat-footer';
        if (message.editedAt) appendFeedbackText(footer, 'span', 'edited');
        const time = appendFeedbackText(footer, 'time', formatFeedbackDate(message.createdAt));
        const date = parseFeedbackDate(message.createdAt);
        if (date) time.dateTime = date.toISOString();
        bubble.append(footer);
    }
    row.append(bubble);
    return row;
}

function renderFeedbackBubble(thread, message) {
    const row = document.createElement('div');
    row.className = 'feedback-chat-row is-customer';
    const bubble = document.createElement('article');
    bubble.className = 'feedback-chat-bubble feedback-survey-bubble';
    const selectionKey = messageSelectionKey(message);
    const selected = selectedMessageIds.has(selectionKey);
    bubble.classList.toggle('is-selected', selected);
    bubble.setAttribute('aria-selected', String(selected));
    addMessageSelectionHandlers(bubble, thread, message);
    appendFeedbackText(bubble, 'span', 'Customer feedback', 'feedback-chat-sender');
    bubble.append(renderFeedbackContent(message.data));
    const time = appendFeedbackText(bubble, 'time', formatFeedbackDate(message.createdAt), 'feedback-chat-footer');
    const date = parseFeedbackDate(message.createdAt);
    if (date) time.dateTime = date.toISOString();
    row.append(bubble);
    return row;
}

function renderSelectionToolbar(thread) {
    if (!selectedMessageIds.size) return null;
    const selectedMessages = thread.messages.filter((message) =>
        selectedMessageIds.has(messageSelectionKey(message))
    );
    if (!selectedMessages.length) return null;

    const toolbar = document.createElement('div');
    toolbar.className = 'feedback-selection-toolbar';
    appendFeedbackText(toolbar, 'span', `${selectedMessages.length} selected`);

    if (selectedMessages.length === 1 &&
        selectedMessages[0].type === 'discussion' &&
        selectedMessages[0].senderRole === 'admin') {
        const edit = appendFeedbackText(toolbar, 'button', 'Edit', 'feedback-message-action');
        edit.type = 'button';
        edit.addEventListener('click', () => {
            editingMessageId = selectedMessages[0].id;
            selectedMessageIds.clear();
            renderConversation(thread);
        });
    }

    const remove = appendFeedbackText(toolbar, 'button', 'Delete selected', 'feedback-message-action danger');
    remove.type = 'button';
    remove.addEventListener('click', () => deleteConversationMessages(selectedMessages));
    const cancel = appendFeedbackText(toolbar, 'button', 'Cancel', 'feedback-message-action secondary');
    cancel.type = 'button';
    cancel.addEventListener('click', () => {
        selectedMessageIds.clear();
        renderConversation(thread);
    });
    return toolbar;
}

function renderReplyComposer(thread) {
    const form = document.createElement('form');
    form.className = 'feedback-reply-composer';
    const textarea = document.createElement('textarea');
    textarea.id = 'feedback-reply-input';
    textarea.rows = 1;
    textarea.maxLength = 4000;
    textarea.value = replyDraft;
    textarea.placeholder = 'Write a reply…';
    textarea.setAttribute('aria-label', 'Reply to customer');
    textarea.required = true;
    textarea.addEventListener('input', () => { replyDraft = textarea.value; });
    const send = document.createElement('button');
    send.className = 'feedback-reply-send';
    send.type = 'submit';
    send.setAttribute('aria-label', 'Send reply');
    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-paper-plane';
    icon.setAttribute('aria-hidden', 'true');
    send.append(icon);
    form.append(textarea, send);
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const body = textarea.value.trim();
        if (!body || !thread.userId) {
            showFeedbackError('Enter a message and select a valid customer account.');
            return;
        }
        send.disabled = true;
        try {
            await AdminApi.sendDiscussionReply(thread.userId, body);
            replyDraft = '';
            await loadFeedback();
        } catch (error) {
            console.error('Unable to send the Admin reply.', error);
            showFeedbackError('Could not send the reply. Please try again.');
            send.disabled = false;
        }
    });
    return form;
}

function renderConversation(thread) {
    document.body.classList.toggle('feedback-chat-open', Boolean(thread));
    feedbackConversation.replaceChildren();
    feedbackConversation.classList.toggle('has-thread', Boolean(thread));
    if (!thread) {
        const empty = document.createElement('div');
        empty.className = 'feedback-conversation-empty';
        appendFeedbackText(empty, 'i', '', 'fa-regular fa-comments');
        appendFeedbackText(empty, 'strong', 'Select a customer to open the conversation.');
        appendFeedbackText(empty, 'span', 'Customer messages and Admin replies will appear here.');
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
    appendFeedbackText(identityCopy, 'span', feedbackRole(thread.job));
    identity.append(identityCopy);
    header.append(back, identity);

    const contact = document.createElement('div');
    contact.className = 'feedback-conversation-contact';
    if (thread.phone) {
        const phone = document.createElement('a');
        phone.href = `tel:${thread.phone.replace(/[^\d+]/g, '')}`;
        phone.textContent = thread.phone;
        contact.append(phone);
    }
    header.append(contact);

    const chatError = document.createElement('p');
    chatError.className = 'feedback-chat-error';
    chatError.setAttribute('role', 'alert');
    chatError.hidden = true;

    const timeline = document.createElement('div');
    timeline.className = 'feedback-message-timeline';
    const selectionToolbar = renderSelectionToolbar(thread);
    if (selectionToolbar) timeline.append(selectionToolbar);
    thread.messages.forEach((message) => {
        timeline.append(message.type === 'discussion'
            ? renderDiscussionBubble(thread, message)
            : renderFeedbackBubble(thread, message));
    });

    feedbackConversation.append(header, chatError, timeline);
    if (thread.userId) {
        feedbackConversation.append(renderReplyComposer(thread));
    } else {
        appendFeedbackText(
            feedbackConversation,
            'p',
            'This feedback is not linked to an account, so a private reply is unavailable.',
            'feedback-reply-unavailable'
        );
    }
    requestAnimationFrame(() => { timeline.scrollTop = timeline.scrollHeight; });
}

function renderFeedbackList() {
    feedbackList.replaceChildren();
    if (!feedbackThreads.length) {
        appendFeedbackText(feedbackList, 'div', 'No feedback or discussion messages yet.', 'feedback-inbox-empty');
        return;
    }
    feedbackThreads.forEach((thread) => feedbackList.append(renderFeedbackThread(thread)));
}

function openFeedbackThread(threadKey) {
    if (activeThreadKey !== threadKey) {
        selectedMessageIds.clear();
        editingMessageId = null;
        replyDraft = '';
    }
    activeThreadKey = threadKey;
    feedbackInbox.classList.add('has-active-thread');
    renderFeedbackList();
    renderConversation(feedbackThreads.find((thread) => thread.key === activeThreadKey) || null);
}

function closeFeedbackThread() {
    activeThreadKey = null;
    selectedMessageIds.clear();
    editingMessageId = null;
    replyDraft = '';
    feedbackInbox.classList.remove('has-active-thread');
    renderFeedbackList();
    renderConversation(null);
}

async function deleteConversationMessages(messages) {
    const uniqueMessages = [...new Map(messages.map((message) => [
        messageSelectionKey(message),
        { type: message.type, id: message.id }
    ])).values()];
    if (!uniqueMessages.length) return;
    const confirmed = window.confirm(
        `Permanently delete ${uniqueMessages.length} selected message${uniqueMessages.length === 1 ? '' : 's'}? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
        await AdminApi.deleteConversationMessages(uniqueMessages);
        selectedMessageIds.clear();
        editingMessageId = null;
        await loadFeedback();
    } catch (error) {
        console.error('Unable to delete the selected conversation messages.', error);
        showFeedbackError('Could not delete the selected messages. Please try again.');
    }
}

async function loadFeedback(button) {
    if (loadingInbox) {
        inboxReloadRequested = true;
        return;
    }
    loadingInbox = true;
    if (button) button.disabled = true;
    feedbackAdminStatus.classList.remove('error');
    if (!feedbackThreads.length) {
        feedbackAdminStatus.textContent = 'Loading messages…';
        appendFeedbackText(feedbackList, 'div', 'Loading messages…', 'feedback-inbox-empty');
    }
    try {
        const [feedback, discussionMessages] = await Promise.all([
            AdminApi.getFeedback(),
            AdminApi.getDiscussionMessages()
        ]);
        feedbackThreads = groupInbox(feedback, discussionMessages);
        const activeThread = feedbackThreads.find((thread) => thread.key === activeThreadKey);
        if (!activeThread) {
            activeThreadKey = null;
            selectedMessageIds.clear();
            editingMessageId = null;
            feedbackInbox.classList.remove('has-active-thread');
        } else {
            const activeKeys = new Set(activeThread.messages.map(messageSelectionKey));
            selectedMessageIds = new Set([...selectedMessageIds].filter((key) => activeKeys.has(key)));
        }
        renderFeedbackList();
        renderConversation(feedbackThreads.find((thread) => thread.key === activeThreadKey) || null);
        const messageCount = feedbackThreads.reduce((total, thread) => total + thread.messages.length, 0);
        feedbackAdminStatus.textContent = `${feedbackThreads.length.toLocaleString('en-US')} ${feedbackThreads.length === 1 ? 'account' : 'accounts'} · ${messageCount.toLocaleString('en-US')} ${messageCount === 1 ? 'message' : 'messages'}`;
    } catch (error) {
        console.error('Unable to load customer discussions.', error);
        showFeedbackError('Could not load feedback and discussion messages. Try again.');
        if (!feedbackThreads.length) {
            feedbackList.replaceChildren();
            appendFeedbackText(feedbackList, 'div', 'Messages could not be loaded. Check the connection and database migration.', 'feedback-inbox-empty error');
            renderConversation(null);
        }
    } finally {
        loadingInbox = false;
        if (button) button.disabled = false;
        if (inboxReloadRequested) {
            inboxReloadRequested = false;
            window.setTimeout(() => loadFeedback(), 0);
        }
    }
}

feedbackRefresh.addEventListener('click', () => loadFeedback(feedbackRefresh));
renderConversation(null);
loadFeedback();
window.setInterval(() => {
    if (document.visibilityState === 'visible' && !editingMessageId) loadFeedback();
}, 30000);
