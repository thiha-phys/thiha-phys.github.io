const orderForm = document.getElementById('order-form');
const orderBookList = document.getElementById('order-book-list');
const orderStatus = document.getElementById('order-status');
const confirmOrderButton = document.getElementById('confirm-order');
confirmOrderButton.disabled = true;
const totalElement = document.getElementById('order-total');
const codRadio = orderForm.querySelector('input[value="COD"]');
const kbzPayRadio = orderForm.querySelector('input[value="KBZ Pay"]');
const paymentNote = document.getElementById('payment-note');
const receiptCard = document.getElementById('receipt-card');
const receiptShareStatus = document.getElementById('receipt-share-status');
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
let orderBooks = [];

function getOrderQuantities() {
    return orderBooks.map((book) => {
        const input = orderBookList.querySelector(`[name="quantity-${book.id}"]`);
        const value = Number(input?.value || 0);
        return Number.isSafeInteger(value) && value >= 0 ? value : 0;
    });
}

function getPricing() {
    const quantities = getOrderQuantities();
    const itemCount = quantities.reduce((total, quantity) => total + quantity, 0);
    const unitPrices = quantities.map((quantity, index) => {
        const book = window.PHYSICS_ORDER_MASTER_DATA?.books?.[orderBooks[index].id];
        const prices = book?.prices || [];
        const thresholds = window.PHYSICS_ORDER_MASTER_DATA?.settings?.priceThresholds || [];
        const tier = thresholds.reduce((selectedTier, threshold, tierIndex) =>
            quantity >= threshold ? tierIndex : selectedTier, 0);
        return Number(prices[tier] || 0);
    });
    const total = quantities.reduce((amount, quantity, index) =>
        amount + quantity * unitPrices[index], 0);
    const actualWeight = Math.round(quantities.reduce((amount, quantity, index) =>
        amount + quantity * Number(window.PHYSICS_ORDER_MASTER_DATA?.books?.[orderBooks[index].id]?.weight || 0), 0) * 100000) / 100000;
    const weight = roundDeliveryWeight(actualWeight);
    return { quantities, itemCount, unitPrices, total, actualWeight, weight };
}

function roundDeliveryWeight(weight) {
    if (weight <= 0) return 0;
    const weightUnits = Math.round(weight * 100000);
    const wholeKg = Math.floor(weightUnits / 100000);
    const fractionalUnits = weightUnits - wholeKg * 100000;
    return fractionalUnits < 60000 ? wholeKg + 0.5 : wholeKg + 1;
}

function getSelectedDeliveryService() {
    return orderForm.querySelector('input[name="deliveryService"]:checked')?.value || '';
}

function getSelectedCity() {
    return deliveryCities.find((city) => city.english === citySelect.value) || null;
}

function getRoyalDeliveryFee(weight, city) {
    const serviceFee = Number(window.PHYSICS_ORDER_MASTER_DATA?.settings?.royalServiceFee || 0);
    const packageCount = Math.max(1, Math.ceil(weight / 5 - 0.000000001));
    const fullPackageFee = Number(city.upTo2Kg) + 3 * Number(city.nextKg);
    const lastPackageWeight = weight - 5 * (packageCount - 1);
    const extraKg = Math.ceil(Math.max(0, lastPackageWeight - 2) - 0.000000001);
    return (packageCount - 1) * fullPackageFee +
        Number(city.upTo2Kg) + extraKg * Number(city.nextKg) + serviceFee;
}

function getFinalRoyalDeliveryFee(weight, city) {
    const feeIncludingService = getRoyalDeliveryFee(weight, city);
    return Math.ceil(feeIncludingService / 500 - 0.000000001) * 500;
}

function updatePaymentOptions(totalWithDelivery) {
    const isCarDelivery = getSelectedDeliveryService() === 'Car';
    const codMaxTotal = Number(window.PHYSICS_ORDER_MASTER_DATA?.settings?.codMaxTotal || 0);
    codHint.textContent = `စုစုပေါင်း ${formatKyats(codMaxTotal)} နှင့်အထက် သို့မဟုတ် ကားတင်ရန်ဆိုပါက KBZ Pay သာ ရွေးနိုင်ပါသည်။`;
    const codUnavailable = isCarDelivery || totalWithDelivery >= codMaxTotal;
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
        const priceElement = orderBookList.querySelector(`[data-book-price="${orderBooks[index].id}"]`);
        if (priceElement) priceElement.textContent = formatKyats(price);
    });
    totalElement.textContent = formatKyats(pricing.total);
    document.getElementById('order-weight').textContent = pricing.itemCount > 0
        ? `${pricing.weight} kg`
        : '—';

    const city = getSelectedCity();
    const service = getSelectedDeliveryService();
    const feeElement = document.getElementById('delivery-fee');
    const payableElement = document.getElementById('payable-total');
    let deliveryFee = 0;
    let feeReady = false;
    if (service === 'Car') {
        feeReady = true;
    } else if (service === 'Royal' && city) {
        deliveryFee = getFinalRoyalDeliveryFee(pricing.actualWeight, city);
        feeReady = true;
    } else {
        feeElement.textContent = 'မြို့နှင့်ဝန်ဆောင်မှု ရွေးပါ';
    }

    if (feeReady) {
        feeElement.textContent = service === 'Car'
            ? `${formatKyats(deliveryFee)} (ကားတင်ရန်)`
            : formatKyats(deliveryFee);
    }
    const totalPayable = pricing.total + deliveryFee;
    payableElement.textContent = feeReady ? formatKyats(totalPayable) : 'တွက်ချက်ရန်လိုအပ်သည်';
    document.getElementById('royal-note').hidden = service !== 'Royal' || !city;
    document.getElementById('order-total-count').textContent =
        `${pricing.itemCount.toLocaleString('en-US')} အုပ်`;
    updatePaymentOptions(feeReady ? totalPayable : pricing.total);
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

