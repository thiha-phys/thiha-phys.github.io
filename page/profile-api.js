const FIREBASE_DATABASE_URL = 'https://thkapp-305-default-rtdb.firebaseio.com';
const PROFILE_SYNC_API_URL = 'https://script.google.com/macros/s/AKfycbxDZZPRoaH6B-xham9WqBOJYvhvrz5RNUrMr7c5IkxRGqw2QfAy7VZdEZi-mpq6mrpQ0w/exec';

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

function getFirebasePath(path, session) {
    if (!FIREBASE_DATABASE_URL) {
        throw new Error('Firebase database URL is not configured.');
    }
    const cleanPath = String(path || '').replace(/^\/+/, '').replace(/\.json$/, '');
    const base = FIREBASE_DATABASE_URL.endsWith('/') ? FIREBASE_DATABASE_URL.slice(0, -1) : FIREBASE_DATABASE_URL;
    const url = new URL(`${base}/${cleanPath}.json`);
    if (session?.idToken) {
        url.searchParams.set('auth', session.idToken);
    }
    return url.toString();
}

async function firebaseRequest(path, options = {}) {
    const session = options.session || await getFirebaseOrderSession();
    const response = await fetch(getFirebasePath(path, session), {
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

async function syncFirebaseRecordToSheet(action, recordId, session) {
    try {
        const response = await fetch(PROFILE_SYNC_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body: JSON.stringify({ action, recordId, idToken: session.idToken })
        });
        if (!response.ok) {
            throw new Error(`Profile sync request failed (${response.status}).`);
        }
        const result = await response.json();
        if (!result.ok) throw new Error(result.error || 'Apps Script could not sync the Firebase record.');
        return { syncPending: false };
    } catch (error) {
        console.warn('Firebase record saved; Sheet sync is pending.', error);
        return { syncPending: true, syncError: error.message };
    }
}

async function sendProfileToFirebase(action, profile) {
    const session = await getFirebaseOrderSession();
    if (action === 'lookup') {
        const targetPhone = normalizePhoneNumber(profile.phone);
        if (!targetPhone) {
            throw new Error('Phone is required.');
        }
        const record = await firebaseRequest(`profiles/${targetPhone}`, { session });
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
        const existing = await firebaseRequest(`profiles/${targetPhone}`, { session });
        if (existing != null) {
            const error = new Error('A profile with this phone number already exists.');
            error.code = 'PHONE_EXISTS';
            throw error;
        }

        const record = {
            ...normalizedProfile,
            phone: formatPhoneNumber(targetPhone),
            ownerUid: session.localId,
            syncStatus: 'pending',
            createdAt: new Date().toISOString()
        };

        await firebaseRequest(`profiles/${targetPhone}`, {
            method: 'PUT',
            body: record,
            session
        });

        const sync = await syncFirebaseRecordToSheet('syncFirebaseProfile', targetPhone, session);
        return { ok: true, action: 'created', profile: normalizedProfile, ...sync };
    }

    if (action === 'update') {
        const targetPhone = normalizePhoneNumber(normalizedProfile.phone);
        const existing = await firebaseRequest(`profiles/${lookupPhone}`, { session });
        if (existing == null) {
            const error = new Error('No profile was found for this phone number.');
            error.code = 'PHONE_NOT_FOUND';
            throw error;
        }

        if (targetPhone !== lookupPhone) {
            const newPhoneRecord = await firebaseRequest(`profiles/${targetPhone}`, { session });
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
                    ownerUid: existing.ownerUid || session.localId,
                    updatedAt: new Date().toISOString(),
                    syncStatus: 'pending',
                    syncPreviousPhone: lookupPhone
                },
                session
            });
            await firebaseRequest(`profiles/${lookupPhone}`, { method: 'DELETE', session });
            const sync = await syncFirebaseRecordToSheet('syncFirebaseProfile', targetPhone, session);
            return { ok: true, action: 'updated', profile: normalizedProfile, ...sync };
        }

        await firebaseRequest(`profiles/${lookupPhone}`, {
            method: 'PUT',
            body: {
                ...existing,
                ...normalizedProfile,
                phone: formatPhoneNumber(targetPhone),
                ownerUid: existing.ownerUid || session.localId,
                updatedAt: new Date().toISOString(),
                syncStatus: 'pending'
            },
            session
        });

        const sync = await syncFirebaseRecordToSheet('syncFirebaseProfile', targetPhone, session);
        return { ok: true, action: 'updated', profile: normalizedProfile, ...sync };
    }

    throw new Error('Unsupported Firebase action.');
}

async function sendFeedbackToFirebase(profile) {
    const session = await getFirebaseOrderSession();
    const phone = normalizePhoneNumber(profile.phone);
    const payload = {
        ownerUid: session.localId,
        name: String(profile.name || '').trim(),
        phone: formatPhoneNumber(phone),
        job: profile.job,
        books: profile.books,
        otherSuggestion: profile.otherSuggestion || '',
        syncStatus: 'pending',
        submittedAt: new Date().toISOString()
    };

    const recordId = `${phone}_${Date.now()}`;
    await firebaseRequest(`recommendations/${recordId}`, {
        method: 'PUT',
        body: payload,
        session
    });
    const sync = await syncFirebaseRecordToSheet('syncFirebaseRecommendation', recordId, session);

    return {
        ok: true,
        action: 'submitted',
        ...sync,
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
