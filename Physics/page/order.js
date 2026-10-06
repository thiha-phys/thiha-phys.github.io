const orderForm = document.getElementById('order-form');
const orderBookList = document.getElementById('order-book-list');
const orderStatus = document.getElementById('order-status');
const confirmOrderButton = document.getElementById('confirm-order');
const totalElement = document.getElementById('order-total');
const codRadio = orderForm.querySelector('input[value="COD"]');
const receiptCard = document.getElementById('receipt-card');
let lastReceipt = null;
let orderSubmitted = false;

function getCurrentTotal() {
    return PHYSICS_BOOKS.reduce((total, book) => {
        const input = orderBookList.querySelector(`[name="quantity-${book.id}"]`);
        return total + book.price * Number(input.value || 0);
    }, 0);
}

function updateOrderTotal() {
    const total = getCurrentTotal();
    totalElement.textContent = formatKyats(total);
    codRadio.disabled = total >= 150000;
    if (codRadio.disabled && codRadio.checked) {
        codRadio.checked = false;
        orderForm.querySelector('input[value="KBZ Pay"]').checked = true;
    }
}

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
    price.textContent = formatKyats(book.price);
    const quantityLabel = document.createElement('label');
    quantityLabel.className = 'quantity-label';
    quantityLabel.textContent = 'အရေအတွက်';
    const quantity = document.createElement('input');
    quantity.type = 'number';
    quantity.name = `quantity-${book.id}`;
    quantity.min = '0';
    quantity.max = '99';
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

orderForm.querySelectorAll('input[name="paymentMethod"]').forEach((input) => {
    input.addEventListener('change', () => {
        document.getElementById('payment-note').textContent = input.value === 'COD'
            ? 'ပစ္စည်းရောက်ရှိချိန်တွင် ငွေပေးချေနိုင်ပါသည်။'
            : 'KBZ Pay ကိုရွေးပါက မှာယူမှုတင်ပြီးနောက် ငွေလွှဲရန်အချက်အလက်ကို ဆက်သွယ်ပေးပါမည်။';
    });
});

function addReceiptRow(container, label, value) {
    const row = document.createElement('div');
    row.className = 'receipt-row';
    const key = document.createElement('span');
    key.textContent = label;
    const text = document.createElement('strong');
    text.textContent = value;
    row.append(key, text);
    container.append(row);
}

function displayReceipt(order) {
    document.getElementById('receipt-number').textContent = `ဘောက်ချာအမှတ် ${order.voucherNo}`;
    const details = document.getElementById('receipt-details');
    details.replaceChildren();
    addReceiptRow(details, 'အမည်', order.name);
    addReceiptRow(details, 'ဖုန်း', order.phone);
    addReceiptRow(details, 'လိပ်စာ', order.address);
    order.items.forEach((item) => {
        if (item.quantity > 0) {
            addReceiptRow(details, `${item.name} × ${item.quantity}`, formatKyats(item.amount));
        }
    });
    addReceiptRow(details, 'ငွေပေးချေမှု', order.paymentMethod);
    addReceiptRow(details, 'စုစုပေါင်း', formatKyats(order.total));
    receiptCard.hidden = false;
    receiptCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

orderForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    orderStatus.textContent = '';
    const total = getCurrentTotal();
    if (total <= 0) {
        orderStatus.textContent = 'စာအုပ်အရေအတွက် အနည်းဆုံး ၁ အုပ် ရွေးချယ်ပါ။';
        return;
    }
    if (!orderForm.reportValidity()) {
        return;
    }
    const paymentMethod = orderForm.elements.paymentMethod.value;
    if (paymentMethod === 'COD' && total >= 150000) {
        orderStatus.textContent = 'စုစုပေါင်း ၁၅၀,၀၀၀ ကျပ်နှင့်အထက်တွင် COD ကို ရွေး၍မရပါ။ KBZ Pay ကို ရွေးပါ။';
        return;
    }

    const formData = new FormData(orderForm);
    const items = PHYSICS_BOOKS.map((book) => ({
        id: book.id,
        quantity: Number(formData.get(`quantity-${book.id}`) || 0)
    }));
    if (items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 0 || item.quantity > 99)) {
        orderStatus.textContent = 'အုပ်ရေကို ၀ မှ ၉၉ အတွင်း ကိန်းပြည့်ဖြင့် ထည့်ပါ။';
        return;
    }

    const order = {
        name: String(formData.get('name')).trim(),
        address: String(formData.get('address')).trim(),
        phone: String(formData.get('phone')).trim(),
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
        orderStatus.textContent = 'မှာယူမှုကို လက်ခံရရှိပါပြီ။ ဘောက်ချာကို screenshot ရိုက်ထားပါ သို့မဟုတ် Print / Save PDF ကို အသုံးပြုပါ။';
    } catch (error) {
        console.error('Unable to submit the book order.', error);
        orderStatus.textContent = 'မှာယူမှု မအောင်မြင်ပါ။ အင်တာနက်နှင့် Google Sheet API setting ကို စစ်ပြီး ထပ်မံကြိုးစားပါ။';
    } finally {
        confirmOrderButton.disabled = orderSubmitted;
        confirmOrderButton.textContent = orderSubmitted ? 'မှာယူပြီးပါပြီ' : 'မှာယူမှု အတည်ပြုမည်';
    }
});

document.getElementById('print-receipt').addEventListener('click', () => {
    if (lastReceipt) {
        window.print();
    }
});
