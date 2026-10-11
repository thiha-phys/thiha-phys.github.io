const orderForm = document.getElementById('order-form');
const orderBookList = document.getElementById('order-book-list');
const orderStatus = document.getElementById('order-status');
const confirmOrderButton = document.getElementById('confirm-order');
const totalElement = document.getElementById('order-total');
const codRadio = orderForm.querySelector('input[value="COD"]');
const kbzPayRadio = orderForm.querySelector('input[value="KBZ Pay"]');
const COD_MAX_TOTAL = 150000;
const ROYAL_SERVICE_FEE = 300;
const PRICE_THRESHOLDS = [0, 10, 30, 50, 100];
const BOOK_PRICES = [
    [20000, 19000, 18000, 17000, 16000],
    [13000, 12000, 11500, 11000, 10500],
    [11000, 10000, 9500, 9000, 8800],
    [5000, 4500, 4000, 4000, 3800],
    [10000, 9000, 8500, 8000, 8000],
    [8000, 7000, 6500, 6500, 6500],
    [10000, 9000, 8500, 8000, 8000]
];
const BOOK_WEIGHTS = [0.7, 0.44925, 0.4668, 0.10437, 0.3, 0.25, 0.2];
const paymentNote = document.getElementById('payment-note');
const receiptCard = document.getElementById('receipt-card');
const orderSuccessDialog = document.getElementById('order-success-dialog');
const citySearch = document.getElementById('city-search');
const citySelect = document.getElementById('delivery-city');
const cityOptions = document.getElementById('city-options');
const cityStatus = document.getElementById('city-status');
const codHint = document.getElementById('cod-hint');
const carDeliveryDetails = document.getElementById('car-delivery-details');
const royalNote = document.getElementById('royal-note');
let deliveryCities = [];
let lastReceipt = null;
let orderSubmitted = false;
let activeCityIndex = -1;

function getOrderQuantities() {
    return PHYSICS_BOOKS.map((book) => {
        const input = orderBookList.querySelector(`[name="quantity-${book.id}"]`);
        const value = Number(input.value || 0);
        return Number.isSafeInteger(value) && value >= 0 ? value : 0;
    });
}

function getPricing() {
    const quantities = getOrderQuantities();
    const itemCount = quantities.reduce((total, quantity) => total + quantity, 0);
    const unitPrices = quantities.map((quantity, index) => {
        const tier = PRICE_THRESHOLDS.reduce((selectedTier, threshold, tierIndex) =>
            quantity >= threshold ? tierIndex : selectedTier, 0);
        return BOOK_PRICES[index][tier];
    });
    const total = quantities.reduce((amount, quantity, index) =>
        amount + quantity * unitPrices[index], 0);
    const weight = Math.round(quantities.reduce((amount, quantity, index) =>
        amount + quantity * BOOK_WEIGHTS[index], 0) * 100000) / 100000;
    return { quantities, itemCount, unitPrices, total, weight };
}

function getSelectedDeliveryService() {
    return orderForm.querySelector('input[name="deliveryService"]:checked')?.value || '';
}

function getSelectedCity() {
    return deliveryCities.find((city) => city.english === citySelect.value) || null;
}

function getRoyalDeliveryFee(weight, city) {
    const packageCount = Math.max(1, Math.ceil(weight / 5 - 0.000000001));
    const fullPackageFee = Number(city.upTo2Kg) + 3 * Number(city.nextKg);
    const lastPackageWeight = weight - 5 * (packageCount - 1);
    const extraKg = Math.ceil(Math.max(0, lastPackageWeight - 2) - 0.000000001);
    return (packageCount - 1) * fullPackageFee +
        Number(city.upTo2Kg) + extraKg * Number(city.nextKg) + ROYAL_SERVICE_FEE;
}

