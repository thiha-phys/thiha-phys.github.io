const FIREBASE_ORDER_API_KEY = 'AIzaSyDOEqOTtBACp_IfxjntLsNF97JBiuQDkV8';
const FIREBASE_ORDER_DATABASE_URL = 'https://thkapp-305-default-rtdb.firebaseio.com';
const FIREBASE_ORDER_SESSION_KEY = 'physicsFirebaseAnonymousSession';

function readFirebaseOrderSession() {
    try {
        const session = JSON.parse(localStorage.getItem(FIREBASE_ORDER_SESSION_KEY) || 'null');
        if (session && session.idToken && session.refreshToken && session.expiresAt > Date.now() + 30000) {
            return session;
        }
        return session;
    } catch {
        return null;
    }
}

function saveFirebaseOrderSession(session) {
    const normalizedSession = {
        idToken: session.idToken || session.id_token,
        refreshToken: session.refreshToken || session.refresh_token,
        localId: session.localId || session.user_id,
        expiresAt: Date.now() + Number(session.expiresIn || session.expires_in || 3600) * 1000
    };
    localStorage.setItem(FIREBASE_ORDER_SESSION_KEY, JSON.stringify(normalizedSession));
    return normalizedSession;
}

async function firebaseAuthRequest(url, body, formEncoded = false) {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': formEncoded
                ? 'application/x-www-form-urlencoded;charset=UTF-8'
                : 'application/json'
        },
        body: formEncoded ? new URLSearchParams(body).toString() : JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok) {
        const authError = result.error?.message || '';
        const message = authError.includes('CONFIGURATION_NOT_FOUND')
            ? 'Firebase Authentication ကို မစတင်ရသေးပါ။ Firebase Console > Authentication မှ setup ပြီး Anonymous sign-in ကို ဖွင့်ပါ။'
            : authError.includes('OPERATION_NOT_ALLOWED')
                ? 'Anonymous sign-in ပိတ်ထားပါသည်။ Firebase Console > Authentication > Sign-in method မှ ဖွင့်ပါ။'
                : authError || `Firebase Authentication failed (${response.status}).`;
        const error = new Error(message);
        error.code = authError || 'AUTH_FAILED';
        throw error;
    }
    return result;
}

async function getFirebaseOrderSession() {
    const session = readFirebaseOrderSession();
    if (session?.expiresAt > Date.now() + 30000) {
        return session;
    }

    if (session?.refreshToken) {
        try {
            const refreshed = await firebaseAuthRequest(
                `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(FIREBASE_ORDER_API_KEY)}`,
                { grant_type: 'refresh_token', refresh_token: session.refreshToken },
                true
            );
            return saveFirebaseOrderSession(refreshed);
        } catch (error) {
            localStorage.removeItem(FIREBASE_ORDER_SESSION_KEY);
            if (!session.localId) throw error;
        }
    }

    const created = await firebaseAuthRequest(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(FIREBASE_ORDER_API_KEY)}`,
        { returnSecureToken: true }
    );
    return saveFirebaseOrderSession(created);
}

async function firebaseOrderRequest(path, session, options = {}) {
    const cleanPath = String(path || '').replace(/^\/+|\.json$/g, '');
    const baseUrl = FIREBASE_ORDER_DATABASE_URL.replace(/\/$/, '');
    const url = new URL(`${baseUrl}/${cleanPath}.json`);
    url.searchParams.set('auth', session.idToken);

    const response = await fetch(url, {
        method: options.method || 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    const result = await response.json();
    if (!response.ok) {
        const error = new Error(result.error || `Firebase Database request failed (${response.status}).`);
        error.code = `FIREBASE_${response.status}`;
        throw error;
    }
    return result;
}

async function loadOrderMasterData() {
    const session = await getFirebaseOrderSession();
    const masterData = await firebaseOrderRequest('masterData/order', session);
    if (!masterData || !masterData.books || !masterData.deliveryCities || !masterData.settings) {
        throw new Error('Firebase order master data is missing or incomplete.');
    }
    const thresholds = masterData.settings.priceThresholds;
    if (!Array.isArray(thresholds) || thresholds.length === 0 ||
        thresholds.some((value) => !Number.isSafeInteger(Number(value)) || Number(value) < 0) ||
        !Number.isFinite(Number(masterData.settings.royalServiceFee)) ||
        !Number.isFinite(Number(masterData.settings.codMaxTotal))) {
        throw new Error('Firebase order settings are invalid.');
    }
    const books = getFirebaseOrderBooks(masterData);
    if (books.length === 0) {
        throw new Error('Firebase order master data has no books.');
    }
    books.forEach((record) => {
        if (!record || !Array.isArray(record.prices) || record.prices.length !== thresholds.length ||
            record.prices.some((price) => !Number.isSafeInteger(Number(price)) || Number(price) < 0) ||
            !record.name || !Number.isFinite(Number(record.weight)) || Number(record.weight) <= 0) {
            throw new Error(`Firebase book master data is invalid for ${record.id}.`);
        }
    });
    return { session, masterData };
}

function getFirebaseOrderBooks(masterData) {
    return Object.entries(masterData?.books || {}).map(([id, book]) => ({
        ...book,
        id: book.id || id
    }));
}

async function submitOrderToFirebase(order, session) {
    const record = {
        ownerUid: session.localId,
        syncStatus: 'pending',
        createdAt: new Date().toISOString(),
        request: order
    };
    const result = await firebaseOrderRequest('orders', session, {
        method: 'POST',
        body: record
    });
    if (!result?.name) {
        throw new Error('Firebase did not return an order ID.');
    }
    return result.name;
}
