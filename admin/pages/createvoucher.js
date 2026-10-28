let orders = [];
const masterDataReady = AdminApi.getMasterData().catch((error) => {
    console.warn('Unable to load current book labels for vouchers.', error);
});

function formatVoucherCacheTime(updatedAt) {
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
    return `Refresh · ${parts.day} ${parts.month} ${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function renderVoucherMatches(query) {
    const results = document.getElementById('voucher-results');
    results.replaceChildren();
    const matches = orders.filter((order) => orderMatches(order, query))
        .sort((a, b) => String(b['Ordered Date'] || b['Order Date'] || '')
            .localeCompare(String(a['Ordered Date'] || a['Order Date'] || '')));
    if (!matches.length) {
        results.innerHTML = '<div class="empty-state">No matching orders found.</div>';
        return 0;
    }
    matches.slice(0, 50).forEach((order) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'result-choice';
        button.innerHTML = `<span><strong>${escapeText(order['Voucher No'])} · ${escapeText(order.Name)}</strong><br><small>${escapeText(order.Phone)} · ${escapeText(orderDate(order['Order Date']))}</small></span><span>${formatKyats(order.Total)}</span>`;
        button.addEventListener('click', async () => {
            await masterDataReady;
            displayVoucher(order);
        });
        results.append(button);
    });
    return matches.length;
}

function addReceiptLine(container, label, value) {
    const line = document.createElement('div');
    line.className = 'receipt-line';
    const key = document.createElement('span');
    key.textContent = label;
    const text = document.createElement('strong');
    text.textContent = value || '—';
    line.append(key, text);
    container.append(line);
    return line;
}

function formatReceiptDate(value) {
    const text = String(value || '').trim();
    if (!text) return '';

    const isoDate = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(text);
    if (isoDate) return `${isoDate[3]}.${isoDate[2]}.${isoDate[1]}`;

    const displayDate = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(text);
    if (displayDate) {
        return `${displayDate[1].padStart(2, '0')}.${displayDate[2].padStart(2, '0')}.${displayDate[3]}`;
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime())
        ? text
        : new Intl.DateTimeFormat('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(parsed).replace(/\//g, '.');
}

function displayVoucher(order) {
    document.getElementById('receipt-voucher').textContent = `Voucher No. ${order['Voucher No']}`;
    const info = document.getElementById('receipt-info');
    info.replaceChildren();
    const deliveryService = order['Delivery Service'] || order.Delivery;
    const orderedDate = order['Ordered Date'] || order['Order Date'];
    const deliveredDate = order['Deliver Date'] || order['Delivered Date'] || order['Order Confirm'];
    const infoRows = [
        ['Name', order.Name],
        ['Phone (Personal)', order['Phone 1'] || order.Phone],
        ['Phone (Work)', order['Phone 2']],
        ['Address', order.Address],
        ['Order Date', orderedDate],
        ['Delivery', deliveryService === 'Car' ? 'Bus Gate Delivery' : deliveryService],
        ['Delivered Date', formatReceiptDate(deliveredDate)],
        ['Payment Method', order['Payment Method']]
    ];
    if (deliveryService === 'Car') {
        infoRows.push(['Bus Gate / Bus Name', order['car inform'] || order['Delivery Notes']]);
    }
    infoRows.forEach(([label, value]) => addReceiptLine(info, label, String(value || '')));
    const itemList = document.getElementById('receipt-items');
    itemList.replaceChildren();
    AdminBooks.forEach((book) => {
        const quantityField = book.quantityHeader || `${book.id} Qty`;
        const amountField = book.amountHeader || `${book.id} Amount`;
        const quantity = Number(order[quantityField] || 0);
        if (quantity > 0) addReceiptLine(itemList, `${book.name} × ${quantity}`, formatKyats(order[amountField]));
    });
    const totals = document.getElementById('receipt-totals');
    totals.replaceChildren();
    const deliveryFee = Number(order['Delivery Fees'] || 0);
    const totalKg = Number(order['Total KG'] || 0);
    if (Number.isFinite(totalKg) && totalKg > 0) {
        addReceiptLine(totals, 'Total Weight', `${totalKg} kg`);
    }
    if (deliveryService) {
        const feeLine = addReceiptLine(totals, 'Delivery Fee', deliveryService === 'Car'
            ? 'Pay separately at the bus gate'
            : formatKyats(deliveryFee));
        feeLine.classList.add('receipt-delivery-line');
    }
    const bookTotal = Number(order.Total || 0);
    addReceiptLine(totals, 'Books Subtotal', formatKyats(bookTotal));
    addReceiptLine(totals, 'Cash Collection (COD)', formatKyats(order['Cash Collection']))
        .classList.add('receipt-cash-line');
    document.getElementById('receipt-total').textContent =
        formatKyats(bookTotal + deliveryFee);
    document.getElementById('receipt').hidden = false;
    document.getElementById('receipt').scrollIntoView({ behavior: 'smooth' });
}

document.getElementById('voucher-search-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.getElementById('voucher-status');
    status.className = 'status-message';
    document.getElementById('receipt').hidden = true;
    try {
        const cached = await AdminApi.getCachedOrders();
        if (!cached) {
            status.textContent = 'No saved data yet. Select Refresh to load orders.';
            return;
        }
        orders = cached.data;
        document.getElementById('voucher-cache-status').textContent =
            formatVoucherCacheTime(cached.updatedAt);
        const count = renderVoucherMatches(document.getElementById('voucher-query').value);
        status.textContent = count
            ? `${count.toLocaleString('en-US')} orders found. Select an order to create a voucher.`
            : 'No matching orders found.';
    } catch (error) {
        console.error('Unable to search cached orders for a voucher.', error);
        status.textContent = 'Unable to read saved data. Select Refresh to try again.';
        status.classList.add('error');
    }
});

document.getElementById('refresh-vouchers').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const status = document.getElementById('voucher-status');
    button.disabled = true;
    status.className = 'status-message';
    status.textContent = 'Refreshing orders…';
    try {
        const cached = await AdminApi.refreshOrders();
        orders = cached.data;
        document.getElementById('voucher-cache-status').textContent =
            formatVoucherCacheTime(cached.updatedAt);
        const count = renderVoucherMatches(document.getElementById('voucher-query').value);
        status.textContent = count
            ? `${count.toLocaleString('en-US')} orders found. Select an order to create a voucher.`
            : 'Enter a search term to find an order.';
    } catch (error) {
        console.error('Unable to refresh orders for vouchers.', error);
        status.textContent = 'Unable to refresh orders. Check your internet connection and try again.';
        status.classList.add('error');
    } finally {
        button.disabled = false;
    }
});

document.getElementById('print-voucher').addEventListener('click', () => window.print());
attachReceiptActions({
    receiptId: 'receipt',
    shareButtonId: 'share-voucher',
    statusId: 'voucher-action-status'
});
