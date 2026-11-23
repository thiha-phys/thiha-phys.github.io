const form = document.getElementById('create-order-form');
const quantityInputs = new Map();
const deliveryCities = [];
let submitted = false;
let priceThresholds = [0, 10, 30, 50, 100];
let codMaxTotal = 150000;
let royalServiceFee = 300;
document.getElementById('submit-order').disabled = true;

function selectedDeliveryService() {
    return form.querySelector('input[name="deliveryService"]:checked')?.value || '';
}

function selectedCity() {
    const value = document.getElementById('delivery-city').value.trim().toLocaleLowerCase();
    return deliveryCities.find((city) =>
        city.label.toLocaleLowerCase() === value ||
        city.english.toLocaleLowerCase() === value ||
        city.myanmar.toLocaleLowerCase() === value
    ) || null;
}

function bookPricing(book, quantity) {
    const tier = priceThresholds.reduce((selected, threshold, index) =>
        quantity >= threshold ? index : selected, 0);
    return book.prices[tier];
}

function roundDeliveryWeight(weight) {
    if (weight <= 0) return 0;
    const weightUnits = Math.round(weight * 100000);
    const wholeKg = Math.floor(weightUnits / 100000);
    const fractionalUnits = weightUnits - wholeKg * 100000;
    if (fractionalUnits < 60000) return wholeKg + 0.5;
    return wholeKg + 1;
}

function getRoyalDeliveryFee(weight, city) {
    const packages = Math.max(1, Math.ceil(weight / 5 - 0.000000001));
    const fullPackageFee = Number(city.upTo2Kg) + 3 * Number(city.nextKg);
    const lastPackageWeight = weight - 5 * (packages - 1);
    const extraKg = Math.ceil(Math.max(0, lastPackageWeight - 2) - 0.000000001);
    return (packages - 1) * fullPackageFee +
        Number(city.upTo2Kg) + extraKg * Number(city.nextKg) + royalServiceFee;
}

function getPricing() {
    const quantities = AdminBooks.map((book) => Number(quantityInputs.get(book.id).value || 0));
    const amounts = quantities.map((quantity, index) =>
        quantity * bookPricing(AdminBooks[index], quantity));
    const total = amounts.reduce((sum, amount) => sum + amount, 0);
    const actualWeight = Math.round(quantities.reduce((sum, quantity, index) =>
        sum + quantity * AdminBooks[index].weight, 0) * 100000) / 100000;
    const weight = roundDeliveryWeight(actualWeight);
    return { quantities, amounts, total, weight };
}

function getRoundingAdjustment(total) {
    return total % 100 === 50 ? 50 : 0;
}

function roundDeliveryFeeTo500(fee) {
    return Math.ceil(fee / 500 - 0.000000001) * 500;
}

function updatePaymentOptions(totalWithDelivery) {
    const cod = form.querySelector('input[name="paymentMethod"][value="COD"]');
    const kbzPay = form.querySelector('input[name="paymentMethod"][value="KBZ Pay"]');
    const carDelivery = selectedDeliveryService() === 'Car';
    const unavailable = carDelivery || totalWithDelivery >= codMaxTotal;
    document.getElementById('cod-hint').textContent =
        `COD is unavailable for orders of ${formatKyats(codMaxTotal)} or more, or for Bus Gate Delivery. Please select KBZ Pay.`;
    cod.disabled = unavailable;
    cod.closest('.payment-option').hidden = carDelivery;
    document.getElementById('cod-hint').hidden = !unavailable || carDelivery;
    if (unavailable && cod.checked) kbzPay.checked = true;
}

