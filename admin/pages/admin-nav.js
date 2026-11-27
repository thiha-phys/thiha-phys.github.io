(() => {
    const savedAdminToken = localStorage.getItem('physicsLearningHubSession') || sessionStorage.getItem('physicsLearningHubSession');
    if (savedAdminToken && !localStorage.getItem('physicsLearningHubSession')) {
        try { localStorage.setItem('physicsLearningHubSession', savedAdminToken); } catch {}
    }
    if (!savedAdminToken) {
        window.location.replace(new URL('../login.html', document.currentScript.src).href);
        return;
    }
    const currentPath = window.location.pathname;
    const pageName = currentPath.split('/').pop();
    const isHome = pageName === '' || pageName === 'index.html';
    const isOrders = ['historyorder.html', 'chnagerequest.html', 'createvoucher.html'].includes(pageName);
    const isFeedback = pageName === 'feedback.html';
    const toolsPages = [
        'tools.html',
        'masterdata.html',
        'royal-sync.html',
        'shops.html',
        'shop.html',
        'shop-order.html',
        'shop-history.html',
        'undelivered-shop-orders.html',
        'order-profiles.html'
    ];
    const isTools = toolsPages.includes(pageName);

    const icon = (paths) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
    const icons = {
        home: icon('<path d="m3.5 10.5 8.5-7 8.5 7"/><path d="M5.5 9.5v10h5v-6h3v6h5v-10"/>'),
        orders: icon('<path d="M7 3.5h8l4 4v13H7z"/><path d="M15 3.5v4h4M10 12h6M10 16h6"/>'),
        add: icon('<path d="M12 5v14M5 12h14"/>'),
        feedback: icon('<path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.5a7.5 7.5 0 1 1 17-3z"/><path d="M8 11h8M8 14h5"/>'),
        more: icon('<circle cx="5" cy="5" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="19" cy="5" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="19" r="1"/><circle cx="12" cy="19" r="1"/><circle cx="19" cy="19" r="1"/>')
    };
    const nav = document.createElement('nav');
    nav.className = 'admin-bottom-nav';
    nav.setAttribute('aria-label', 'Main navigation');
    nav.innerHTML = `
        <a class="admin-nav-item${isHome ? ' is-active' : ''}" href="${isHome ? './index.html' : '../index.html'}"${isHome ? ' aria-current="page"' : ''}>${icons.home}<span>Home</span></a>
        <a class="admin-nav-item${isOrders ? ' is-active' : ''}" href="${isHome ? 'pages/historyorder.html' : 'historyorder.html'}"${isOrders ? ' aria-current="page"' : ''}>${icons.orders}<span>History</span></a>
        <a class="admin-nav-add" href="${isHome ? 'pages/createorder.html' : 'createorder.html'}" aria-label="Create new order">${icons.add}</a>
        <a class="admin-nav-item${isFeedback ? ' is-active' : ''}" href="${isHome ? 'pages/feedback.html' : 'feedback.html'}"${isFeedback ? ' aria-current="page"' : ''}>${icons.feedback}<span>Feedback</span></a>
        <a class="admin-nav-item${isTools ? ' is-active' : ''}" href="${isHome ? 'pages/tools.html' : 'tools.html'}"${isTools ? ' aria-current="page"' : ''}>${icons.more}<span>Tools</span></a>
    `;
    document.body.append(nav);
})();
