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
            'Delivered Date', 'Delivery', 'Royal VOC No', 'Complete'
        ]
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

function setActiveEditTab(index, focus = false) {
    const tabs = [...document.querySelectorAll('#edit-tabs [role="tab"]')];
    const panels = [...document.querySelectorAll('#edit-fields [role="tabpanel"]')];
    tabs.forEach((tab, tabIndex) => {
        const active = tabIndex === index;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        if (active && focus) tab.focus();
    });
    panels.forEach((panel, panelIndex) => { panel.hidden = panelIndex !== index; });
}

function paymentReceivedStatus() {
    const form = document.getElementById('edit-form');
    const total = Number(String(form.elements.namedItem('Total')?.value || '0').replaceAll(',', ''));
    const amountReceived = Number(String(form.elements.namedItem('Amount Received')?.value || '0').replaceAll(',', ''));
    const paid = Number.isFinite(total) && Number.isFinite(amountReceived) && amountReceived >= total;
    const result = document.getElementById('payment-status-preview');
    result.textContent = paid ? 'ငွေလက်ခံရရှိပြီး' : 'ငွေမရှင်းရသေး';
    result.classList.toggle('is-paid', paid);
    result.classList.toggle('is-unpaid', !paid);
}

function openOrder(order, { scroll = true } = {}) {
    selectedOrder = order;
    document.getElementById('lookup-status').textContent =
        `Voucher ${order['Voucher No']} selected.`;
    document.getElementById('edit-panel').hidden = false;
    const container = document.getElementById('edit-fields');
    const tabsContainer = document.getElementById('edit-tabs');
    container.replaceChildren();
    tabsContainer.replaceChildren();
    const voucherLabel = document.createElement('label');
    voucherLabel.className = 'edit-field';
    voucherLabel.textContent = 'Voucher No. (Cannot be changed)';
    const voucherInput = document.createElement('input');
    voucherInput.value = order['Voucher No'];
    voucherInput.disabled = true;
    voucherLabel.append(voucherInput);
    container.append(voucherLabel);
    fieldGroups.forEach((group, groupIndex) => {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.id = `edit-tab-${groupIndex}`;
        tab.className = 'edit-tab';
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-controls', `edit-panel-${groupIndex}`);
        tab.setAttribute('aria-selected', 'false');
        tab.tabIndex = -1;
        tab.innerHTML = `<span class="edit-tab-number">0${groupIndex + 1}</span><span>${escapeText(group.title)}</span>`;
        tab.addEventListener('click', () => setActiveEditTab(groupIndex));
        tab.addEventListener('keydown', (event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? fieldGroups.length - 1 :
                (groupIndex + (event.key === 'ArrowRight' ? 1 : -1) + fieldGroups.length) % fieldGroups.length;
            setActiveEditTab(next, true);
        });
        tabsContainer.append(tab);

        const section = document.createElement('section');
        section.className = 'edit-group';
        section.id = `edit-panel-${groupIndex}`;
        section.setAttribute('role', 'tabpanel');
        section.setAttribute('aria-labelledby', tab.id);
        const heading = document.createElement('h3');
        heading.textContent = group.title;
        const grid = document.createElement('div');
        grid.className = `edit-grid${group.title === 'Books and Amounts' ? ' edit-grid--books' : ''}`;
        group.fields.forEach((field) => {
            const label = document.createElement('label');
            label.className = field === 'Complete' ? 'edit-field edit-field-checkbox' : 'edit-field';
            label.append(document.createTextNode(field));
            const input = document.createElement(field === 'Payment Method' ? 'select' : 'input');
            input.name = field;
            if (field === 'Complete') {
                input.type = 'checkbox';
                input.value = 'Yes';
                input.checked = ['yes', 'true', '1'].includes(String(orderField(order, field)).trim().toLowerCase());
                input.className = 'edit-checkbox';
            } else if (field === 'Pay Date' || field === 'Delivered Date') {
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
            } else {
                input.value = orderField(order, field);
                input.autocomplete = 'off';
            }
            label.append(input);
            grid.append(label);
        });
        section.append(heading, grid);
        if (group.title === 'Payment and Delivery Status') {
            const paymentStatus = document.createElement('div');
            paymentStatus.className = 'payment-status-preview';
            const paymentLabel = document.createElement('span');
            paymentLabel.textContent = 'Amount Received နှင့် Total အရ ငွေလက်ခံမှု';
            const paymentValue = document.createElement('strong');
            paymentValue.id = 'payment-status-preview';
            paymentValue.setAttribute('aria-live', 'polite');
            paymentStatus.append(paymentLabel, paymentValue);
            section.append(paymentStatus);
        }
        container.append(section);
    });
    setActiveEditTab(0);
    document.getElementById('edit-form').elements.namedItem('Total').addEventListener('input', paymentReceivedStatus);
    document.getElementById('edit-form').elements.namedItem('Amount Received').addEventListener('input', paymentReceivedStatus);
    paymentReceivedStatus();
    document.getElementById('edit-status').textContent = '';
    if (scroll) document.getElementById('edit-panel').scrollIntoView({ behavior: 'smooth' });
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
    updated.Complete = event.currentTarget.elements.namedItem('Complete').checked;
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
        status.textContent = error.message || 'Unable to save changes. Check the database API.';
        status.classList.add('error');
    } finally {
        button.disabled = false;
    }
});

const requestedVoucher = new URLSearchParams(window.location.search).get('voucher');
if (requestedVoucher) {
    const lookupPanel = document.getElementById('lookup-panel');
    const lookupStatus = document.getElementById('lookup-status');
    lookupPanel.hidden = true;
    document.getElementById('edit-order-hint').textContent = `Voucher ${requestedVoucher} ကို ရွေးပြီးပါပြီ။ ပြင်ဆင်ပြီး Save Changes ကိုနှိပ်ပါ။`;
    (async () => {
        try {
            const cached = await AdminApi.refreshOrders();
            orders = cached.data;
            const order = orders.find((item) => String(item['Voucher No']) === requestedVoucher);
            if (!order) throw new Error(`Voucher ${requestedVoucher} ကို Order History ထဲမှာ မတွေ့ပါ။`);
            openOrder(order, { scroll: false });
        } catch (error) {
            console.error('Unable to open the selected order.', error);
            lookupPanel.hidden = false;
            lookupStatus.textContent = error.message || 'ရွေးထားသော order ကို ဖွင့်မရပါ။';
            lookupStatus.classList.add('error');
        }
    })();
}