function updatePaymentOptions(totalWithDelivery) {
    const isCarDelivery = getSelectedDeliveryService() === 'Car';
    const codUnavailable = isCarDelivery || totalWithDelivery >= COD_MAX_TOTAL;
    codRadio.disabled = codUnavailable;
    codRadio.closest('.payment-option').hidden = isCarDelivery;
    if (codUnavailable && codRadio.checked) {
        codRadio.checked = false;
        kbzPayRadio.checked = true;
    }
    codHint.hidden = !codUnavailable || isCarDelivery;
}

function updateOrderTotal() {
    const pricing = getPricing();
    pricing.unitPrices.forEach((price, index) => {
        const priceElement = orderBookList.querySelector(`[data-book-price="${PHYSICS_BOOKS[index].id}"]`);
        priceElement.textContent = formatKyats(price);
    });
    totalElement.textContent = formatKyats(pricing.total);
    document.getElementById('order-weight').textContent = `${pricing.weight} kg`;

    const city = getSelectedCity();
    const service = getSelectedDeliveryService();
    const feeElement = document.getElementById('delivery-fee');
    const payableElement = document.getElementById('payable-total');
    let deliveryFee = 0;
    let feeReady = false;
    if (service === 'Car') {
        feeElement.textContent = '0 ကျပ် (ကားတင်ရန်)';
        feeReady = true;
    } else if (service === 'Royal' && city) {
        deliveryFee = getRoyalDeliveryFee(pricing.weight, city);
        feeElement.textContent = formatKyats(deliveryFee);
        feeReady = true;
    } else {
        feeElement.textContent = 'မြို့နှင့်ဝန်ဆောင်မှု ရွေးပါ';
    }

    const totalWithDelivery = pricing.total + deliveryFee;
    payableElement.textContent = feeReady ? formatKyats(totalWithDelivery) : 'တွက်ချက်ရန်လိုအပ်သည်';
    document.getElementById('royal-note').hidden = service !== 'Royal' || !city;
    document.getElementById('order-total-count').textContent =
        `${pricing.itemCount.toLocaleString('en-US')} အုပ်`;
    updatePaymentOptions(feeReady ? totalWithDelivery : pricing.total);
    updatePaymentNote();
}

function updatePaymentNote() {
    if (getSelectedDeliveryService() === 'Car') {
        paymentNote.textContent = 'ကားတင်ရန်အတွက် KBZ Pay တစ်မျိုးတည်းသာ ရွေးချယ်နိုင်ပါသည်။';
    } else if (codRadio.checked) {
        paymentNote.textContent = 'ပစ္စည်းရောက်ချိန်တွင် စာအုပ်ဖိုးနှင့် Royal ပို့ခကို ပေးချေရပါမည်။';
    } else {
        paymentNote.textContent = 'KBZ Pay ဖြင့် ငွေလွှဲပြီးနောက် ဘောက်ချာကို သိမ်းထားပါ။';
    }
}

function renderDeliveryCities() {
    const query = citySearch.value.trim().toLocaleLowerCase();
    const matches = deliveryCities.filter((city) =>
        city.english.toLocaleLowerCase().includes(query) ||
        city.myanmar.toLocaleLowerCase().includes(query)
    );
    activeCityIndex = -1;
    cityOptions.replaceChildren();
    if (matches.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'city-empty';
        empty.textContent = 'ကိုက်ညီသော မြို့ မတွေ့ပါ။';
        empty.setAttribute('role', 'option');
        empty.setAttribute('aria-disabled', 'true');
        cityOptions.append(empty);
    } else {
        matches.forEach((city) => {
            const option = document.createElement('li');
            option.className = 'city-option';
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', 'false');
            option.textContent = city.label;
            option.addEventListener('mousedown', (event) => event.preventDefault());
            option.addEventListener('click', () => selectDeliveryCity(city));
            cityOptions.append(option);
        });
    }
    cityOptions.hidden = false;
    citySearch.setAttribute('aria-expanded', 'true');
    cityStatus.textContent = query
        ? `${matches.length} မြို့ တွေ့ရှိသည်။ စာရင်းမှ ရွေးပါ။`
        : `${deliveryCities.length} မြို့ ရှိပါသည်။ စာရိုက်ရှာနိုင်ပါသည်။`;
}

