// Profile requests use the shared Vercel API instead of the Sheets service.

function normalizePhoneNumber(value) {
    return String(value ?? '')
        .replace(/[၀-၉]/g, (digit) => String(digit.charCodeAt(0) - '၀'.charCodeAt(0)))
        .replace(/\D/g, '');
}

function formatPhoneNumber(value) {
    const digits = normalizePhoneNumber(value);
    if (!digits || digits.length !== 11 || digits[0] !== '0') return digits;
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`;
}

async function sendProfileRequest(action, profile) {
    if (action === 'lookup') return physicsApiFetch('auth/me', { method: 'GET' });
    if (action === 'create') return physicsApiFetch('auth/signup', { method: 'POST', body: JSON.stringify(profile) });
    if (action === 'login') return physicsApiFetch('auth/login', { method: 'POST', body: JSON.stringify(profile) });
    if (action === 'logout') return physicsApiFetch('auth/logout', { method: 'POST', body: '{}' });
    if (action === 'update') return physicsApiFetch('profile', { method: 'PATCH', body: JSON.stringify(profile) });
    if (action === 'changePassword') return physicsApiFetch('profile/password', { method: 'PATCH', body: JSON.stringify(profile) });
    if (action === 'deleteAccount') return physicsApiFetch('profile', { method: 'DELETE', body: JSON.stringify(profile) });
    if (action === 'submitFeedback') return physicsApiFetch('feedback', { method: 'POST', body: JSON.stringify(profile) });
    if (action === 'listDiscussionMessages') return physicsApiFetch('discussion/messages', { method: 'GET' });
    if (action === 'sendDiscussionMessage') return physicsApiFetch('discussion/messages', { method: 'POST', body: JSON.stringify(profile) });
    if (action === 'editDiscussionMessage') return physicsApiFetch(`discussion/messages/${encodeURIComponent(profile.messageId)}`, { method: 'PATCH', body: JSON.stringify(profile) });
    throw new Error('This profile action has not been migrated to the database API yet.');
}

async function findProfileByPhone(phone) {
    return sendProfileRequest('lookup', { phone });
}