function updateSummary() {
    const pricing = getPricing();
    const city = selectedCity();
    const service = selectedDeliveryService();
    const totalElement = document.getElementById('order-total');
    const weightElement = document.getElementById('order-weight');
    const feeElement = document.getElementById('delivery-fee');
    const payableElement = document.getElementById('payable-total');
    const deliveryNote = document.getElementById('delivery-note');
    let deliveryFee = 0;
    let feeIsKnown = false;

    AdminBooks.forEach((book, index) => {
        const price = document.querySelector(`[data-book-price="${book.id}"]`);
        const amount = document.querySelector(`[data-book-amount="${book.id}"]`);
        price.textContent = formatKyats(bookPricing(book, pricing.quantities[index]));
        amount.textContent = formatKyats(pricing.amounts[index]);
    });
    totalElement.textContent = formatKyats(pricing.total);
    weightElement.textContent = `Total weight: ${pricing.weight} kg`;

    if (service === 'Car') {
        feeElement.textContent = 'Pay separately at the bus gate';
        feeIsKnown = true;
        deliveryNote.textContent = 'Please send the bus ticket after dispatch.';
    } else if (service === 'Royal' && city) {
        deliveryFee = getRoyalDeliveryFee(pricing.weight, city);
        feeIsKnown = true;
        deliveryNote.textContent = 'The Royal Delivery voucher will be sent after dispatch.';
    } else {
        feeElement.textContent = 'Select a city and service';
        deliveryNote.textContent = '';
    }
    deliveryNote.hidden = !deliveryNote.textContent;
    deliveryFee = feeIsKnown ? roundDeliveryFeeTo500(deliveryFee) : deliveryFee;
    if (service === 'Royal' && city) feeElement.textContent = formatKyats(deliveryFee);
    const totalPayable = pricing.total + deliveryFee;
    payableElement.textContent = feeIsKnown
        ? formatKyats(totalPayable)
        : 'Calculation required';
    updatePaymentOptions(feeIsKnown ? totalPayable : pricing.total);
}

function renderBookInputs() {
    const container = document.getElementById('book-quantities');
    container.replaceChildren();
    quantityInputs.clear();
    AdminBooks.forEach((book) => {
        const label = document.createElement('label');
        label.className = 'field order-book-field';
        label.append(document.createTextNode(book.name));
        const price = document.createElement('strong');
        price.className = 'book-unit-price';
        price.dataset.bookPrice = book.id;
        const input = document.createElement('input');
        input.type = 'number';
        input.name = `quantity-${book.id}`;
        input.min = '0';
        input.step = '1';
        input.value = '0';
        input.inputMode = 'numeric';
        input.setAttribute('aria-label', `${book.name} quantity`);
        const amount = document.createElement('small');
        amount.className = 'book-amount';
        amount.dataset.bookAmount = book.id;
        amount.textContent = formatKyats(0);
        input.addEventListener('input', updateSummary);
        label.append(price, input, amount);
        container.append(label);
        quantityInputs.set(book.id, input);
    });
}

function receiptRow(label, value) {
    const row = document.createElement('div');
    row.className = 'receipt-line';
    const name = document.createElement('span');
    name.textContent = label;
    const text = document.createElement('strong');
    text.textContent = value || '—';
    row.append(name, text);
    return row;
}

function showReceipt(order) {
    document.getElementById('receipt-voucher').textContent = `Voucher No. ${order.voucherNo}`;
    const content = document.getElementById('receipt-content');
    content.replaceChildren();
    const receiptRows = [
        ['Name', order.name],
        ['Phone (Personal)', order.phone],
        ['Phone (Work)', order.phone2],
        ['Address', order.address],
        ['Order Date', order.orderDate],
        ['Delivery', order.deliveryService === 'Car' ? 'Bus Gate Delivery' : 'Royal Delivery Service'],
        ['Payment Method', order.paymentMethod]
    ];
    if (order.deliveryService === 'Car') {
        receiptRows.push(['Bus Gate / Bus Name', order.carInfo || order.deliveryNotes]);
    }
    receiptRows.forEach(([label, value]) => content.append(receiptRow(label, value)));
    order.items.filter((item) => item.quantity > 0).forEach((item) =>
        content.append(receiptRow(`${item.name} × ${item.quantity}`, formatKyats(item.amount))));
    const totals = document.getElementById('receipt-totals');
    totals.replaceChildren();
    totals.append(receiptRow('Total Weight', `${order.totalKg} kg`));
    totals.append(receiptRow('Books Subtotal', formatKyats(order.total)));
    totals.append(receiptRow('Delivery Fee', order.deliveryService === 'Car'
        ? 'Pay separately at the bus gate'
        : formatKyats(order.deliveryFees)));
    totals.append(receiptRow('Cash Collection', formatKyats(order.cashCollection)));
    document.getElementById('receipt-total').textContent = formatKyats(order.payableTotal);
    document.getElementById('created-receipt').hidden = false;
    document.getElementById('created-receipt').scrollIntoView({ behavior: 'smooth' });
}

form.querySelectorAll('input[name="deliveryService"]').forEach((radio) => {
    radio.addEventListener('change', () => {
        const isCar = selectedDeliveryService() === 'Car';
        document.getElementById('car-details-field').hidden = !isCar;
        form.elements.carDetails.required = isCar;
        updateSummary();
    });
});
form.querySelectorAll('input[name="paymentMethod"]').forEach((radio) =>
    radio.addEventListener('change', updateSummary)
);
document.getElementById('delivery-city').addEventListener('input', updateSummary);

