const orderProfilesGrid = document.getElementById('order-profiles-grid');
const orderProfilesStatus = document.getElementById('order-profiles-status');
const orderProfileCount = document.getElementById('order-profile-count');
const orderProfileSearch = document.getElementById('order-profile-search');
let customerProfiles = [];

function phoneDigits(value) {
    return String(value || '')
        .replace(/[၀-၉]/g, (digit) => String(digit.charCodeAt(0) - '၀'.charCodeAt(0)))
        .replace(/\D/g, '');
}

function parseCustomerOrderDate(value) {
    const raw = String(value || '').replace(/[၀-၉]/g, (digit) =>
        String(digit.charCodeAt(0) - '၀'.charCodeAt(0)));
    const dayFirst = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i.exec(raw);
    if (dayFirst) {
        let hour = Number(dayFirst[4] || 0);
        const meridiem = String(dayFirst[7] || '').toUpperCase();
        if (meridiem === 'PM' && hour < 12) hour += 12;
        if (meridiem === 'AM' && hour === 12) hour = 0;
        const date = new Date(
            Number(dayFirst[3]),
            Number(dayFirst[2]) - 1,
            Number(dayFirst[1]),
            hour,
            Number(dayFirst[5] || 0),
            Number(dayFirst[6] || 0)
        );
        if (date.getFullYear() === Number(dayFirst[3]) &&
            date.getMonth() === Number(dayFirst[2]) - 1 &&
            date.getDate() === Number(dayFirst[1]) &&
            hour <= 23 &&
            Number(dayFirst[5] || 0) <= 59 &&
            Number(dayFirst[6] || 0) <= 59) return date;
    }
    const timestamp = Date.parse(raw);
    return Number.isNaN(timestamp) ? null : new Date(timestamp);
}

function orderTimestamp(order) {
    return parseCustomerOrderDate(order['Ordered Date'] || order['Order Date'])?.getTime() || 0;
}

function formatCustomerOrderDate(value) {
    const date = parseCustomerOrderDate(value);
    return date
        ? new Intl.DateTimeFormat('my-MM', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }).format(date)
        : String(value || '—');
}

function groupCustomerOrders(orders) {
    const groups = new Map();
    orders.forEach((order) => {
        const phone = String(order['Phone 1'] || order.Phone || '').trim();
        const key = phoneDigits(phone) || `order:${order['Voucher No'] || groups.size}`;
        const current = groups.get(key) || { orders: [], phone };
        current.orders.push(order);
        if (!current.phone && phone) current.phone = phone;
        groups.set(key, current);
    });

    return [...groups.values()].map(({ orders: customerOrders, phone }) => {
        const sortedOrders = customerOrders.slice().sort((a, b) => orderTimestamp(b) - orderTimestamp(a));
        const latestOrder = sortedOrders[0];
        return {
            name: String(latestOrder.Name || '').trim() || 'အမည်မရှိ',
            address: String(latestOrder.Address || '').trim() || 'လိပ်စာမရှိ',
            phone,
            orderCount: customerOrders.length,
            latestOrderDate: latestOrder['Ordered Date'] || latestOrder['Order Date'] || ''
        };
    }).sort((a, b) => b.orderCount - a.orderCount || a.name.localeCompare(b.name));
}

function renderCustomerCard(customer) {
    const article = document.createElement('article');
    article.className = 'order-profile-card';

    const header = document.createElement('div');
    header.className = 'order-profile-card-header';
    const avatar = document.createElement('span');
    avatar.className = 'order-profile-avatar';
    avatar.textContent = customer.name.trim().charAt(0) || '?';

    const heading = document.createElement('div');
    heading.className = 'order-profile-heading';
    const name = document.createElement('h2');
    name.textContent = customer.name;
    const count = document.createElement('span');
    count.className = 'order-profile-count';
    count.innerHTML = `<i class="fa-solid fa-bag-shopping" aria-hidden="true"></i> ${customer.orderCount.toLocaleString('my-MM')} ကြိမ်မှာယူထားသည်`;
    heading.append(name, count);
    header.append(avatar, heading);

    const details = document.createElement('div');
    details.className = 'order-profile-details';
    const address = document.createElement('p');
    address.innerHTML = '<i class="fa-solid fa-location-dot" aria-hidden="true"></i>';
    address.append(` ${customer.address}`);
    const phone = document.createElement('p');
    phone.innerHTML = '<i class="fa-solid fa-phone" aria-hidden="true"></i>';
    if (customer.phone) {
        const link = document.createElement('a');
        link.href = `tel:${phoneDigits(customer.phone)}`;
        link.textContent = customer.phone;
        phone.append(' ', link);
    } else {
        phone.append(' ဖုန်းနံပါတ်မရှိ');
    }
    const latest = document.createElement('p');
    latest.className = 'order-profile-last-order';
    latest.textContent = `နောက်ဆုံးမှာယူသည့်ရက် · ${formatCustomerOrderDate(customer.latestOrderDate)}`;
    details.append(address, phone, latest);
    article.append(header, details);
    return article;
}

function renderOrderProfiles() {
    const query = orderProfileSearch.value.trim().toLocaleLowerCase();
    const matches = customerProfiles.filter((customer) =>
        [customer.name, customer.address, customer.phone]
            .some((value) => value.toLocaleLowerCase().includes(query))
    );
    orderProfilesGrid.replaceChildren();
    matches.forEach((customer) => orderProfilesGrid.append(renderCustomerCard(customer)));
    if (!matches.length) {
        orderProfilesGrid.innerHTML = '<div class="empty-state">ကိုက်ညီသော အမှာစာ profile မတွေ့ပါ။</div>';
    }
    orderProfilesStatus.textContent = `${matches.length.toLocaleString('en-US')} customers`;
}

async function loadOrderProfiles(button) {
    if (button) button.disabled = true;
    orderProfilesStatus.classList.remove('error');
    orderProfilesStatus.textContent = 'Loading order profiles…';
    orderProfilesGrid.innerHTML = '<div class="empty-state">Loading customer orders…</div>';
    try {
        const snapshot = await AdminApi.refreshOrders();
        customerProfiles = groupCustomerOrders(snapshot.data);
        orderProfileCount.textContent = customerProfiles.length.toLocaleString('my-MM');
        renderOrderProfiles();
    } catch (error) {
        console.error('Unable to load order profiles.', error);
        orderProfileCount.textContent = '—';
        orderProfilesStatus.textContent = 'မှာယူသူစာရင်းကို ရယူမရပါ။ အင်တာနက်ချိတ်ဆက်မှုကို စစ်ပြီး ပြန်ကြိုးစားပါ။';
        orderProfilesStatus.classList.add('error');
        orderProfilesGrid.innerHTML = '<div class="empty-state error">Order profile data could not be loaded.</div>';
    } finally {
        if (button) button.disabled = false;
    }
}

orderProfileSearch.addEventListener('input', renderOrderProfiles);
document.getElementById('refresh-order-profiles').addEventListener('click', (event) =>
    loadOrderProfiles(event.currentTarget)
);
loadOrderProfiles();
