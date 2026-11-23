const stockForm = document.getElementById('stock-form');
const stockStatus = document.getElementById('stock-status');
const stockBookSelect = document.getElementById('stock-book');

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
    return `Updated · ${parts.day} ${parts.month} ${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
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
        const bookEntries = Array.isArray(book.entries) ? book.entries : [];
        if (bookEntries.length) {
            bookEntries.slice().reverse().forEach((entry) => {
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
    stockStatus.textContent = '';
    document.getElementById('stock-cache-status').textContent = 'Loading stock…';
    stockBookSelect.replaceChildren(new Option('Loading books…', ''));
    stockBookSelect.disabled = true;
    try {
        await AdminApi.getMasterData();
        stockBookSelect.replaceChildren();
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Select a book';
        placeholder.disabled = true;
        placeholder.selected = true;
        stockBookSelect.append(placeholder);
        (window.AdminBooks || []).forEach((book) => {
            const option = document.createElement('option');
            option.value = String(book.id || '');
            option.textContent = book.name;
            stockBookSelect.append(option);
        });
        if (!stockBookSelect.options.length || stockBookSelect.options.length === 1) {
            throw new Error('No active books are available in Master Data.');
        }
        stockBookSelect.disabled = false;
        let cached = null;
        try { cached = await AdminApi.getCachedStock(); } catch (cacheError) { console.warn('Saved stock is unavailable.', cacheError); }
        if (cached && Array.isArray(cached.data)) {
            renderStock(cached.data);
            document.getElementById('stock-cache-status').textContent = 'Refreshing saved stock…';
        }
        const latest = await AdminApi.refreshStock();
        renderStock(latest.data);
        document.getElementById('stock-cache-status').textContent =
            formatStockCacheTime(latest.updatedAt);
    } catch (error) {
        console.error('Unable to read cached book stock.', error);
        const cached = await AdminApi.getCachedStock().catch(() => null);
        if (cached && Array.isArray(cached.data)) {
            renderStock(cached.data);
            document.getElementById('stock-cache-status').textContent = 'Showing saved stock; latest data could not be loaded.';
        } else {
            document.getElementById('stock-cache-status').textContent = 'Could not load stock.';
        }
        if (stockBookSelect.options.length <= 1) {
            stockBookSelect.replaceChildren(new Option('Books could not be loaded', ''));
        }
        stockStatus.textContent = `Unable to load book data or stock. ${error.message}`;
        stockStatus.classList.add('error');
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
        document.getElementById('stock-cache-status').textContent = formatStockCacheTime(new Date());
        stockForm.elements.quantity.value = '';
        stockStatus.textContent = 'Stock entry saved.';
        stockStatus.classList.add('success');
    } catch (error) {
        console.error('Unable to add book stock.', error);
        stockStatus.textContent = 'Unable to save the stock entry. Check the database API.';
        stockStatus.classList.add('error');
    } finally {
        button.disabled = false;
    }
});

loadStock();