function selectDeliveryCity(city) {
    citySearch.value = city.label;
    citySelect.value = city.english;
    cityOptions.hidden = true;
    citySearch.setAttribute('aria-expanded', 'false');
    citySearch.removeAttribute('aria-activedescendant');
    cityStatus.textContent = `ရွေးချယ်ထားသောမြို့ — ${city.label}`;
    updateOrderTotal();
}

function setActiveCityOption(index) {
    const options = Array.from(cityOptions.querySelectorAll('[role="option"]:not([aria-disabled="true"])'));
    if (options.length === 0) return;
    activeCityIndex = (index + options.length) % options.length;
    options.forEach((option, optionIndex) => {
        const active = optionIndex === activeCityIndex;
        option.setAttribute('aria-selected', String(active));
        if (active) {
            option.id = 'active-city-option';
            citySearch.setAttribute('aria-activedescendant', option.id);
            option.scrollIntoView({ block: 'nearest' });
        } else {
            option.removeAttribute('id');
        }
    });
}

orderForm.querySelectorAll('input[name="paymentMethod"]').forEach((input) => {
    input.addEventListener('change', updatePaymentNote);
});
orderForm.querySelectorAll('input[name="deliveryService"]').forEach((input) => {
    input.addEventListener('change', () => {
        const isCarDelivery = input.value === 'Car' && input.checked;
        carDeliveryDetails.hidden = !isCarDelivery;
        orderForm.elements.carDetails.required = isCarDelivery;
        updateOrderTotal();
    });
});

PHYSICS_BOOKS.forEach((book) => {
    const row = document.createElement('article');
    row.className = 'order-book';
    const imageLink = document.createElement('a');
    imageLink.href = `book-preview.html?book=${encodeURIComponent(book.id)}`;
    imageLink.setAttribute('aria-label', `${book.name} နမူနာစာမျက်နှာ ကြည့်ရန်`);
    const image = document.createElement('img');
    image.src = bookImagePath(book);
    image.alt = book.name;
    image.loading = 'lazy';
    image.draggable = false;
    imageLink.append(image);

    const info = document.createElement('div');
    info.className = 'order-book-info';
    const title = document.createElement('h3');
    title.textContent = book.name;
    const price = document.createElement('p');
    price.dataset.bookPrice = book.id;
    price.textContent = formatKyats(book.price);
    const quantityLabel = document.createElement('label');
    quantityLabel.className = 'quantity-label';
    quantityLabel.textContent = 'အရေအတွက်';
    const quantity = document.createElement('input');
    quantity.type = 'number';
    quantity.name = `quantity-${book.id}`;
    quantity.min = '0';
    quantity.step = '1';
    quantity.value = '0';
    quantity.inputMode = 'numeric';
    quantity.setAttribute('aria-label', `${book.name} အုပ်ရေ`);
    quantity.addEventListener('input', updateOrderTotal);
    quantityLabel.append(quantity);
    info.append(title, price, quantityLabel);
    row.append(imageLink, info);
    orderBookList.append(row);
});

citySearch.addEventListener('focus', () => {
    if (deliveryCities.length) renderDeliveryCities();
});
citySearch.addEventListener('input', () => {
    citySelect.value = '';
    renderDeliveryCities();
    updateOrderTotal();
});
citySearch.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (cityOptions.hidden) renderDeliveryCities();
        setActiveCityOption(activeCityIndex + 1);
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveCityOption(activeCityIndex < 0 ? 0 : activeCityIndex - 1);
    } else if (event.key === 'Enter' && !cityOptions.hidden && activeCityIndex >= 0) {
        event.preventDefault();
        const options = Array.from(cityOptions.querySelectorAll('[role="option"]:not([aria-disabled="true"])'));
        const selectedOption = options[activeCityIndex];
        const city = deliveryCities.find((candidate) => candidate.label === selectedOption?.textContent);
        if (city) selectDeliveryCity(city);
    } else if (event.key === 'Escape' && !cityOptions.hidden) {
        cityOptions.hidden = true;
        citySearch.setAttribute('aria-expanded', 'false');
    }
});
citySearch.addEventListener('change', () => {
    const match = deliveryCities.find((city) => city.label === citySearch.value);
    if (match) selectDeliveryCity(match);
});
document.addEventListener('click', (event) => {
    if (!event.target.closest('.city-picker')) {
        cityOptions.hidden = true;
        citySearch.setAttribute('aria-expanded', 'false');
    }
});

