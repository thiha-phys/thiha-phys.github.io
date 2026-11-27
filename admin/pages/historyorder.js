const listElement = document.getElementById('order-list');
const statusElement = document.getElementById('history-status');
let orderItems = [];
let allOrders = [];
let visibleOrders = [];
const requestedMode = new URLSearchParams(window.location.search).get('mode');
let activeMode = ['undelivered', 'unpaid'].includes(requestedMode) ? requestedMode : 'search';

function orderDateIso(order) {
    const value = order['Order Date'] || order['Ordered Date'] || order.orderDate || order.created_at || '';
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value).trim());
    if (match) return match[1];
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

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
        const date = orderDateIso(order);
        const total = Number(order.Total || 0);
        const received = Number(order['Amount Received'] || 0);
        if (activeMode === 'search') return orderMatches(order, query);
        if (activeMode === 'date') {
            return Boolean(date) && (!from || date >= from) && (!to || date <= to);
        }
        if (activeMode === 'undelivered') return order.status === 'pending';
        return received < total;
    }).sort((a, b) => String(b['Order Date'] || '').localeCompare(String(a['Order Date'] || '')));

    visibleOrders = matches;
    listElement.replaceChildren();
    if (!matches.length) {
        listElement.innerHTML = '<div class="empty-state">ကိုက်ညီသော အမှာစာ မတွေ့ပါ။</div>';
        statusElement.textContent = '0 orders shown';
        return;
    }
    matches.forEach((order) => {
        const card = document.createElement('details');
        card.className = 'order-card';
        const deliveryStatus = order.Complete === 'Yes' || order.status === 'complete' || order.status === 'received'
            ? 'complete'
            : order.status === 'delivered'
                ? 'delivered'
                : 'pending';
        const paid = Number(order['Amount Received'] || 0) >= Number(order.Total || 0);
        const paymentMethod = paymentMethodLabel(order['Payment Method']);
        card.innerHTML = `
            <summary class="order-card-summary">
                <span class="order-card-heading">
                    <strong>${escapeText(order['Voucher No'])}</strong>
                    <span class="order-card-statuses">
                        <span class="badge ${deliveryStatus === 'pending' ? 'warning' : 'good'}">${deliveryStatus}</span>
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
        const editLink = document.createElement('a');
        editLink.className = 'order-edit-button';
        editLink.href = `chnagerequest.html?voucher=${encodeURIComponent(String(order['Voucher No'] || ''))}`;
        editLink.innerHTML = '<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i><span>Edit</span>';
        const details = card.querySelector('.order-details');
        const amountReceived = Number(String(order['Amount Received'] || '0').replaceAll(',', ''));
        const payDate = String(order['Pay Date'] || order['pay date'] || '').trim();
        const kpayAccount = String(order['KPay Account'] || order['Kpay acc'] || order['Kpay account'] || '').trim();
        const orderTotal = Number(String(order.Total || '0').replaceAll(',', ''));
        if (order.hasCustomerAccount && orderTotal > 0 && amountReceived >= orderTotal && payDate && kpayAccount) {
            const noticeButton = document.createElement('button');
            noticeButton.type = 'button';
            noticeButton.className = 'payment-notice-button';
            noticeButton.innerHTML = '<i class="fa-solid fa-paper-plane" aria-hidden="true"></i><span>ငွေလက်ခံရရှိပါပြီ</span>';
            const noticeStatus = document.createElement('span');
            noticeStatus.className = 'payment-notice-status';
            noticeStatus.setAttribute('role', 'status');
            noticeButton.addEventListener('click', async () => {
                noticeButton.disabled = true;
                noticeStatus.textContent = 'Customer ထံ စာပို့နေသည်…';
                try {
                    const result = await AdminApi.sendOrderPaymentNotice(order['Voucher No']);
                    noticeButton.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i><span>စာပို့ပြီးပါပြီ</span>';
                    noticeButton.classList.add('is-sent');
                    noticeStatus.textContent = result.alreadySent ? 'တူညီသောအကြောင်းကြားစာ ပို့ပြီးသားဖြစ်သည်။' : 'Customer Discussion ထဲသို့ ပို့ပြီးပါပြီ။';
                } catch (error) {
                    noticeButton.disabled = false;
                    noticeStatus.textContent = error.message || 'Customer ထံ စာမပို့နိုင်ပါ။';
                    noticeStatus.classList.add('is-error');
                }
            });
            details.append(noticeButton, noticeStatus);
        }
        details.append(editLink);
        listElement.append(card);
    });
    statusElement.textContent = `${matches.length.toLocaleString('en-US')} orders shown`;
}

function exportOrdersToExcel() {
    const from = document.getElementById('export-date-from').value;
    const to = document.getElementById('export-date-to').value;
    if (!from || !to || from > to) return;
    const exportRows = allOrders.filter((order) => {
        const date = orderDateIso(order);
        return date && date >= from && date <= to;
    });
    if (!exportRows.length) {
        statusElement.textContent = 'ရွေးထားသော ရက်စွဲအတွင်း order မရှိပါ။';
        return;
    }
    const columns = [...new Set(exportRows.flatMap((order) => Object.keys(order)))];
    const escapeCell = (value) => {
        const text = value == null
            ? ''
            : typeof value === 'object'
                ? JSON.stringify(value)
                : String(value);
        const safeText = /^[=+@\-]/.test(text) ? `'${text}` : text;
        return `"${safeText.replace(/"/g, '""')}"`;
    };
    const csv = [columns, ...exportRows.map((order) => columns.map((column) => order[column]))]
        .map((row) => row.map(escapeCell).join(','))
        .join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orders-${from}-to-${to}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
        document.getElementById('export-data-note').textContent = allOrders.length
            ? `${allOrders.length.toLocaleString('en-US')} orders available. Choose a date range to export.`
            : 'Database ထဲတွင် order မရှိသေးပါ။ Order ရှိလာလျှင် ရက်စွဲရွေးပြီး export လုပ်နိုင်ပါသည်။';
        updateExportDateRange();
        document.getElementById('history-cache-status').textContent =
            formatHistoryCacheTime(cached.updatedAt);
        renderOrders();
    } catch (error) {
        console.error('Unable to read cached order history.', error);
        document.getElementById('export-data-note').textContent = 'Order data ကို database မှ မရယူနိုင်သေးပါ။ ချိတ်ဆက်မှုအဆင်ပြေပြီး order များ load ဖြစ်မှ export လုပ်နိုင်ပါမည်။';
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
const exportDatePanel = document.getElementById('export-date-panel');
const exportFrom = document.getElementById('export-date-from');
const exportTo = document.getElementById('export-date-to');
const downloadOrdersButton = document.getElementById('download-orders');

function updateExportDateRange() {
    const rangeIsValid = Boolean(exportFrom.value && exportTo.value && exportFrom.value <= exportTo.value);
    const matchingCount = rangeIsValid
        ? allOrders.filter((order) => {
            const date = orderDateIso(order);
            return date && date >= exportFrom.value && date <= exportTo.value;
        }).length
        : 0;
    downloadOrdersButton.disabled = !matchingCount;
    const note = document.getElementById('export-data-note');
    if (!allOrders.length) {
        note.textContent = 'Database ထဲတွင် order မရှိသေးပါ။ Order ရှိလာလျှင် ရက်စွဲရွေးပြီး export လုပ်နိုင်ပါသည်။';
    } else if (!rangeIsValid) {
        note.textContent = `${allOrders.length.toLocaleString('en-US')} orders ရှိသည်။ စတင်ရက်နှင့် နောက်ဆုံးရက်ကို ရွေးပါ။`;
    } else if (!matchingCount) {
        note.textContent = 'ရွေးထားသော ရက်စွဲအပိုင်းအခြားတွင် order မရှိပါ။ ရက်စွဲကို ပြန်ရွေးပါ။';
    } else {
        note.textContent = `${matchingCount.toLocaleString('en-US')} orders ကို CSV ဖိုင်အဖြစ် ထုတ်ရန် အသင့်ဖြစ်ပါပြီ။ Excel ဖြင့် ဖွင့်နိုင်ပါသည်။`;
    }
}

document.getElementById('export-orders').addEventListener('click', () => {
    const opening = exportDatePanel.hidden;
    exportDatePanel.hidden = !opening;
    if (opening && allOrders.length && !exportFrom.value && !exportTo.value) {
        const dates = allOrders.map(orderDateIso).filter(Boolean).sort();
        exportFrom.value = dates[0] || '';
        exportTo.value = dates[dates.length - 1] || '';
    }
    if (opening) updateExportDateRange();
});
document.getElementById('cancel-export').addEventListener('click', () => {
    exportDatePanel.hidden = true;
});
[exportFrom, exportTo].forEach((input) => {
    input.addEventListener('input', updateExportDateRange);
    input.addEventListener('change', updateExportDateRange);
});
downloadOrdersButton.addEventListener('click', exportOrdersToExcel);
setMode(activeMode);
loadOrders();
