const PROFILE_API_URL = 'https://script.google.com/macros/s/AKfycbxDZZPRoaH6B-xham9WqBOJYvhvrz5RNUrMr7c5IkxRGqw2QfAy7VZdEZi-mpq6mrpQ0w/exec';

async function sendProfileToSheet(action, profile) {
    const response = await fetch(PROFILE_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=UTF-8'
        },
        body: JSON.stringify({ action, profile })
    });

    if (!response.ok) {
        throw new Error(`Google Sheet request failed (${response.status}).`);
    }

    const result = await response.json();
    if (!result.ok) {
        const error = new Error(result.message || result.error || 'Google Sheet rejected the profile.');
        error.code = result.error;
        throw error;
    }

    return result;
}

async function findProfileByPhone(phone) {
    return sendProfileToSheet('lookup', { phone });
}
