(() => {
    const profileKey = 'physicsLearningHubProfile';
    const loginPath = '/page/login.html';
    const isLoginPage = window.location.pathname === loginPath;
    let profile = null;

    try {
        profile = JSON.parse(localStorage.getItem(profileKey) || 'null');
    } catch (error) {
        console.error('Unable to read the saved account profile.', error);
    }

    const isSignedIn = profile &&
        typeof profile === 'object' &&
        typeof profile.name === 'string' && profile.name.trim() &&
        typeof profile.phone === 'string' && profile.phone.trim();
    const isHomePage = window.location.pathname === '/' ||
        window.location.pathname === '/index.html';

    if (isSignedIn || isLoginPage) {
        return;
    }

    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const loginUrl = new URL(loginPath, window.location.origin);
    if (!isHomePage) {
        loginUrl.searchParams.set('returnTo', returnTo);
    }
    window.location.replace(loginUrl.toString());
})();
