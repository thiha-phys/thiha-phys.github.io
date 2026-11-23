// After deploying the backend Vercel project, replace this value with its URL.
window.PHYSICS_API_BASE_URL = 'https://uthk-physics-api.vercel.app';

async function physicsApiFetch(path, options = {}) {
    let token = localStorage.getItem('physicsLearningHubSession');
    if (!token) {
        token = sessionStorage.getItem('physicsLearningHubSession');
        if (token) {
            try { localStorage.setItem('physicsLearningHubSession', token); } catch (error) { /* Keep using the current tab session if storage is unavailable. */ }
        }
    }
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const requestOptions = { ...options, headers };
    const method = String(requestOptions.method || 'GET').toUpperCase();
    const delays = ['GET', 'PUT', 'PATCH'].includes(method) ? [0, 700, 1600] : [0];
    let response;
    let lastError;
    for (const delay of delays) {
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        try {
            response = await fetch(`${window.PHYSICS_API_BASE_URL}/api/${path.replace(/^\//, '')}`, requestOptions);
            break;
        } catch (error) { lastError = error; }
    }
    if (!response) {
        const error = new Error('ဆာဗာသို့ ချိတ်ဆက်မရပါ။ အင်တာနက်/VPN ကို စစ်ဆေးပြီး ထပ်ကြိုးစားပါ။');
        error.cause = lastError;
        throw error;
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
        const error = new Error(result.message || `Request failed (${response.status}).`);
        error.code = result.code || 'API_REQUEST_FAILED';
        throw error;
    }
    return result;
}
