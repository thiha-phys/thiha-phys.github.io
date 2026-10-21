(() => {
    const currentPath = window.location.pathname;
    const pageName = currentPath.split('/').pop();
    const isHome = pageName === '' || pageName === 'index.html';
    const isOrders = ['historyorder.html', 'chnagerequest.html', 'createvoucher.html'].includes(pageName);
    const isStock = pageName === 'checkstock.html';
    const toolsPages = [
        'tools.html',
        'masterdata.html',
        'royal-sync.html',
        'shops.html',
        'shop.html',
        'shop-order.html',
        'shop-history.html'
    ];
    const isTools = toolsPages.includes(pageName);

    const icon = (paths) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
    const icons = {
        home: icon('<path d="m3.5 10.5 8.5-7 8.5 7"/><path d="M5.5 9.5v10h5v-6h3v6h5v-10"/>'),
        orders: icon('<path d="M7 3.5h8l4 4v13H7z"/><path d="M15 3.5v4h4M10 12h6M10 16h6"/>'),
        add: icon('<path d="M12 5v14M5 12h14"/>'),
        stock: icon('<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4.5 7.8 7.5 4.4 7.5-4.4M12 12.5V21"/>'),
        more: icon('<circle cx="5" cy="5" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="19" cy="5" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="19" r="1"/><circle cx="12" cy="19" r="1"/><circle cx="19" cy="19" r="1"/>')
    };
    const nav = document.createElement('nav');
    nav.className = 'admin-bottom-nav';
    nav.setAttribute('aria-label', 'Main navigation');
    nav.innerHTML = `
        <a class="admin-nav-item${isHome ? ' is-active' : ''}" href="${isHome ? './index.html' : '../index.html'}"${isHome ? ' aria-current="page"' : ''}>${icons.home}<span>Home</span></a>
        <a class="admin-nav-item${isOrders ? ' is-active' : ''}" href="${isHome ? 'pages/historyorder.html' : 'historyorder.html'}"${isOrders ? ' aria-current="page"' : ''}>${icons.orders}<span>History</span></a>
        <a class="admin-nav-add" href="${isHome ? 'pages/createorder.html' : 'createorder.html'}" aria-label="Create new order">${icons.add}</a>
        <a class="admin-nav-item${isStock ? ' is-active' : ''}" href="${isHome ? 'pages/checkstock.html' : 'checkstock.html'}"${isStock ? ' aria-current="page"' : ''}>${icons.stock}<span>Stock</span></a>
        <a class="admin-nav-item${isTools ? ' is-active' : ''}" href="${isHome ? 'pages/tools.html' : 'tools.html'}"${isTools ? ' aria-current="page"' : ''}>${icons.more}<span>Tools</span></a>
    `;
    document.body.append(nav);
})();