try {
    const profileData = localStorage.getItem('physicsLearningHubProfile');
    const profile = profileData ? JSON.parse(profileData) : null;
    if (profile && typeof profile === 'object') {
        orderForm.elements.name.value = typeof profile.name === 'string' ? profile.name : '';
        orderForm.elements.phone.value = typeof profile.phone === 'string' ? profile.phone : '';
    }
} catch (error) {
    console.error('Unable to load the saved account profile.', error);
}

getDeliveryCities()
    .then((cities) => {
        deliveryCities = cities;
        citySearch.disabled = false;
        cityStatus.textContent = `${deliveryCities.length} မြို့ ရှိပါသည်။ စာရိုက်ရှာနိုင်ပါသည်။`;
    })
    .catch((error) => {
        console.error('Unable to load delivery cities.', error);
        cityStatus.textContent = 'မြို့စာရင်းကို ရယူမရပါ။ အင်တာနက်နှင့် Google Sheet API deployment ကို စစ်ဆေးပါ။';
        confirmOrderButton.disabled = true;
    });

function addReceiptRow(container, label, value, className = '') {
    const row = document.createElement('div');
    row.className = `receipt-row ${className}`.trim();
    const key = document.createElement('span');
    key.textContent = label;
    const text = document.createElement('strong');
    text.textContent = value;
    row.append(key, text);
    container.append(row);
}

