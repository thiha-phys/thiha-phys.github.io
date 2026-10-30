const undeliveredShopOrderList = document.getElementById('undelivered-shop-order-list');
const undeliveredShopStatus = document.getElementById('undelivered-shop-status');
let activeShopOrderMode = new URLSearchParams(window.location.search).get('mode') === 'unpaid'
    ? 'unpaid'
    : 'undelivered';
let undeliveredShopOrders = [];

function formatStoreOrderValue(key, value) {
    if (value == null || value === '') return '—';
    if (/(amount|total|received)/i.test(key) && Number.isFinite(Number(value))) {
        return formatKyats(value);
    }
    return String(value);
}

function renderStoreInvoiceDetails(order) {
    const rows = Object.entries(order)
        .filter(([key]) => key !== 'shopId' && key !== 'shopName')
        .map(([key, value]) => `<div class="shop-order-detail"><span>${escapeText(key)}</span><strong>${escapeText(formatStoreOrderValue(key, value))}</strong></div>`)
        .join('');
    const editHref = `shop-order.html?shop=${encodeURIComponent(order.shopId)}&voucher=${encodeURIComponent(order['Voucher No'])}`;
    const receiptHref = `${editHref}&receipt=1`;
    return `<div class="shop-order-details">
        <div>${rows}</div>
        <div class="button-row no-print">
            <a class="secondary-button" href="${escapeText(receiptHref)}"><i class="fa-solid fa-receipt" aria-hidden="true"></i> Reprint Invoice</a>
            <a class="primary-button" href="${escapeText(editHref)}"><i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> Edit Order</a>
        </div>
    </div>`;
}

function renderShopOrders() {
    const matching = [...undeliveredShopOrders]
        .sort((a, b) => String(b['Order Date'] || '').localeCompare(String(a['Order Date'] || '')));
    undeliveredShopOrderList.replaceChildren();
    if (!matching.length) {
        const statusLabel = activeShopOrderMode === 'unpaid' ? 'unpaid' : 'undelivered';
        undeliveredShopOrderList.innerHTML =
            `<div class="empty-state">No ${statusLabel} store orders found.</div>`;
        undeliveredShopStatus.textContent = '0 invoices shown';
        return;
    }

    matching.forEach((order) => {
        const card = document.createElement('details');
        card.className = 'shop-order-card';
        const delivered = Boolean(String(order['Delivered Date'] || '').trim());
        const paid = Number(order.Received || 0) >= Number(order.Total || 0);
        card.innerHTML = `<summary>
            <span class="shop-order-heading">
                <strong>${escapeText(order['Voucher No'] || '—')}</strong>
                <span class="shop-order-statuses">
                    <span class="badge">${escapeText(order.shopName)}</span>
                    <span class="badge ${delivered ? 'good' : 'warning'}">${delivered ? 'Delivered' : 'Undelivered'}</span>
                    <span class="badge ${paid ? 'good' : 'warning'}">${paid ? 'Paid' : 'Unpaid'}</span>
                </span>
            </span>
            <span class="order-card-info">Order Date · ${escapeText(order['Order Date'] || '—')}</span>
            <span class="order-card-totals"><span>Total <strong>${formatKyats(order.Total)}</strong></span><span>Received <strong>${formatKyats(order.Received)}</strong></span></span>
            <span class="order-card-expand"><span>View invoice details</span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></span>
        </summary>${renderStoreInvoiceDetails(order)}`;
        undeliveredShopOrderList.append(card);
    });
    undeliveredShopStatus.textContent = `${matching.length.toLocaleString('en-US')} invoices shown`;
}

async function loadShopOrders(button) {
    if (button) button.disabled = true;
    undeliveredShopStatus.classList.remove('error');
    undeliveredShopStatus.textContent =
        activeShopOrderMode === 'unpaid' ? 'Loading unpaid store orders…' : 'Loading undelivered store orders…';
    try {
        undeliveredShopOrders = await AdminApi.getShopOrdersByStatus(activeShopOrderMode);
        renderShopOrders();
    } catch (error) {
        console.error('Unable to load filtered store orders.', error);
        undeliveredShopStatus.textContent =
            error.message || 'Unable to load store orders. Please try again.';
        undeliveredShopStatus.classList.add('error');
    } finally {
        if (button) button.disabled = false;
    }
}

document.getElementById('refresh-undelivered-shop-orders').addEventListener('click', (event) =>
    loadShopOrders(event.currentTarget)
);
document.querySelectorAll('.store-order-modes .history-mode').forEach((button) => {
    const mode = button.dataset.mode;
    button.classList.toggle('is-active', mode === activeShopOrderMode);
    button.setAttribute('aria-pressed', String(mode === activeShopOrderMode));
    button.addEventListener('click', () => {
        if (mode === activeShopOrderMode) return;
        activeShopOrderMode = mode;
        const url = new URL(window.location.href);
        url.searchParams.set('mode', mode);
        window.history.replaceState(null, '', url);
        document.querySelectorAll('.store-order-modes .history-mode').forEach((modeButton) => {
            const isActive = modeButton.dataset.mode === mode;
            modeButton.classList.toggle('is-active', isActive);
            modeButton.setAttribute('aria-pressed', String(isActive));
        });
        loadShopOrders();
    });
});
loadShopOrders();