AdminApi.getDeliveryCities()
    .then((cities) => {
        deliveryCities.push(...cities);
        const settings = AdminMasterData.settings;
        priceThresholds = settings.priceThresholds.map(Number);
        codMaxTotal = Number(settings.codMaxTotal);
        royalServiceFee = Number(settings.royalServiceFee);
        renderBookInputs();
        const options = document.getElementById('delivery-city-options');
        cities.forEach((city) => {
            const option = document.createElement('option');
            option.value = city.label;
            options.append(option);
        });
        document.getElementById('delivery-city').disabled = false;
        document.getElementById('city-status').textContent =
            `${cities.length} cities available. Search by English or Myanmar name.`;
        document.getElementById('submit-order').disabled = false;
        updateSummary();
    })
    .catch((error) => {
        console.error('Unable to load delivery cities.', error);
        document.getElementById('city-status').textContent =
            'Unable to load cities. Check your internet connection and the database API.';
        document.getElementById('submit-order').disabled = true;
    });

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.getElementById('order-status');
    status.className = 'status-message';
    status.textContent = '';
    if (!form.reportValidity()) return;
    const pricing = getPricing();
    if (pricing.quantities.some((quantity) => !Number.isSafeInteger(quantity) || quantity < 0)) {
        status.textContent = 'Enter a whole-number quantity of 0 or more.';
        status.classList.add('error');
        return;
    }
    if (pricing.total <= 0) {
        status.textContent = 'Enter a quantity for at least one book.';
        status.classList.add('error');
        return;
    }
    const city = selectedCity();
    if (!city) {
        status.textContent = 'Select a delivery city from the city list.';
        status.classList.add('error');
        return;
    }
    const service = selectedDeliveryService();
    const baseDeliveryFee = service === 'Royal' ? getRoyalDeliveryFee(pricing.weight, city) : 0;
    const deliveryFee = roundDeliveryFeeTo500(baseDeliveryFee);
    const totalPayable = pricing.total + deliveryFee;
    const paymentMethod = form.querySelector('input[name="paymentMethod"]:checked')?.value || '';
    if (service === 'Car' && paymentMethod !== 'KBZ Pay') {
        status.textContent = 'Only KBZ Pay is available for Bus Gate Delivery.';
        status.classList.add('error');
        return;
    }
    if (paymentMethod === 'COD' && totalPayable >= codMaxTotal) {
        status.textContent = `COD is unavailable for orders of ${formatKyats(codMaxTotal)} or more.`;
        status.classList.add('error');
        return;
    }
    const data = new FormData(form);
    const order = {
        name: String(data.get('name')).trim(),
        phone: String(data.get('phone')).trim(),
        phone2: String(data.get('phone2')).trim(),
        deliveryCity: city.english,
        address: String(data.get('address')).trim(),
        deliveryService: service,
        carDetails: String(data.get('carDetails')).trim(),
        paymentMethod,
        items: AdminBooks.map((book, index) => ({
            id: book.id,
            quantity: pricing.quantities[index]
        }))
    };
    const button = document.getElementById('submit-order');
    button.disabled = true;
    status.textContent = 'Saving order…';
    try {
        const result = await AdminApi.createOrder(order);
        submitted = true;
        form.querySelectorAll('input, textarea, select, button').forEach((field) => {
            field.disabled = true;
        });
        showReceipt(result.order);
        status.textContent = result.localCacheError
            ? 'Order saved to the database, but the local cache could not be updated.'
            : result.cacheNeedsRefresh
                ? 'Order saved to the database. Refresh to load the complete data.'
                : 'Order saved. You can save, share, or print the voucher as a PDF.';
        status.classList.add(result.localCacheError || result.cacheNeedsRefresh ? 'error' : 'success');
        button.textContent = 'Order Confirmed';
    } catch (error) {
        console.error('Unable to create order.', error);
        status.textContent = 'Unable to save the order. Check your internet connection and the database API.';
        status.classList.add('error');
    } finally {
        button.disabled = submitted;
    }
});

document.getElementById('print-created-receipt').addEventListener('click', () => window.print());
attachReceiptActions({
    receiptId: 'created-receipt',
    shareButtonId: 'share-created-receipt',
    statusId: 'created-receipt-action-status'
});
