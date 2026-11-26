const discussionMessages = document.getElementById('discussion-messages');
const discussionForm = document.getElementById('discussion-form');
const discussionInput = document.getElementById('discussion-input');
const discussionError = document.getElementById('discussion-error');
const discussionSendButton = document.getElementById('discussion-send');
const discussionRefreshButton = document.getElementById('discussion-refresh');
let currentMessages = [];
let loadingMessages = false;
let messageLoadVersion = 0;
let sendingMessage = false;
let editingMessageId = null;
let selectedMessageId = null;

function appendDiscussionText(parent, tagName, text, className) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text;
    parent.append(element);
    return element;
}

function formatDiscussionDate(value) {
    const date = new Date(String(value || '').replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return String(value || '');
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

function showDiscussionError(message) {
    discussionError.textContent = message;
    discussionError.hidden = !message;
}

function renderDiscussionEmpty() {
    const empty = document.createElement('div');
    empty.className = 'discussion-empty';
    appendDiscussionText(empty, 'i', '', 'fa-regular fa-comments');
    appendDiscussionText(empty, 'strong', 'ဆွေးနွေးမှု စတင်နိုင်ပါပြီ။');
    appendDiscussionText(empty, 'span', 'မေးခွန်း သို့မဟုတ် အကြံပြုချက်ကို ပေးပို့နိုင်ပါတယ်။');
    discussionMessages.append(empty);
}

function renderDiscussionEditForm(message) {
    const form = document.createElement('form');
    form.className = 'discussion-edit-form';
    const input = document.createElement('textarea');
    input.maxLength = 4000;
    input.required = true;
    input.value = message.body;
    input.setAttribute('aria-label', 'Edit message');

    const actions = document.createElement('div');
    actions.className = 'discussion-edit-actions';
    const cancel = appendDiscussionText(actions, 'button', 'Cancel', 'discussion-edit-cancel');
    cancel.type = 'button';
    cancel.addEventListener('click', () => {
        editingMessageId = null;
        selectedMessageId = null;
        renderDiscussionMessages();
    });
    const save = appendDiscussionText(actions, 'button', 'Save', 'discussion-edit-save');
    save.type = 'submit';
    form.append(input, actions);
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const body = input.value.trim();
        if (!body) {
            showDiscussionError('Enter a message before saving.');
            input.focus();
            return;
        }
        save.disabled = true;
        try {
            const result = await sendProfileRequest('editDiscussionMessage', {
                messageId: message.id,
                body
            });
            if (!result.message || result.message.id !== message.id) {
                throw new Error('The server could not confirm the updated message.');
            }
            currentMessages = currentMessages.map((item) => item.id === message.id ? result.message : item);
            editingMessageId = null;
            selectedMessageId = null;
            showDiscussionError('');
            renderDiscussionMessages();
        } catch (error) {
            console.error('Unable to edit the discussion message.', error);
            showDiscussionError('Could not save the message. Please try again.');
            save.disabled = false;
        }
    });
    return form;
}

function addOwnMessageSelectionHandlers(bubble, messageId) {
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
            selectedMessageId = messageId;
            renderDiscussionMessages();
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
        if (selectedMessageId) {
            selectedMessageId = null;
            renderDiscussionMessages();
        }
    });
}

function renderDiscussionMessage(message) {
    if (!message || typeof message.id !== 'string' || typeof message.body !== 'string' ||
        !['customer', 'admin'].includes(message.senderRole)) {
        throw new Error('The discussion list contains an invalid message.');
    }

    const ownMessage = message.senderRole === 'customer';
    const row = document.createElement('div');
    row.className = `discussion-message-row ${ownMessage ? 'is-customer' : 'is-admin'}`;
    const bubble = document.createElement('article');
    bubble.className = 'discussion-bubble';
    bubble.classList.toggle('is-selected', selectedMessageId === message.id);

    if (ownMessage && editingMessageId === message.id) {
        bubble.append(renderDiscussionEditForm(message));
    } else {
        appendDiscussionText(bubble, 'p', message.body, 'discussion-message-body');
        const footer = document.createElement('div');
        footer.className = 'discussion-message-footer';
        const time = appendDiscussionText(footer, 'time', formatDiscussionDate(message.createdAt));
        const date = new Date(String(message.createdAt || '').replace(' ', 'T'));
        if (!Number.isNaN(date.getTime())) time.dateTime = date.toISOString();
        bubble.append(footer);

        if (ownMessage) {
            addOwnMessageSelectionHandlers(bubble, message.id);
            if (selectedMessageId === message.id) {
                const actions = document.createElement('div');
                actions.className = 'discussion-message-actions';
                const edit = appendDiscussionText(actions, 'button', 'Edit', 'discussion-edit-button');
                edit.type = 'button';
                edit.addEventListener('click', () => {
                    messageLoadVersion += 1;
                    editingMessageId = message.id;
                    renderDiscussionMessages();
                });
                bubble.append(actions);
            }
        }
    }
    row.append(bubble);
    return row;
}

function renderDiscussionMessages() {
    discussionMessages.replaceChildren();
    if (!currentMessages.length) {
        renderDiscussionEmpty();
        return;
    }
    currentMessages.forEach((message) => discussionMessages.append(renderDiscussionMessage(message)));
    discussionMessages.scrollTop = discussionMessages.scrollHeight;
}

async function loadDiscussionMessages() {
    if (loadingMessages || sendingMessage || editingMessageId) return;
    loadingMessages = true;
    const loadVersion = ++messageLoadVersion;
    discussionRefreshButton.disabled = true;
    try {
        const result = await sendProfileRequest('listDiscussionMessages', {});
        if (!Array.isArray(result.messages)) {
            throw new Error('The server returned an invalid message list.');
        }
        if (loadVersion !== messageLoadVersion) return;
        currentMessages = result.messages;
        renderDiscussionMessages();
        showDiscussionError('');
    } catch (error) {
        if (loadVersion !== messageLoadVersion) return;
        console.error('Unable to load discussion messages.', error);
        showDiscussionError('Could not load messages. Check your connection and try again.');
    } finally {
        loadingMessages = false;
        discussionRefreshButton.disabled = false;
    }
}

discussionForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = discussionInput.value.trim();
    if (!body) {
        showDiscussionError('Write a message before sending.');
        discussionInput.focus();
        return;
    }
    sendingMessage = true;
    discussionSendButton.disabled = true;
    try {
        const result = await sendProfileRequest('sendDiscussionMessage', { body });
        if (!result.message || typeof result.message.id !== 'string') {
            throw new Error('The server could not confirm the sent message.');
        }
        messageLoadVersion += 1;
        currentMessages.push(result.message);
        discussionForm.reset();
        selectedMessageId = null;
        showDiscussionError('');
        renderDiscussionMessages();
    } catch (error) {
        console.error('Unable to send a discussion message.', error);
        showDiscussionError('Could not send the message. Please try again.');
    } finally {
        sendingMessage = false;
        discussionSendButton.disabled = false;
        discussionInput.focus();
    }
});

discussionRefreshButton.addEventListener('click', loadDiscussionMessages);
loadDiscussionMessages();
window.setInterval(() => {
    if (document.visibilityState === 'visible') loadDiscussionMessages();
}, 30000);
