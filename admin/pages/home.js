function orderDateIso(value) {
    const text = String(value || '').trim();
    const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
    if (isoDate) return `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;

    const dayFirstDate = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:\s|$)/.exec(text);
    if (dayFirstDate) {
        return `${dayFirstDate[3]}-${dayFirstDate[2].padStart(2, '0')}-${dayFirstDate[1].padStart(2, '0')}`;
    }
    return '';
}

function renderOrdersChart(orders) {
    const chart = document.getElementById('orders-chart');
    const days = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
        const date = new Date();
        date.setDate(date.getDate() - offset);
        const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        days.push({ iso, label: date.toLocaleDateString('en-GB', { day: 'numeric' }), count: 0 });
    }
    const countsByDate = new Map(days.map((day) => [day.iso, day]));
    orders.forEach((order) => {
        const day = countsByDate.get(orderDateIso(order['Order Date']));
        if (day) day.count += 1;
    });
    const max = Math.max(1, ...days.map((day) => day.count));
    chart.replaceChildren();
    days.forEach((day) => {
        const column = document.createElement('div');
        column.className = 'chart-day';
        const count = document.createElement('span');
        count.className = 'chart-value';
        count.textContent = String(day.count);
        const barWrap = document.createElement('span');
        barWrap.className = 'chart-bar-wrap';
        const bar = document.createElement('span');
        bar.className = 'chart-bar';
        bar.style.height = `${Math.max(5, day.count / max * 75)}px`;
        barWrap.append(bar);
        const label = document.createElement('span');
        label.textContent = day.label;
        column.append(count, barWrap, label);
        chart.append(column);
    });
}

function orderAmount(value) {
    const normalized = String(value ?? '').trim()
        .replace(/[၀-၉]/g, (digit) => String(digit.charCodeAt(0) - '၀'.charCodeAt(0)))
        .replace(/[ ,٬]/g, '');
    const amount = Number(normalized);
    return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function formatOverviewAmount(value) {
    return orderAmount(value).toLocaleString('en-US');
}

function renderDashboard(orders) {
    const paymentTotals = orders.reduce((totals, order) => {
        const deliveryFee = orderAmount(order['Delivery Fees']);
        const total = orderAmount(order.Total) + deliveryFee;
        const received = orderAmount(order['Received'] || order['Amount Received']) + deliveryFee;
        totals.received += received;
        totals.outstanding += Math.max(0, total - received);
        return totals;
    }, { received: 0, outstanding: 0 });
    document.getElementById('stat-orders').textContent = Number(orders.length).toLocaleString('en-US');
    document.getElementById('stat-received').textContent = formatOverviewAmount(paymentTotals.received);
    document.getElementById('stat-outstanding').textContent = formatOverviewAmount(paymentTotals.outstanding);
    document.getElementById('stat-undelivered').textContent =
        Number(orders.filter((order) => order.status === 'pending').length).toLocaleString('en-US');
    renderOrdersChart(orders);
}

function formatCacheTime(updatedAt) {
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
    return `Updated · ${parts.day} ${parts.month} ${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}

async function loadDashboard() {
    const update = document.getElementById('dashboard-updated');
    try {
        const cached = await AdminApi.refreshOrders();
        renderDashboard(cached.data);
        update.textContent = formatCacheTime(cached.updatedAt);
    } catch (error) {
        console.error('Unable to read cached dashboard data.', error);
        update.textContent = 'Unable to load data from the database.';
        update.classList.add('error');
    }
}

async function loadStoreOverview(button) {
    const update = document.getElementById('store-overview-updated');
    if (button) button.disabled = true;
    update.classList.remove('error');
    update.textContent = 'Loading store orders…';
    try {
        const overview = await AdminApi.getShopOverview();
        document.getElementById('store-stat-orders').textContent =
            Number(overview.totalOrders).toLocaleString('en-US');
        document.getElementById('store-stat-received').textContent = formatOverviewAmount(overview.amountReceived);
        document.getElementById('store-stat-outstanding').textContent = formatOverviewAmount(overview.outstanding);
        document.getElementById('store-stat-undelivered').textContent =
            Number(overview.undelivered).toLocaleString('en-US');
        update.textContent = `Updated · ${new Intl.DateTimeFormat('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23'
        }).format(new Date())}`;
    } catch (error) {
        console.error('Unable to load the store overview.', error);
        update.textContent = error.message || 'Unable to load store orders.';
        update.classList.add('error');
    } finally {
        if (button) button.disabled = false;
    }
}

loadDashboard();
loadStoreOverview();
