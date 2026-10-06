const historyStatus = document.getElementById('history-status');
const historyList = document.getElementById('order-history');

function historyValue(order, key, emptyText = 'မရှိသေးပါ') {
    const value = order[key];
    return value == null || value === '' ? emptyText : String(value);
}

function addHistoryField(card, label, value) {
    const row = document.createElement('p');
    const title = document.createElement('strong');
    title.textContent = `${label} - `;
    row.append(title, document.createTextNode(value));
    card.append(row);
}

function formatReceivedAmount(value) {
    if (value == null || value === '') {
        return 'မရှိသေးပါ';
    }
    const amount = Number(String(value).replace(/[,\sကျပ်]/g, ''));
    return Number.isFinite(amount) ? formatKyats(amount) : String(value);
}

function renderHistoryOrder(order) {
    const card = document.createElement('article');
    card.className = 'history-card';
    const heading = document.createElement('h2');
    heading.textContent = `ဘောက်ချာအမှတ် ${historyValue(order, 'voucherNo')}`;
    card.append(heading);
    addHistoryField(card, 'မှာယူရက်', historyValue(order, 'orderDate'));
    addHistoryField(card, 'အမည်', historyValue(order, 'name'));
    addHistoryField(card, 'ဖုန်းနံပါတ်', historyValue(order, 'phone'));
    addHistoryField(card, 'လိပ်စာ', historyValue(order, 'address'));
    (order.items || []).forEach((item) => {
        if (Number(item.quantity) > 0) {
            addHistoryField(card, `${item.name} အုပ်ရေ`, String(item.quantity));
            addHistoryField(card, `${item.name} ကျသင့်ငွေ`, formatKyats(item.amount));
        }
    });
    addHistoryField(card, 'စုစုပေါင်း', formatKyats(order.total));
    addHistoryField(card, 'ငွေပေးချေမှု', historyValue(order, 'paymentMethod'));
    addHistoryField(card, 'Order confirm', historyValue(order, 'orderConfirm', 'အတည်ပြုရန် စောင့်ဆိုင်းနေသည်'));
    addHistoryField(card, 'Delivery', historyValue(order, 'delivery', 'ပို့ဆောင်ရန် စောင့်ဆိုင်းနေသည်'));
    addHistoryField(card, 'လက်ခံရရှိပမာဏ', formatReceivedAmount(order.amountReceived));
    addHistoryField(card, 'KBZ Pay လက်ခံအကောင့်', historyValue(order, 'kpayAccount'));
    addHistoryField(card, 'ငွေလက်ခံရက်', historyValue(order, 'payDate'));
    addHistoryField(card, 'Royal VOC No', historyValue(order, 'royalVocNo'));
    historyList.append(card);
}

async function loadOrderHistory() {
    try {
        const savedProfile = localStorage.getItem('physicsLearningHubProfile');
        const profile = savedProfile ? JSON.parse(savedProfile) : null;
        if (!profile || typeof profile.phone !== 'string' || !profile.phone.trim()) {
            window.location.replace('login.html');
            return;
        }
        document.getElementById('history-phone').textContent = profile.phone;
        const result = await getOrdersForPhone(profile.phone);
        if (!Array.isArray(result.orders) || result.orders.length === 0) {
            historyStatus.textContent = 'ဤဖုန်းနံပါတ်ဖြင့် မှာယူထားသောစာရင်း မရှိသေးပါ။';
            return;
        }
        result.orders.forEach(renderHistoryOrder);
        historyStatus.textContent = '';
    } catch (error) {
        console.error('Unable to load order history.', error);
        historyStatus.textContent = 'မှာယူမှုစာရင်းကို မရယူနိုင်ပါ။ အင်တာနက်နှင့် Google Sheet API setting ကို စစ်ဆေးပါ။';
    }
}

loadOrderHistory();
