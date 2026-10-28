const PROFILE_API_URL = 'https://script.google.com/macros/s/AKfycbzIdbnosK3NE_RItCHF-JFD-Olz4CJ0tBqrANyU4ORfHRZYxVgvAkQhMTNeAH3ZQRvz7A/exec';

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
    const response = await fetch(PROFILE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ action, profile })
    });
    if (!response.ok) {
        throw new Error(`Account service request failed (${response.status}).`);
    }
    const result = await response.json();
    if (!result.ok) {
        const error = new Error(result.message || result.error || 'The account service rejected the request.');
        error.code = result.error || 'ACCOUNT_REQUEST_FAILED';
        throw error;
    }
    return result;
}

async function findProfileByPhone(phone) {
    return sendProfileRequest('lookup', { phone });
}
