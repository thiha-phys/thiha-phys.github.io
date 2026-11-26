const requestList = document.getElementById('reset-request-list');
const requestCount = document.getElementById('request-count');

function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function formatRequestDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString();
}

function renderResetCode(code, expiresAt) {
    const panel = makeElement('div', 'reset-code-panel');
    const label = makeElement('label', '', 'One-time reset code');
    const row = makeElement('div', 'reset-code-row');
    const input = document.createElement('input');
    input.type = 'text';
    input.readOnly = true;
    input.value = code;
    input.setAttribute('aria-label', 'One-time reset code');
    const copyButton = makeElement('button', 'copy-code', 'Copy code');
    copyButton.type = 'button';
    const help = makeElement('p', 'reset-code-help', `Valid until ${formatRequestDate(expiresAt)}. Give this code only to the customer after verifying their registered phone.`);
    const copyStatus = makeElement('p', 'reset-copy-status', '');
    copyStatus.setAttribute('role', 'status');
    copyButton.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(code);
            copyStatus.textContent = 'Code copied. Share it only through the verified contact.';
        } catch (error) {
            input.focus();
            input.select();
            copyStatus.textContent = 'Clipboard access is unavailable; the code is selected so you can copy it manually.';
        }
    });
    row.append(input, copyButton);
    panel.append(label, row, help, copyStatus);
    return panel;
}

function renderRequest(request) {
    const card = makeElement('article', 'reset-card');
    const heading = makeElement('h2', '', request.name || 'Unnamed account');
    const status = makeElement('span', 'reset-status', request.status);
    const meta = makeElement('div', 'reset-meta');
    const phone = String(request.phone || '');
    const phoneLink = makeElement('a', '', phone || 'No registered phone');
    phoneLink.href = phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : '#';
    const requested = makeElement('span', '', `Requested: ${formatRequestDate(request.requestedAt)}`);
    meta.append(phoneLink);
    if (request.email) meta.append(makeElement('span', '', `Email: ${request.email}`));
    meta.append(requested);
    const actions = makeElement('div', 'reset-actions');
    const issueButton = makeElement('button', 'reset-issue', request.status === 'approved' ? 'Issue / regenerate code' : 'Verify & issue code');
    issueButton.type = 'button';
    const rejectButton = makeElement('button', 'reset-reject', 'Reject request');
    rejectButton.type = 'button';
    const feedback = makeElement('p', 'reset-copy-status', '');
    feedback.setAttribute('role', 'status');
    actions.append(issueButton, rejectButton);
    card.append(heading, status, meta, actions, feedback);

    issueButton.addEventListener('click', async () => {
        if (request.status === 'approved' && !window.confirm('Issuing a new code will invalidate any previous code. Continue?')) return;
        issueButton.disabled = true;
        rejectButton.disabled = true;
        feedback.textContent = 'Generating a short-lived reset code…';
        try {
            const result = await AdminApi.reviewPasswordResetRequest(request.id, 'issue');
            request.status = 'approved';
            status.textContent = 'approved';
            issueButton.textContent = 'Issue / regenerate code';
            card.querySelector('.reset-code-panel')?.remove();
            card.append(renderResetCode(result.resetCode, result.expiresAt));
            feedback.textContent = '';
        } catch (error) {
            console.error('Unable to issue a reset code.', error);
            feedback.textContent = error.message || 'The reset code could not be issued.';
            feedback.classList.add('reset-error');
        } finally {
            issueButton.disabled = false;
            rejectButton.disabled = false;
        }
    });

    rejectButton.addEventListener('click', async () => {
        if (!window.confirm(`Reject the password reset request for ${request.name || 'this account'}?`)) return;
        issueButton.disabled = true;
        rejectButton.disabled = true;
        try {
            await AdminApi.reviewPasswordResetRequest(request.id, 'reject');
            await loadRequests();
        } catch (error) {
            console.error('Unable to reject a reset request.', error);
            feedback.textContent = error.message || 'The reset request could not be rejected.';
            feedback.classList.add('reset-error');
            issueButton.disabled = false;
            rejectButton.disabled = false;
        }
    });
    return card;
}

async function loadRequests() {
    requestList.replaceChildren(makeElement('div', 'reset-empty', 'Loading requests…'));
    try {
        const requests = await AdminApi.getPasswordResetRequests();
        requestCount.textContent = String(requests.length);
        if (!requests.length) {
            requestList.replaceChildren(makeElement('div', 'reset-empty', 'No active password reset requests.'));
            return;
        }
        requestList.replaceChildren(...requests.map(renderRequest));
    } catch (error) {
        console.error('Unable to load password reset requests.', error);
        requestCount.textContent = '0';
        const message = makeElement('div', 'reset-empty reset-error', error.message || 'Requests could not be loaded. Reopen this page to try again.');
        requestList.replaceChildren(message);
    }
}

loadRequests();
