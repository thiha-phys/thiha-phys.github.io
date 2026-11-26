const discussionMessages = document.getElementById('discussion-messages');
const discussionForm = document.getElementById('discussion-form');
const discussionInput = document.getElementById('discussion-input');
const discussionStatus = document.getElementById('discussion-status');
const discussionSendButton = document.getElementById('discussion-send');
const discussionRefreshButton = document.getElementById('discussion-refresh');
const discussionCharacterCount = document.getElementById('discussion-character-count');
let currentMessages = [];
let loadingMessages = false;
let messageLoadVersion = 0;
let sendingMessage = false;
let editingMessageId = null;

function appendDiscussionText(parent, tagName, text, className) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text;
    parent.append(element);
    return element;
}

function formatDiscussionDate(value) {
    const date = new Date(String(value || '').replace(' ', 'T'));
    return Number.isNaN(date.getTime())
        ? String(value || '')
        : new Intl.DateTimeFormat('my-MM', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function setDiscussionStatus(message, success = false) {
    discussionStatus.textContent = message;
    discussionStatus.classList.remove('error');
    discussionStatus.classList.toggle('success', success);
}

function renderDiscussionEmpty() {
    const empty = document.createElement('div');
    empty.className = 'discussion-empty';
    appendDiscussionText(empty, 'i', '', 'fa-regular fa-comments');
    appendDiscussionText(empty, 'strong', 'ဆွေးနွေးမှု စတင်နိုင်ပါပြီ။');
    appendDiscussionText(empty, 'span', 'မေးခွန်း သို့မဟုတ် အကြံပြုချက်ကို အောက်မှာ ရေးပို့ပါ။');
    discussionMessages.append(empty);
}

function renderDiscussionEditForm(message) {
    const form = document.createElement('form');
    form.className = 'discussion-edit-form';
    const input = document.createElement('textarea');
    input.maxLength = 4000;
    input.required = true;
    input.value = message.body;
    const actions = document.createElement('div');
    actions.className = 'discussion-edit-actions';
    const cancel = appendDiscussionText(actions, 'button', 'မသိမ်းတော့ပါ', 'discussion-edit-cancel');
    cancel.type = 'button';
    cancel.addEventListener('click', () => {
        editingMessageId = null;
        renderDiscussionMessages();
    });
    const save = appendDiscussionText(actions, 'button', 'သိမ်းရန်', 'discussion-edit-save');
    save.type = 'submit';
    form.append(input, actions);
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const body = input.value.trim();
        if (!body) {
            setDiscussionStatus('စာသားကို ဗလာမထားပါနှင့်။');
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
                throw new Error('ပြင်ဆင်ထားသောစာကို ဆာဗာမှ အတည်မပြုနိုင်ပါ။');
            }
            currentMessages = currentMessages.map((item) => item.id === message.id ? result.message : item);
            editingMessageId = null;
            setDiscussionStatus('စာကို ပြင်ဆင်ပြီးပါပြီ။', true);
            renderDiscussionMessages();
        } catch (error) {
            console.error('Unable to edit the discussion message.', error);
            setDiscussionStatus(`စာကို ပြင်ဆင်၍မရပါ။ ${error.message}`);
            save.disabled = false;
        }
    });
    return form;
}

function renderDiscussionMessage(message) {
    if (!message || typeof message.id !== 'string' || typeof message.body !== 'string' ||
        !['customer', 'admin'].includes(message.senderRole)) {
        throw new Error('ဆွေးနွေးမှုစာရင်းတွင် မမှန်ကန်သောစာ ပါဝင်နေပါသည်။');
    }

    const ownMessage = message.senderRole === 'customer';
    const row = document.createElement('div');
    row.className = `discussion-message-row ${ownMessage ? 'is-customer' : 'is-admin'}`;
    const bubble = document.createElement('article');
    bubble.className = 'discussion-bubble';

    if (editingMessageId === message.id && ownMessage) {
        bubble.append(renderDiscussionEditForm(message));
    } else {
        appendDiscussionText(bubble, 'p', message.body, 'discussion-message-body');
        const footer = document.createElement('div');
        footer.className = 'discussion-message-footer';
        if (message.editedAt) appendDiscussionText(footer, 'span', 'ပြင်ဆင်ပြီး', 'discussion-edited');
        appendDiscussionText(footer, 'time', formatDiscussionDate(message.createdAt));
        bubble.append(footer);
        if (ownMessage) {
            const actions = document.createElement('div');
            actions.className = 'discussion-message-actions';
            const edit = appendDiscussionText(actions, 'button', 'ပြင်ရန်', 'discussion-edit-button');
            edit.type = 'button';
            edit.addEventListener('click', () => {
                messageLoadVersion += 1;
                editingMessageId = message.id;
                setDiscussionStatus('');
                renderDiscussionMessages();
            });
            bubble.append(actions);
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
            throw new Error('ဆာဗာမှ ပြန်လာသောစာရင်း မမှန်ပါ။');
        }
        if (loadVersion !== messageLoadVersion) return;
        currentMessages = result.messages;
        renderDiscussionMessages();
        if (discussionStatus.classList.contains('error')) setDiscussionStatus('');
    } catch (error) {
        console.error('Unable to load discussion messages.', error);
        setDiscussionStatus(`ဆွေးနွေးမှုကို ရယူမရပါ။ ${error.message}`);
        discussionStatus.classList.add('error');
    } finally {
        loadingMessages = false;
        discussionRefreshButton.disabled = false;
    }
}

discussionInput.addEventListener('input', () => {
    discussionCharacterCount.textContent = `${Array.from(discussionInput.value).length}/4000`;
});

discussionForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = discussionInput.value.trim();
    if (!body) {
        setDiscussionStatus('ပို့မည့်စာကို ရေးပါ။');
        discussionInput.focus();
        return;
    }
    sendingMessage = true;
    discussionSendButton.disabled = true;
    try {
        const result = await sendProfileRequest('sendDiscussionMessage', { body });
        if (!result.message || typeof result.message.id !== 'string') {
            throw new Error('ပို့ထားသောစာကို ဆာဗာမှ အတည်မပြုနိုင်ပါ။');
        }
        messageLoadVersion += 1;
        currentMessages.push(result.message);
        discussionForm.reset();
        discussionCharacterCount.textContent = '0/4000';
        setDiscussionStatus('စာပို့ပြီးပါပြီ။', true);
        renderDiscussionMessages();
    } catch (error) {
        console.error('Unable to send a discussion message.', error);
        setDiscussionStatus(`စာပို့၍မရပါ။ ${error.message}`);
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