function renderOrderBooks(masterData) {
    orderBookList.replaceChildren();
    orderBooks = getOrderBooks(masterData);
    orderBooks.forEach((book) => {
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
        price.textContent = formatKyats(book.prices[0]);
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
}

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
        renderOrderBooks(window.PHYSICS_ORDER_MASTER_DATA);
        citySearch.disabled = false;
        confirmOrderButton.disabled = false;
        cityStatus.textContent = `${deliveryCities.length} မြို့ ရှိပါသည်။ စာရိုက်ရှာနိုင်ပါသည်။`;
        updateOrderTotal();
    })
    .catch((error) => {
        console.error('Unable to load delivery cities.', error);
        cityStatus.textContent = `မှာယူမှုအချက်အလက်ကို ရယူမရပါ။ ${error.message}`;
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
    receiptShareStatus.textContent = '';
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
        ? 'ကားတင်ရန်'
        : 'Royal Delivery Service',
        'receipt-delivery-row'
    );
    addReceiptRow(details, 'စုစုပေါင်းအလေးချိန်', `${order.totalKg} kg`, 'receipt-delivery-row');
    addReceiptRow(
        details,
        'ပို့ဆောင်ခ',
        order.deliveryService === 'Car'
            ? order.deliveryFees > 0
                ? `${formatKyats(order.deliveryFees)} + ကားဂိတ်ခ သီးခြား`
                : 'ကားဂိတ်တွင် သီးခြားပေးချေရန်'
            : formatKyats(order.deliveryFees),
        'receipt-delivery-total'
    );
    addReceiptRow(
        details,
        'စုစုပေါင်းကျသင့်ငွေ',
        formatKyats(order.payableTotal),
        'receipt-grand-total'
    );

    if (order.paymentMethod !== 'COD') {
        addReceiptRow(details, 'KBZ Pay သို့ လွှဲရန်', '09-258 554 839 - U Thiha Kyaw', 'receipt-payment-row');
    }
    addReceiptRow(details, 'ငွေပေးချေမှု', order.paymentMethod, 'receipt-payment-row');
    receiptCard.hidden = false;
    receiptCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function escapeSvgText(value) {
    return String(value).replace(/[<>&"']/g, (character) => ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;'
    })[character]);
}

function getReceiptTextLines(textNode, origin) {
    const parent = textNode.parentElement;
    const style = window.getComputedStyle(parent);
    const segments = typeof Intl.Segmenter === 'function'
        ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(textNode.textContent),
            (segment) => ({ text: segment.segment, index: segment.index }))
        : Array.from(textNode.textContent).map((text, index) => ({ text, index }));
    const lines = [];
    segments.forEach((segment, index) => {
        const range = document.createRange();
        range.setStart(textNode, segment.index);
        range.setEnd(textNode, segments[index + 1]?.index ?? textNode.textContent.length);
        const bounds = range.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        const lineTop = Math.round(bounds.top * 2) / 2;
        let line = lines.find((candidate) => candidate.top === lineTop);
        if (!line) {
            line = { top: lineTop, left: bounds.left, right: bounds.right, height: bounds.height, text: '' };
            lines.push(line);
        }
        line.left = Math.min(line.left, bounds.left);
        line.right = Math.max(line.right, bounds.right);
        line.text += segment.text;
    });

    const fontSize = parseFloat(style.fontSize) || 12;
    return lines.map((line) => {
        const baseline = line.top - origin.top + (line.height - fontSize) / 2 + fontSize * 0.82;
        return `<text x="${line.left - origin.left}" y="${baseline}" textLength="${line.right - line.left}" lengthAdjust="spacingAndGlyphs" fill="${escapeSvgText(style.color)}" font-family="${escapeSvgText(style.fontFamily)}" font-size="${fontSize}" font-weight="${escapeSvgText(style.fontWeight)}" font-style="${escapeSvgText(style.fontStyle)}" letter-spacing="${escapeSvgText(style.letterSpacing)}" xml:space="preserve">${escapeSvgText(line.text)}</text>`;
    });
}

