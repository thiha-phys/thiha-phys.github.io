// After deploying the backend Vercel project, replace this value with its URL.
window.PHYSICS_API_BASE_URL = 'https://uthk-physics-api.vercel.app';

async function physicsApiFetch(path, options = {}) {
    const token = sessionStorage.getItem('physicsLearningHubSession');
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${window.PHYSICS_API_BASE_URL}/api/${path.replace(/^\//, '')}`, { ...options, headers });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
        const error = new Error(result.message || `Request failed (${response.status}).`);
        error.code = result.code || 'API_REQUEST_FAILED';
        throw error;
    }
    return result;
}
