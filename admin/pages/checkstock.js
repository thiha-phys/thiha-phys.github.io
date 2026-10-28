const stockForm = document.getElementById('stock-form');
const stockStatus = document.getElementById('stock-status');
const stockBookSelect = document.getElementById('stock-book');

AdminBooks.forEach((book) => {
    const option = document.createElement('option');
    option.value = book.id;
    option.textContent = book.name;
    stockBookSelect.append(option);
});
const today = new Date();
stockForm.elements.date.value = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')
].join('-');

function formatStockCacheTime(updatedAt) {
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
    return `Refresh · ${parts.day} ${parts.month} ${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function formatStockDate(value) {
    const text = String(value || '').trim();
    const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (isoDate) {
        return new Intl.DateTimeFormat('en-GB', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric',
            timeZone: 'UTC'
        }).format(new Date(`${text}T00:00:00Z`));
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime())
        ? text
        : new Intl.DateTimeFormat('en-GB', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric'
        }).format(parsed);
}

function renderStock(stock) {
    const grid = document.getElementById('stock-grid');
    grid.replaceChildren();
    stock.forEach((book) => {
        const card = document.createElement('article');
        card.className = 'stock-card';
        const title = document.createElement('h3');
        title.textContent = book.name;
        const numbers = document.createElement('div');
        numbers.className = 'stock-numbers';
        [
            ['Received', book.received],
            ['Delivered', book.delivered],
            ['Remaining', book.remaining]
        ].forEach(([label, value]) => {
            const item = document.createElement('div');
            item.className = 'stock-number';
            const name = document.createElement('span');
            name.textContent = label;
            const count = document.createElement('strong');
            count.textContent = Number(value).toLocaleString('en-US');
            item.append(name, count);
            numbers.append(item);
        });
        const entries = document.createElement('div');
        entries.className = 'stock-entries';
        if (book.entries.length) {
            book.entries.slice().reverse().forEach((entry) => {
                const line = document.createElement('p');
                const date = document.createElement('span');
                date.textContent = formatStockDate(entry.date);
                const quantity = document.createElement('strong');
                quantity.textContent = `${Number(entry.quantity).toLocaleString('en-US')} books`;
                line.append(date, quantity);
                entries.append(line);
            });
        } else {
            entries.textContent = 'No stock entries yet.';
        }
        card.append(title, numbers, entries);
        grid.append(card);
    });
}

async function loadStock() {
    stockStatus.className = 'status-message';
    try {
        const cached = await AdminApi.getCachedStock();
        if (!cached) {
            stockStatus.textContent = 'No saved stock data yet. Select Refresh to load stock.';
            return;
        }
        renderStock(cached.data);
        document.getElementById('stock-cache-status').textContent =
            formatStockCacheTime(cached.updatedAt);
        stockStatus.textContent = '';
    } catch (error) {
        console.error('Unable to read cached book stock.', error);
        stockStatus.textContent = 'Unable to read saved stock data. Select Refresh to try again.';
        stockStatus.classList.add('error');
    }
}

async function refreshStock(button) {
    button.disabled = true;
    stockStatus.className = 'status-message';
    stockStatus.textContent = 'Refreshing stock…';
    try {
        const cached = await AdminApi.refreshStock();
        renderStock(cached.data);
        document.getElementById('stock-cache-status').textContent =
            formatStockCacheTime(cached.updatedAt);
        stockStatus.textContent = 'Stock refreshed from Google Sheets.';
    } catch (error) {
        console.error('Unable to refresh book stock.', error);
        stockStatus.textContent = 'Unable to refresh stock. Check your internet connection and try again.';
        stockStatus.classList.add('error');
    } finally {
        button.disabled = false;
    }
}

stockForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!stockForm.reportValidity()) return;
    const data = new FormData(stockForm);
    const button = document.getElementById('add-stock');
    button.disabled = true;
    stockStatus.className = 'status-message';
    stockStatus.textContent = 'Saving stock entry…';
    try {
        const result = await AdminApi.addStock({
            bookId: data.get('bookId'),
            date: data.get('date'),
            quantity: Number(data.get('quantity'))
        });
        renderStock(result.stock);
        stockForm.elements.quantity.value = '';
        stockStatus.textContent = result.localCacheError
            ? 'Stock was saved to Google Sheets, but the local cache could not be updated. Refresh the stock list.'
            : 'Stock entry saved.';
        if (!result.localCacheError) stockStatus.classList.add('success');
    } catch (error) {
        console.error('Unable to add book stock.', error);
        stockStatus.textContent = 'Unable to save the stock entry. Check the Google Sheets API.';
        stockStatus.classList.add('error');
    } finally {
        button.disabled = false;
    }
});

document.getElementById('refresh-stock').addEventListener('click', (event) => refreshStock(event.currentTarget));
loadStock();
