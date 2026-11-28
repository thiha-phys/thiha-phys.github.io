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
            'Delivered Date', 'Delivery', 'car inform', 'Royal VOC No',
            'Royal Statement COD Charge', 'Royal Statement Paid Charge', 'Royal Statement Paid Date',
            'Complete'
        ]
    },
    {
        title: 'Social Media Information',
        fields: ['Facebook Account Name', 'Facebook Link']
    }
];
let selectedOrder = null;

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
    const deliveryFee = Number(String(selectedOrder?.['Delivery Fees'] || '0').replaceAll(',', ''));
    const paid = Number.isFinite(total) && Number.isFinite(amountReceived) &&
        Number.isFinite(deliveryFee) && total + deliveryFee <= amountReceived + deliveryFee;
    const result = document.getElementById('payment-status-preview');
    result.textContent = paid ? 'ငွေလက်ခံရရှိပြီး' : 'ငွေမရှင်းရသေး';
    result.classList.toggle('is-paid', paid);
    result.classList.toggle('is-unpaid', !paid);
}

function openOrder(order, { scroll = true } = {}) {
    selectedOrder = order;
    document.getElementById('edit-panel').hidden = false;
    const container = document.getElementById('edit-fields');
    const tabsContainer = document.getElementById('edit-tabs');
    container.replaceChildren();
    tabsContainer.replaceChildren();
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
            const isChoice = ['Payment Method', 'Delivery'].includes(field);
            const label = document.createElement(isChoice ? 'div' : 'label');
            label.className = field === 'Complete'
                ? 'edit-field edit-field-checkbox edit-complete-checkbox'
                : `edit-field${isChoice ? ' edit-field-choice' : ''}`;
            if (field === 'Complete') {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.name = field;
                checkbox.value = 'Yes';
                checkbox.checked = ['yes', 'true', '1'].includes(String(orderField(order, field)).trim().toLowerCase());
                checkbox.className = 'edit-checkbox';
                label.append(checkbox, document.createTextNode('Complete — အမှာစာကို Customer ထံပို့ဆောင်ပြီး လက်ခံရရှိကြောင်း အတည်ပြုပါသည်။'));
                grid.append(label);
                return;
            }
            label.append(document.createTextNode(field === 'Amount Received' ? 'Amount Received (Books only)' : field));
            if (isChoice) {
                const options = field === 'Payment Method'
                    ? [['KBZ Pay', 'KBZ Pay'], ['COD', 'Cash on Delivery (COD)']]
                    : [['Royal', 'Royal'], ['Car', 'Car']];
                const choices = document.createElement('div');
                choices.className = 'edit-radio-options';
                choices.setAttribute('role', 'radiogroup');
                choices.setAttribute('aria-label', field);
                const currentValue = orderField(order, field).trim().toLowerCase();
                const selectedValue = field === 'Payment Method'
                    ? currentValue === 'cod' ? 'COD' : 'KBZ Pay'
                    : ['car', 'bus gate delivery'].includes(currentValue) ? 'Car' : 'Royal';
                options.forEach(([value, text]) => {
                    const option = document.createElement('label');
                    option.className = 'payment-option';
                    const radio = document.createElement('input');
                    radio.type = 'radio';
                    radio.name = field;
                    radio.value = value;
                    radio.checked = value === selectedValue;
                    radio.required = true;
                    option.append(radio, document.createTextNode(text));
                    choices.append(option);
                });
                label.append(choices);
                if (field === 'Delivery') {
                    const deliveryRadios = [...choices.querySelectorAll('input')];
                    const syncCarPayment = () => {
                        const isCar = deliveryRadios.some((radio) => radio.checked && radio.value === 'Car');
                        const codRadio = document.querySelector('#edit-form input[name="Payment Method"][value="COD"]');
                        const kbzRadio = document.querySelector('#edit-form input[name="Payment Method"][value="KBZ Pay"]');
                        codRadio.disabled = isCar;
                        if (isCar && codRadio.checked) kbzRadio.checked = true;
                    };
                    deliveryRadios.forEach((radio) => radio.addEventListener('change', syncCarPayment));
                    syncCarPayment();
                }
                grid.append(label);
                return;
            }
            const input = document.createElement('input');
            input.name = field;
            if (['Pay Date', 'Delivered Date', 'Royal Statement Paid Date'].includes(field)) {
                input.type = 'date';
                input.value = dateInputValue(orderField(order, field));
            } else if (field.endsWith('Qty') || field === 'Total' ||
                field === 'Amount Received' || field.endsWith('Amount') ||
                ['Royal Statement COD Charge', 'Royal Statement Paid Charge'].includes(field)) {
                input.type = 'number';
                input.min = '0';
                input.step = '1';
                input.inputMode = 'numeric';
                input.value = orderField(order, field);
            } else {
                input.value = orderField(order, field);
                input.autocomplete = 'off';
            }
            label.append(input);
            if (field === 'Amount Received') {
                const hint = document.createElement('small');
                hint.className = 'field-hint';
                hint.textContent = 'စာအုပ်ဖိုးသာ ထည့်ပါ။ ပို့ခကို ဒီနေရာမှာ မပေါင်းပါနှင့်။';
                label.append(hint);
            }
            grid.append(label);
        });
        section.append(heading, grid);
        if (group.title === 'Payment and Delivery Status') {
            const paymentStatus = document.createElement('div');
            paymentStatus.className = 'payment-status-preview';
            const paymentLabel = document.createElement('span');
            paymentLabel.textContent = 'Total + Delivery Fees နှင့် Received + Delivery Fees အရ ငွေလက်ခံမှု';
            const paymentValue = document.createElement('strong');
            paymentValue.id = 'payment-status-preview';
            paymentValue.setAttribute('aria-live', 'polite');
            paymentStatus.append(paymentLabel, paymentValue);
            section.insertBefore(paymentStatus, grid);
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
const editEntryStatus = document.getElementById('edit-entry-status');
if (requestedVoucher) {
    document.getElementById('edit-order-hint').textContent = `Voucher ${requestedVoucher} ကို ရွေးပြီးပါပြီ။ ပြင်ဆင်ပြီး Save Changes ကိုနှိပ်ပါ။`;
    (async () => {
        try {
            const cached = await AdminApi.refreshOrders();
            const order = cached.data.find((item) => String(item['Voucher No']) === requestedVoucher);
            if (!order) throw new Error(`Voucher ${requestedVoucher} ကို Order History ထဲမှာ မတွေ့ပါ။`);
            openOrder(order, { scroll: false });
        } catch (error) {
            console.error('Unable to open the selected order.', error);
            editEntryStatus.textContent = error.message || 'ရွေးထားသော order ကို ဖွင့်မရပါ။';
            editEntryStatus.classList.add('error');
            editEntryStatus.hidden = false;
        }
    })();
} else {
    editEntryStatus.textContent = 'Order History ထဲမှ သက်ဆိုင်ရာအမှာစာ၏ Edit ကိုနှိပ်ပြီး ဖွင့်ပါ။';
    editEntryStatus.classList.add('error');
    editEntryStatus.hidden = false;
}