function getReceiptElementBackground(element, origin) {
    const bounds = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const x = bounds.left - origin.left;
    const y = bounds.top - origin.top;
    const width = bounds.width;
    const height = bounds.height;
    const parts = [];
    if (style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') {
        parts.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${parseFloat(style.borderTopLeftRadius) || 0}" fill="${escapeSvgText(style.backgroundColor)}"/>`);
    }
    const borders = [
        ['Top', x, y, x + width, y],
        ['Right', x + width, y, x + width, y + height],
        ['Bottom', x, y + height, x + width, y + height],
        ['Left', x, y, x, y + height]
    ].map(([side, x1, y1, x2, y2]) => {
        const borderWidth = parseFloat(style[`border${side}Width`]) || 0;
        return {
            side,
            x1,
            y1,
            x2,
            y2,
            width: borderWidth,
            color: style[`border${side}Color`],
            style: style[`border${side}Style`]
        };
    });
    const [firstBorder, ...otherBorders] = borders;
    const uniformBorder = firstBorder.width > 0 && otherBorders.every((border) =>
        border.width === firstBorder.width &&
        border.color === firstBorder.color &&
        border.style === firstBorder.style
    );
    if (uniformBorder && firstBorder.style !== 'none' && firstBorder.style !== 'hidden') {
        const radius = parseFloat(style.borderTopLeftRadius) || 0;
        const dash = firstBorder.style === 'dashed' ? ' stroke-dasharray="6 4"' : '';
        parts.push(`<rect x="${x + firstBorder.width / 2}" y="${y + firstBorder.width / 2}" width="${width - firstBorder.width}" height="${height - firstBorder.width}" rx="${radius}" fill="none" stroke="${escapeSvgText(firstBorder.color)}" stroke-width="${firstBorder.width}"${dash}/>`);
    } else borders.forEach((border) => {
        const { side, x1, y1, x2, y2, width: borderWidth, color, style: borderStyle } = border;
        if (borderWidth && borderStyle !== 'none' && borderStyle !== 'hidden') {
            const dash = borderStyle === 'dashed' ? ' stroke-dasharray="6 4"' : '';
            parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${escapeSvgText(color)}" stroke-width="${borderWidth}"${dash}/>`);
        }
    });
    return parts;
}

async function getReceiptLogoDataUrl(image) {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable.');
    context.drawImage(image, 0, 0);
    return canvas.toDataURL('image/png');
}

