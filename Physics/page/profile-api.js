const FIREBASE_DATABASE_URL = 'https://thkapp-305-default-rtdb.firebaseio.com';

function normalizePhoneNumber(value) {
    const digits = String(value ?? '')
        .replace(/[၀-၉]/g, (digit) => String(digit.charCodeAt(0) - '၀'.charCodeAt(0)))
        .replace(/\D/g, '');
    return digits;
}

function formatPhoneNumber(value) {
    const digits = normalizePhoneNumber(value);
    if (!digits || digits.length !== 11 || digits[0] !== '0') {
        return digits;
    }
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 11)}`;
}

function normalizeProfileForStorage(profile) {
    const rawProfile = profile || {};
    const name = String(rawProfile.name ?? rawProfile.fullName ?? '').trim();
    const job = String(rawProfile.job ?? rawProfile.occupation ?? '').trim();
    const email = String(rawProfile.email ?? '').trim();
    const phone = normalizePhoneNumber(rawProfile.phone);

    if (!name) {
        throw new Error('Name is required.');
    }
    if (!phone) {
        throw new Error('Phone is required.');
    }
    return {
        name,
        job,
        email,
        phone: formatPhoneNumber(phone)
    };
}

function getFirebasePath(path) {
    if (!FIREBASE_DATABASE_URL) {
        throw new Error('Firebase database URL is not configured.');
    }
    const cleanPath = String(path || '').replace(/^\/+/, '').replace(/\.json$/, '');
    const base = FIREBASE_DATABASE_URL.endsWith('/') ? FIREBASE_DATABASE_URL.slice(0, -1) : FIREBASE_DATABASE_URL;
    const url = new URL(`${base}/${cleanPath}.json`);
    return url.toString();
}

async function firebaseRequest(path, options = {}) {
    const response = await fetch(getFirebasePath(path), {
        method: options.method || 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Firebase request failed (${response.status}): ${text || 'Unknown error'}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        return null;
    }

    return response.json();
}

async function sendProfileToFirebase(action, profile) {
    if (action === 'lookup') {
        const targetPhone = normalizePhoneNumber(profile.phone);
        if (!targetPhone) {
            throw new Error('Phone is required.');
        }
        const record = await firebaseRequest(`profiles/${targetPhone}`);
        if (record == null) {
            const error = new Error('No profile was found for this phone number.');
            error.code = 'PHONE_NOT_FOUND';
            throw error;
        }

        return {
            ok: true,
            action: 'found',
            profile: {
                name: record.name || '',
                job: record.job || '',
                email: record.email || '',
                phone: formatPhoneNumber(record.phone || targetPhone)
            }
        };
    }

    const normalizedProfile = normalizeProfileForStorage(profile);
    const lookupPhone = action === 'update' && profile.lookupPhone
        ? normalizePhoneNumber(profile.lookupPhone)
        : normalizePhoneNumber(normalizedProfile.phone);

    if (action === 'create') {
        const targetPhone = normalizePhoneNumber(normalizedProfile.phone);
        const existing = await firebaseRequest(`profiles/${targetPhone}`);
        if (existing != null) {
            const error = new Error('A profile with this phone number already exists.');
            error.code = 'PHONE_EXISTS';
            throw error;
        }

        const record = {
            ...normalizedProfile,
            phone: formatPhoneNumber(targetPhone),
            createdAt: new Date().toISOString()
        };

        await firebaseRequest(`profiles/${targetPhone}`, {
            method: 'PUT',
            body: record
        });

        return { ok: true, action: 'created', profile: normalizedProfile };
    }

    if (action === 'update') {
        const targetPhone = normalizePhoneNumber(normalizedProfile.phone);
        const existing = await firebaseRequest(`profiles/${lookupPhone}`);
        if (existing == null) {
            const error = new Error('No profile was found for this phone number.');
            error.code = 'PHONE_NOT_FOUND';
            throw error;
        }

        if (targetPhone !== lookupPhone) {
            const newPhoneRecord = await firebaseRequest(`profiles/${targetPhone}`);
            if (newPhoneRecord != null) {
                const error = new Error('Another profile already uses the new phone number.');
                error.code = 'PHONE_EXISTS';
                throw error;
            }

            await firebaseRequest(`profiles/${targetPhone}`, {
                method: 'PUT',
                body: {
                    ...normalizedProfile,
                    phone: formatPhoneNumber(targetPhone),
                    updatedAt: new Date().toISOString()
                }
            });
            await firebaseRequest(`profiles/${lookupPhone}`, { method: 'DELETE' });
            return { ok: true, action: 'updated', profile: normalizedProfile };
        }

        await firebaseRequest(`profiles/${lookupPhone}`, {
            method: 'PUT',
            body: {
                ...existing,
                ...normalizedProfile,
                phone: formatPhoneNumber(targetPhone),
                updatedAt: new Date().toISOString()
            }
        });

        return { ok: true, action: 'updated', profile: normalizedProfile };
    }

    throw new Error('Unsupported Firebase action.');
}

async function sendFeedbackToFirebase(profile) {
    const phone = normalizePhoneNumber(profile.phone);
    const payload = {
        phone: formatPhoneNumber(phone),
        job: profile.job,
        books: profile.books,
        otherSuggestion: profile.otherSuggestion || '',
        submittedAt: new Date().toISOString()
    };

    const recordId = `${phone}_${Date.now()}`;
    await firebaseRequest(`recommendations/${recordId}`, {
        method: 'PUT',
        body: payload
    });

    return {
        ok: true,
        action: 'submitted',
        profile: { name: '', phone: formatPhoneNumber(phone) }
    };
}

async function sendProfileRequest(action, profile) {
    if (action === 'submitFeedback') {
        return sendFeedbackToFirebase(profile);
    }
    if (action === 'create' || action === 'update' || action === 'lookup') {
        return sendProfileToFirebase(action, profile);
    }
    throw new Error('Unsupported Firebase action.');
}

async function findProfileByPhone(phone) {
    return sendProfileRequest('lookup', { phone });
}
