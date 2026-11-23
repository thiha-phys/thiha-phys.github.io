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

    let serverSession = localStorage.getItem('physicsLearningHubSession');
    if (!serverSession) {
        serverSession = sessionStorage.getItem('physicsLearningHubSession');
        if (serverSession) {
            try { localStorage.setItem('physicsLearningHubSession', serverSession); } catch (error) { /* Keep the existing session available in this tab. */ }
        }
    }
    const hasServerSession = Boolean(serverSession);
    const isSignedIn = hasServerSession && profile &&
        typeof profile === 'object' &&
        typeof profile.name === 'string' && profile.name.trim() &&
        typeof profile.phone === 'string' && profile.phone.trim();
    const isHomePage = window.location.pathname === '/' ||
        window.location.pathname === '/index.html';
    const publicPagePaths = new Set([
        '/page/books.html', '/page/bookstores.html', '/page/order.html'
    ]);
    const isPublicPreview = window.location.pathname.startsWith('/preview/');
    const isPublicPage = isHomePage || isPublicPreview || publicPagePaths.has(window.location.pathname);

    const isPendingPage = window.location.pathname === '/page/pending.html';
    if (isSignedIn && profile.approvalStatus && profile.approvalStatus !== 'approved' && !isPendingPage) {
        window.location.replace('/page/pending.html');
        return;
    }

    if (isSignedIn || isLoginPage) {
        return;
    }

    if (isHomePage) {
        window.location.replace(loginPath);
        return;
    }
    if (isPublicPage) return;

    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const loginUrl = new URL(loginPath, window.location.origin);
    loginUrl.searchParams.set('returnTo', returnTo);
    window.location.replace(loginUrl.toString());
})();
