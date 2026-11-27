const fieldGroups = [
    {
        title: 'Customer Information',
        fields: ['Name', 'Phone', 'Phone 2', 'Address', 'Order Date']
    },
    {
        title: 'Books and Amounts',
        fields: [
            'Special Qty', 'Special Amount', 'Practice Qty', 'Practice Amount',
            'Old Questions Qty', 'Old Questions Amount', 'Solution Qty', 'Solution Amount',
            'Grade 11 Handbook Qty', 'Grade 11 Handbook Amount',
            'Grade 11 Objective Qty', 'Grade 11 Objective Amount',
            'Grade 10 Handbook Qty', 'Grade 10 Handbook Amount', 'Total'
        ]
    },
    {
        title: 'Payment and Delivery Status',
        fields: [
            'Payment Method', 'Amount Received', 'KPay Account', 'Pay Date',
            'Delivered Date', 'Delivery', 'Royal VOC No'
        ]
    },
    {
        title: 'Order Status',
        fields: ['Order Status']
    },
    {
        title: 'Social Media Information',
        fields: ['Facebook Account Name', 'Facebook Link']
    }
];
let orders = [];
let selectedOrder = null;

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

function dateInputValue(value) {
    const text = String(value || '').trim();
    const isoDate = text.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoDate) return isoDate[1];
    const slashDate = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const dottedDate = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (!slashDate && !dottedDate) return '';
    const [, first, second, year] = slashDate || dottedDate;
    const month = dottedDate ? second : first;
    const day = dottedDate ? first : second;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return date.getUTCFullYear() === Number(year) &&
        date.getUTCMonth() === Number(month) - 1 &&
        date.getUTCDate() === Number(day)
        ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
        : '';
}

function showMatches(query) {
    const matches = orders.filter((order) => orderMatches(order, query));
    const resultList = document.getElementById('lookup-results');
    resultList.replaceChildren();
    if (!matches.length) {
        resultList.innerHTML = '<div class="empty-state">No matching orders found.</div>';
        return 0;
    }
    matches.slice(0, 50).forEach((order) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'result-choice';
        button.innerHTML = `<span><strong>${escapeText(order['Voucher No'])} · ${escapeText(order.Name)}</strong><br><small>${escapeText(order.Phone)} · ${escapeText(orderDate(order['Order Date']))}</small></span><span>${formatKyats(order.Total)}</span>`;
        button.addEventListener('click', () => openOrder(order));
        resultList.append(button);
    });
    return matches.length;
}

function openOrder(order) {
    selectedOrder = order;
    document.getElementById('lookup-status').textContent =
        `Voucher ${order['Voucher No']} selected.`;
    document.getElementById('edit-panel').hidden = false;
    const container = document.getElementById('edit-fields');
    container.replaceChildren();
    const voucherLabel = document.createElement('label');
    voucherLabel.className = 'edit-field';
    voucherLabel.textContent = 'Voucher No. (Cannot be changed)';
    const voucherInput = document.createElement('input');
    voucherInput.value = order['Voucher No'];
    voucherInput.disabled = true;
    voucherLabel.append(voucherInput);
    container.append(voucherLabel);
    fieldGroups.forEach((group) => {
        const section = document.createElement('section');
        section.className = 'edit-group';
        const heading = document.createElement('h3');
        heading.textContent = group.title;
        const grid = document.createElement('div');
        grid.className = 'edit-grid';
        group.fields.forEach((field) => {
            const label = document.createElement('label');
            label.className = 'edit-field';
            label.append(document.createTextNode(field));
            const input = document.createElement(field === 'Payment Method' ? 'select' : 'input');
            input.name = field;
            if (field === 'Pay Date' || field === 'Delivered Date') {
                input.type = 'date';
                input.value = dateInputValue(orderField(order, field));
            } else if (field.endsWith('Qty') || field === 'Total' ||
                field === 'Amount Received' || field.endsWith('Amount')) {
                input.type = 'number';
                input.min = '0';
                input.step = '1';
                input.inputMode = 'numeric';
                input.value = orderField(order, field);
            } else if (field === 'Payment Method') {
                ['COD', 'KBZ Pay'].forEach((method) => {
                    const option = document.createElement('option');
                    option.value = method;
                    option.textContent = method === 'COD' ? 'COD (Cash on Delivery)' : method;
                    input.append(option);
                });
                const currentMethod = orderField(order, field);
                if (currentMethod && !['COD', 'KBZ Pay'].includes(currentMethod)) {
                    const existing = document.createElement('option');
                    existing.value = currentMethod;
                    existing.textContent = `${currentMethod} (Current)`;
                    input.append(existing);
                }
                input.value = currentMethod || 'KBZ Pay';
            } else if (field === 'Order Status') {
                input = document.createElement('select');
                input.name = 'status';
                [
                    ['new', 'New'],
                    ['approved', 'Approved'],
                    ['on_the_way', 'On the way'],
                    ['delivered', 'Delivered'],
                    ['received', 'Received']
                ].forEach(([value, label]) => {
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = label;
                    input.append(option);
                });
                input.value = order.status || 'new';
            } else {
                input.value = orderField(order, field);
                input.autocomplete = 'off';
            }
            label.append(input);
            grid.append(label);
        });
        section.append(heading, grid);
        container.append(section);
    });
    document.getElementById('edit-status').textContent = '';
    document.getElementById('edit-panel').scrollIntoView({ behavior: 'smooth' });
}

document.getElementById('lookup-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.getElementById('lookup-status');
    status.className = 'status-message';
    document.getElementById('lookup-results').replaceChildren();
    document.getElementById('edit-panel').hidden = true;
    try {
        const cached = await AdminApi.refreshOrders();
        orders = cached.data;
        document.getElementById('lookup-cache-status').textContent =
            formatHistoryCacheTime(cached.updatedAt);
        const count = showMatches(document.getElementById('lookup-query').value);
        status.textContent = count
            ? `${count.toLocaleString('en-US')} orders found. Select an order to edit.`
            : 'No matching orders found.';
    } catch (error) {
        console.error('Unable to search cached orders for editing.', error);
        status.textContent = 'Unable to load orders from the database.';
        status.classList.add('error');
    }
});

document.getElementById('edit-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selectedOrder) return;
    if (!window.confirm(`Save changes to order ${selectedOrder['Voucher No']} in its existing row?`)) return;
    const status = document.getElementById('edit-status');
    const button = document.getElementById('save-order');
    const updated = { voucherNo: selectedOrder['Voucher No'] };
    new FormData(event.currentTarget).forEach((value, key) => { updated[key] = String(value).trim(); });
    status.className = 'status-message';
    status.textContent = 'Saving changes…';
    button.disabled = true;
    try {
        const result = await AdminApi.updateOrder(updated);
        selectedOrder = result.order;
        const index = orders.findIndex((order) => order['Voucher No'] === updated.voucherNo);
        if (index >= 0) orders[index] = result.order;
        status.textContent = 'Order updated in the database.';
        status.classList.add('success');
    } catch (error) {
        console.error('Unable to update the order.', error);
        status.textContent = 'Unable to save changes. Check the database API.';
        status.classList.add('error');
    } finally {
        button.disabled = false;
    }
});