function displayReceipt(order) {
    document.getElementById('receipt-number').textContent = `${order.voucherNo}`;
    const details = document.getElementById('receipt-details');
    details.replaceChildren();
    addReceiptRow(details, 'အမည်', order.name);
    addReceiptRow(details, 'ဖုန်းနံပါတ် ၁', order.phone);
    if (order.phone2) addReceiptRow(details, 'ဖုန်းနံပါတ် ၂', order.phone2);
    addReceiptRow(details, 'လိပ်စာ', order.address);

    order.items.forEach((item) => {
        if (item.quantity > 0) {
            addReceiptRow(
                details,
                `${item.name} × ${item.quantity}`,
                formatKyats(item.amount),
                'receipt-book-row'
            );
        }
    });
    addReceiptRow(details, 'စာအုပ်ဖိုး စုစုပေါင်း', formatKyats(order.total), 'receipt-book-total');
    addReceiptRow(details, 'ဝန်ဆောင်မှု', order.deliveryService === 'Car'
        ? 'ကားတင်ရန် (ကားတင်ဘောက်ချာ ပြန်ပို့ပေးပါမည်)'
        : 'Royal Delivery Service',
        'receipt-delivery-row'
    );
    addReceiptRow(details, 'စုစုပေါင်းအလေးချိန်', `${order.totalKg} kg`, 'receipt-delivery-row');
    addReceiptRow(
        details,
        'ပို့ဆောင်ခ',
        order.deliveryService === 'Car' ? 'ကားဂိတ်တွင် သီးခြားပေးချေရန်' : formatKyats(order.deliveryFees),
        'receipt-delivery-total'
    );
    addReceiptRow(
        details,
        'စုစုပေါင်းကျသင့်ငွေ',
        formatKyats(order.total + order.deliveryFees),
        'receipt-grand-total'
    );

    if (order.paymentMethod !== 'COD') {
        addReceiptRow(details, 'KBZ Pay သို့ လွှဲရန်', '09-258 554 839 — U Thiha Kyaw', 'receipt-payment-row');
    }
    addReceiptRow(details, 'ငွေပေးချေမှု', order.paymentMethod, 'receipt-payment-row');
    receiptCard.hidden = false;
    receiptCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

orderForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    orderStatus.textContent = '';
    const pricing = getPricing();
    if (pricing.total <= 0) {
        orderStatus.textContent = 'စာအုပ်အရေအတွက် အနည်းဆုံး ၁ အုပ် ရွေးချယ်ပါ။';
        return;
    }
    if (!orderForm.reportValidity()) return;

    const formData = new FormData(orderForm);
    const city = getSelectedCity();
    const deliveryService = String(formData.get('deliveryService') || '');
    if (!city) {
        orderStatus.textContent = 'ပို့ဆောင်မည့်မြို့ကို ရွေးချယ်ပါ။';
        citySelect.focus();
        return;
    }
    const deliveryFees = deliveryService === 'Royal'
        ? getRoyalDeliveryFee(pricing.weight, city)
        : 0;
    const totalWithDelivery = pricing.total + deliveryFees;
    const paymentMethod = String(formData.get('paymentMethod') || '');
    if (deliveryService === 'Car' && paymentMethod !== 'KBZ Pay') {
        orderStatus.textContent = 'ကားတင်ရန်အတွက် KBZ Pay တစ်မျိုးတည်းသာ ရွေးချယ်နိုင်ပါသည်။';
        return;
    }
    if (paymentMethod === 'COD' && totalWithDelivery >= COD_MAX_TOTAL) {
        orderStatus.textContent = 'စာအုပ်ဖိုးနှင့် ပို့ခပေါင်း ၁၅၀,၀၀၀ ကျပ်နှင့်အထက်ဖြစ်သဖြင့် COD ရွေး၍မရပါ။ KBZ Pay ကို ရွေးပါ။';
        return;
    }

    const items = PHYSICS_BOOKS.map((book, index) => ({
        id: book.id,
        quantity: pricing.quantities[index]
    }));
    const order = {
        name: String(formData.get('name')).trim(),
        phone: String(formData.get('phone')).trim(),
        phone2: String(formData.get('phone2')).trim(),
        deliveryCity: city.english,
        address: String(formData.get('address')).trim(),
        deliveryService,
        carDetails: String(formData.get('carDetails')).trim(),
        paymentMethod,
        items
    };
    confirmOrderButton.disabled = true;
    confirmOrderButton.textContent = 'ပို့နေသည်…';
    try {
        const result = await submitOrder(order);
        lastReceipt = result.order;
        orderSubmitted = true;
        displayReceipt(result.order);
        orderSuccessDialog.showModal();
        orderStatus.textContent = 'မှာယူမှုကို လက်ခံရရှိပါပြီ။ ဘောက်ချာကို screenshot ရိုက်ထားပါ သို့မဟုတ် Print / Save PDF ကို အသုံးပြုပါ။';
    } catch (error) {
        console.error('Unable to submit the book order.', error);
        orderStatus.textContent = 'မှာယူမှု မအောင်မြင်ပါ။ အချက်အလက်နှင့် Google Sheet API setting ကို စစ်ပြီး ထပ်မံကြိုးစားပါ။';
    } finally {
        confirmOrderButton.disabled = orderSubmitted;
        confirmOrderButton.textContent = orderSubmitted ? 'မှာယူပြီးပါပြီ' : 'မှာယူမှု အတည်ပြုမည်';
    }
});

document.getElementById('close-order-success').addEventListener('click', () => {
    orderSuccessDialog.close();
});

document.getElementById('view-order-receipt').addEventListener('click', () => {
    orderSuccessDialog.close();
    receiptCard.focus();
});

document.getElementById('print-receipt').addEventListener('click', () => {
    if (lastReceipt) window.print();
});

updateOrderTotal();
