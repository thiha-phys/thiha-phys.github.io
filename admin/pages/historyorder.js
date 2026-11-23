const listElement = document.getElementById('order-list');
const statusElement = document.getElementById('history-status');
let orderItems = [];
let allOrders = [];
const requestedMode = new URLSearchParams(window.location.search).get('mode');
let activeMode = ['undelivered', 'unpaid'].includes(requestedMode) ? requestedMode : 'search';

function formatOrderDateEnglish(value) {
    const text = String(value || '').trim();
    const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
    if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]} ${text.length > 10 ? text.slice(11,16) : ''}`.trim();

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime())
        ? text || '—'
        : new Intl.DateTimeFormat('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(parsed);
}

function formatHistoryCacheTime(updatedAt) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(new Date(updatedAt))
        .reduce((values, part) => {
            values[part.type] = part.value;
            return values;
        }, {});
    return `Loaded · ${parts.day} ${parts.month} ${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function renderDetailLine(label, value) {
    return `<div class="order-detail-line"><span>${escapeText(label)}</span><strong>${escapeText(value || '—')}</strong></div>`;
}

function renderPhoneLink(phone) {
    const text = String(phone || '').trim();
    if (!text) return '—';

    const dialNumber = text
        .replace(/[၀-၉]/g, (digit) => String(digit.charCodeAt(0) - '၀'.charCodeAt(0)))
        .replace(/[^\d+]/g, '')
        .replace(/(?!^)\+/g, '');
    return dialNumber
        ? `<a class="order-phone-link" href="tel:${escapeText(dialNumber)}">${escapeText(text)}</a>`
        : escapeText(text);
}

function paymentMethodLabel(value) {
    const method = String(value || '').trim().toLocaleLowerCase();
    if (method === 'cod') return 'COD';
    if (method === 'kbz pay' || method === 'kpay') return 'KPay';
    return '';
}

function renderOrderDetails(order) {
    const deliveryService = order['Delivery Service'] || order.Delivery;
    const carInfo = order['car inform'] ||
        (deliveryService === 'Car' ? order['Delivery Notes'] : '');
    const itemDetails = orderItems.map(([quantityField, amountField, bookName]) => {
        const quantity = Number(order[quantityField] || 0);
        if (quantity <= 0) return '';
        return renderDetailLine(
            `${bookName} × ${quantity}`,
            formatKyats(order[amountField])
        );
    }).filter(Boolean).join('');

    const extraDetails = [
        ['ငွေပေးချေမှု', order['Payment Method']],
        ['ငွေကောက်', order['Cash Collection'] == null || order['Cash Collection'] === ''
            ? ''
            : formatKyats(order['Cash Collection'])],
        ['KPay Account', order['KPay Account']],
        ['Pay Date', order['Pay Date']],
        ['Royal VOC No', order['Royal VOC No']],
        ...(carInfo ? [['ကားဂိတ် / ကားအမည်', carInfo]] : []),
        ['Delivery', order.Delivery],
        ['Facebook Account Name', order['Facebook Account Name']]
    ].filter(([, value]) => value);

    return `<div class="order-details">
        <div class="order-details-section">
            <h4>စာအုပ်အသေးစိတ်</h4>
            <div class="order-detail-list">${itemDetails || renderDetailLine('စာအုပ်စာရင်း', 'မရှိပါ')}</div>
        </div>
        <div class="order-details-section">
            <h4>မှာယူမှုအသေးစိတ်</h4>
            <div class="order-detail-list">
                ${renderDetailLine('မှာယူသူ', order.Name)}
                <div class="order-detail-line"><span>ဖုန်းနံပါတ်</span><strong>${renderPhoneLink(order.Phone)}</strong></div>
                ${renderDetailLine('လိပ်စာ', order.Address)}
                ${renderDetailLine('Ordered Date', formatOrderDateEnglish(order['Ordered Date'] || order['Order Date']))}
                ${renderDetailLine('Delivered Date', (order['Delivered Date'] || order['Order Confirm']) ? formatOrderDateEnglish(order['Delivered Date'] || order['Order Confirm']) : 'မပို့ရသေး')}
                ${extraDetails.map(([label, value]) => renderDetailLine(label, value)).join('')}
            </div>
        </div>
    </div>`;
}

function renderOrders() {
    const query = document.getElementById('search').value;
    const from = document.getElementById('date-from').value;
    const to = document.getElementById('date-to').value;
    const matches = allOrders.filter((order) => {
        const date = String(order['Order Date'] || '').slice(0, 10);
        const total = Number(order.Total || 0);
        const received = Number(order['Amount Received'] || 0);
        if (activeMode === 'search') return orderMatches(order, query);
        if (activeMode === 'date') {
            return Boolean(date) && (!from || date >= from) && (!to || date <= to);
        }
        if (activeMode === 'undelivered') return !String(order['Delivered Date'] || '').trim();
        return received < total;
    }).sort((a, b) => String(b['Order Date'] || '').localeCompare(String(a['Order Date'] || '')));

    listElement.replaceChildren();
    if (!matches.length) {
        listElement.innerHTML = '<div class="empty-state">ကိုက်ညီသော အမှာစာ မတွေ့ပါ။</div>';
        statusElement.textContent = '0 orders shown';
        return;
    }
    matches.forEach((order) => {
        const card = document.createElement('details');
        card.className = 'order-card';
        const delivered = Boolean(String(order['Delivered Date'] || order['Deliver Date'] || '').trim()) || order.status === 'delivered';
        const paid = Number(order['Amount Received'] || 0) >= Number(order.Total || 0);
        const paymentMethod = paymentMethodLabel(order['Payment Method']);
        card.innerHTML = `
            <summary class="order-card-summary">
                <span class="order-card-heading">
                    <strong>${escapeText(order['Voucher No'])}</strong>
                    <span class="order-card-statuses">
                        <span class="badge ${delivered ? 'good' : 'warning'}">${delivered ? 'complete' : 'pending'}</span>
                        <span class="badge ${paid ? 'good' : 'warning'}">${paid ? 'ငွေရှင်းပြီး' : 'ငွေမရှင်းရသေး'}</span>
                        ${paymentMethod ? `<span class="badge payment-method">${escapeText(paymentMethod)}</span>` : ''}
                    </span>
                </span>
                <span class="order-card-divider"></span>
                <span class="order-card-info">${escapeText(formatOrderDateEnglish(order['Order Date']))}</span>
                <span class="order-card-info order-customer">${escapeText(order.Name || '—')} · ${renderPhoneLink(order.Phone)} · ${escapeText(order.Address || '—')}</span>
                <span class="order-card-totals">
                    <span>စုစုပေါင်း <strong>${formatKyats(order.Total)}</strong></span>
                    <span>လက်ခံရရှိ <strong>${formatKyats(order['Amount Received'])}</strong></span>
                </span>
                <span class="order-card-expand"><span>အသေးစိတ်ကြည့်ရန်</span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></span>
            </summary>
            ${renderOrderDetails(order)}`;
        listElement.append(card);
    });
    statusElement.textContent = `${matches.length.toLocaleString('en-US')} orders shown`;
}

function setMode(mode) {
    activeMode = mode;
    document.querySelectorAll('.history-mode').forEach((button) => {
        const isActive = button.dataset.mode === mode;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
    document.getElementById('search-tools').hidden = mode !== 'search';
    document.getElementById('date-tools').hidden = mode !== 'date';
    document.getElementById('mode-description').textContent = {
        search: 'Search by voucher number, name, or phone number.',
        date: 'Choose a start and end date to view orders in that period.',
        undelivered: 'မပို့ရသေးသော အမှာစာများကို ပြသနေသည်။',
        unpaid: 'Showing orders that have not been paid in full.'
    }[mode];
    renderOrders();
}

async function loadOrders() {
    try {
        try {
            await AdminApi.getMasterData();
        } catch (error) {
            console.warn('Unable to load current book labels for order history.', error);
        }
        orderItems = AdminBooks.map((book) => [
            book.quantityHeader || `${book.id} Qty`,
            book.amountHeader || `${book.id} Amount`,
            book.name
        ]);
        const cached = await AdminApi.refreshOrders();
        allOrders = cached.data;
        document.getElementById('history-cache-status').textContent =
            formatHistoryCacheTime(cached.updatedAt);
        renderOrders();
    } catch (error) {
        console.error('Unable to read cached order history.', error);
        statusElement.textContent = 'Unable to load orders from the database.';
        statusElement.classList.add('error');
    }
}

['search', 'date-from', 'date-to'].forEach((id) =>
    document.getElementById(id).addEventListener('input', renderOrders)
);
document.querySelectorAll('.history-mode').forEach((button) =>
    button.addEventListener('click', () => setMode(button.dataset.mode))
);
setMode(activeMode);
loadOrders();
