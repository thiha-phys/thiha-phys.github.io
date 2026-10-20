(() => {
    const profileKey = 'physicsLearningHubProfile';
    const loginPath = '/page/login.html';
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

    if (isSignedIn || window.location.pathname === loginPath) {
        return;
    }

    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const loginUrl = new URL(loginPath, window.location.origin);
    loginUrl.searchParams.set('returnTo', returnTo);
    window.location.replace(loginUrl.toString());
})();