async function createReceiptImage() {
    const bounds = receiptCard.getBoundingClientRect();
    const origin = { left: bounds.left, top: bounds.top };
    const width = Math.ceil(bounds.width);
    const cardStyle = window.getComputedStyle(receiptCard);
    const detailsBottom = receiptCard.querySelector('.receipt-details').getBoundingClientRect().bottom;
    const height = Math.ceil(
        detailsBottom - bounds.top +
        (parseFloat(cardStyle.paddingBottom) || 0) +
        (parseFloat(cardStyle.borderBottomWidth) || 0)
    );
    const parts = [];
    const logo = receiptCard.querySelector('.receipt-logo');
    const logoDataUrl = logo && logo.complete && logo.naturalWidth
        ? await getReceiptLogoDataUrl(logo)
        : '';
    const drawElement = (element) => {
        if (element.matches('.receipt-actions, .receipt-share-status')) return;
        parts.push(...getReceiptElementBackground(element, origin));
        if (element instanceof HTMLImageElement) {
            if (!logoDataUrl || !element.naturalWidth || !element.naturalHeight) return;
            const imageBounds = element.getBoundingClientRect();
            const aspectRatio = element.naturalWidth / element.naturalHeight;
            const imageWidth = Math.min(imageBounds.width, imageBounds.height * aspectRatio);
            const imageHeight = imageWidth / aspectRatio;
            parts.push(`<image x="${imageBounds.left - origin.left + (imageBounds.width - imageWidth) / 2}" y="${imageBounds.top - origin.top + (imageBounds.height - imageHeight) / 2}" width="${imageWidth}" height="${imageHeight}" href="${logoDataUrl}" preserveAspectRatio="xMidYMid meet"/>`);
            return;
        }
        Array.from(element.childNodes).forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                if (node.textContent.trim()) parts.push(...getReceiptTextLines(node, origin));
            } else if (node instanceof Element) {
                drawElement(node);
            }
        });
    };
    drawElement(receiptCard);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join('')}</svg>`;
    const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    try {
        const image = new Image();
        image.src = svgUrl;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = width * 2;
        canvas.height = height * 2;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas is unavailable.');
        context.scale(2, 2);
        context.drawImage(image, 0, 0);
        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob((result) => {
                if (result) resolve(result);
                else reject(new Error('Unable to encode the receipt image.'));
            }, 'image/png');
        });
        const voucherName = String(lastReceipt.voucherNo).replace(/[^a-zA-Z0-9._-]/g, '-');
        return new File([blob], `receipt-${voucherName}.png`, { type: 'image/png' });
    } finally {
        URL.revokeObjectURL(svgUrl);
    }
}

function downloadReceiptImage(file) {
    const imageUrl = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
}

async function shareReceipt() {
    if (!lastReceipt) return;
    receiptShareStatus.textContent = '';
    try {
        const image = await createReceiptImage();
        const shareData = {
            title: `Physics Learning Hub - ${lastReceipt.voucherNo}`,
            files: [image]
        };
        if (typeof navigator.share === 'function' &&
            typeof navigator.canShare === 'function' &&
            navigator.canShare({ files: shareData.files })) {
            try {
                await navigator.share(shareData);
                receiptShareStatus.textContent = 'Share menu မှ Messenger, Viber သို့မဟုတ် Telegram ကို ရွေးချယ်ပါ။';
                return;
            } catch (error) {
                if (error && error.name === 'AbortError') {
                    receiptShareStatus.textContent = 'မျှဝေမှုကို ပယ်ဖျက်လိုက်ပါသည်။';
                    return;
                }
                console.error('Unable to share the order receipt image.', error);
            }
        }
        downloadReceiptImage(image);
        receiptShareStatus.textContent = 'ဘောက်ချာပုံကို PNG အဖြစ်သိမ်းပြီးပါပြီ။ Messenger, Viber သို့မဟုတ် Telegram မှ ထိုပုံကို ပူးတွဲပို့နိုင်ပါသည်။';
    } catch (error) {
        console.error('Unable to share the order receipt.', error);
        receiptShareStatus.textContent = 'ဘောက်ချာပုံကို မဖန်တီးနိုင်ပါ။ Browser ကို ပြန်ဖွင့်ပြီး ထပ်ကြိုးစားပါ။';
    }
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
        ? getFinalRoyalDeliveryFee(pricing.weight, city)
        : 0;
    const totalWithDelivery = pricing.total + deliveryFees;
    const codMaxTotal = Number(window.PHYSICS_ORDER_MASTER_DATA?.settings?.codMaxTotal || 0);
    const paymentMethod = String(formData.get('paymentMethod') || '');
    if (deliveryService === 'Car' && paymentMethod !== 'KBZ Pay') {
        orderStatus.textContent = 'ကားတင်ရန်အတွက် KBZ Pay တစ်မျိုးတည်းသာ ရွေးချယ်နိုင်ပါသည်။';
        return;
    }
    if (paymentMethod === 'COD' && totalWithDelivery >= codMaxTotal) {
        orderStatus.textContent = `စာအုပ်ဖိုးနှင့် ပို့ခပေါင်း ${formatKyats(codMaxTotal)} နှင့်အထက်ဖြစ်သဖြင့် COD ရွေး၍မရပါ။ KBZ Pay ကို ရွေးပါ။`;
        return;
    }

    const items = orderBooks.map((book, index) => ({
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
        const unitPrices = pricing.unitPrices;
        lastReceipt = result.order || {
            voucherNo: result.orderId,
            name: order.name,
            address: `${city.label}, ${order.address}`,
            phone: order.phone,
            phone2: order.phone2,
            orderDate: new Date().toLocaleString(),
            paymentMethod,
            total: pricing.total,
            deliveryService,
            deliveryFees,
            payableTotal: totalWithDelivery,
            totalKg: pricing.weight,
            cashCollection: paymentMethod === 'COD' ? totalWithDelivery : 0,
            carInfo: order.carDetails,
            items: orderBooks.map((book, index) => ({
                id: book.id,
                name: book.name,
                quantity: pricing.quantities[index],
                unitPrice: unitPrices[index],
                amount: pricing.quantities[index] * unitPrices[index]
            }))
        };
        orderSubmitted = true;
        displayReceipt(lastReceipt);
        orderSuccessDialog.showModal();
        orderStatus.textContent = 'မှာယူမှုကို လက်ခံရရှိပါပြီ။ ဘောက်ချာကို Print / Save PDF သို့မဟုတ် ဘောက်ချာပုံ Share ကို အသုံးပြုပါ။';
    } catch (error) {
        console.error('Unable to submit the book order.', error);
        orderStatus.textContent = `မှာယူမှု မအောင်မြင်ပါ။ ${error.message}`;
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

document.getElementById('share-receipt').addEventListener('click', shareReceipt);

updateOrderTotal();
