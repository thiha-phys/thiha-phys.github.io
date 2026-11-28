let orders = [];
const masterDataReady = AdminApi.getMasterData().catch((error) => {
    console.warn('Unable to load current book labels for vouchers.', error);
});

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
        infoRows.push(['Bus Gate / Bus Name', order['car inform']]);
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

document.getElementById('print-voucher').addEventListener('click', () => window.print());
attachReceiptActions({
    receiptId: 'receipt',
    shareButtonId: 'share-voucher',
    statusId: 'voucher-action-status'
});

async function openRequestedVoucher() {
    const voucher = new URLSearchParams(window.location.search).get('voucher');
    const status = document.getElementById('voucher-load-status');
    if (!voucher) {
        status.textContent = 'Order History မှ VOC ကို ရွေးပြီး ဖွင့်ပါ။';
        return;
    }
    status.textContent = 'ရွေးထားသော ဘောက်ချာကို ဖွင့်နေသည်…';
    try {
        const cached = await AdminApi.getCachedOrders();
        if (cached) orders = cached.data;
        let order = orders.find((item) => String(item['Voucher No'] || '').trim() === voucher.trim());
        if (!order) {
            const refreshed = await AdminApi.refreshOrders();
            orders = refreshed.data;
            order = orders.find((item) => String(item['Voucher No'] || '').trim() === voucher.trim());
        }
        if (!order) {
            status.textContent = `Voucher ${voucher} was not found.`;
            status.classList.add('error');
            return;
        }
        await masterDataReady;
        status.hidden = true;
        displayVoucher(order);
    } catch (error) {
        console.error('Unable to load the requested voucher.', error);
        status.textContent = 'Unable to load the selected voucher.';
        status.classList.add('error');
    }
}
openRequestedVoucher();
