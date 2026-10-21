const form = document.getElementById('master-data-form');
const booksRows = document.getElementById('books-rows');
const citiesRows = document.getElementById('cities-rows');
const status = document.getElementById('master-data-status');
let originalMasterData = null;

function inputCell(row, field, value, type = 'text') {
    const cell = document.createElement('td');
    const input = document.createElement('input');
    input.type = type;
    input.dataset.field = field;
    input.value = value == null ? '' : String(value);
    if (type === 'number') {
        input.min = '0';
        input.step = 'any';
    }
    cell.append(input);
    row.append(cell);
}

function renderBooks(books) {
    booksRows.replaceChildren();
    Object.entries(books || {}).forEach(([id, book]) => {
        const row = document.createElement('tr');
        row.dataset.id = id;
        const activeCell = document.createElement('td');
        const active = document.createElement('input');
        active.type = 'checkbox';
        active.dataset.field = 'active';
        active.checked = book.active !== false;
        active.setAttribute('aria-label', `${book.name} ကို customer order တွင် ဖော်ပြရန်`);
        activeCell.append(active);
        row.append(activeCell);
        inputCell(row, 'id', book.id || id);
        inputCell(row, 'name', book.name);
        inputCell(row, 'image', book.image);
        inputCell(row, 'weight', book.weight, 'number');
        inputCell(row, 'prices', (book.prices || []).join(', '));
        inputCell(row, 'quantityHeader', book.quantityHeader || `${id} Qty`);
        inputCell(row, 'amountHeader', book.amountHeader || `${id} Amount`);
        booksRows.append(row);
    });
}

function renderCities(cities) {
    citiesRows.replaceChildren();
    Object.entries(cities || {}).forEach(([id, city]) => {
        const row = document.createElement('tr');
        row.dataset.id = id;
        inputCell(row, 'id', city.id || id);
        inputCell(row, 'english', city.english);
        inputCell(row, 'myanmar', city.myanmar);
        inputCell(row, 'upTo2Kg', city.upTo2Kg, 'number');
        inputCell(row, 'nextKg', city.nextKg, 'number');
        citiesRows.append(row);
    });
}

function loadForm(masterData) {
    originalMasterData = structuredClone(masterData);
    document.getElementById('price-thresholds').value = masterData.settings.priceThresholds.join(', ');
    document.getElementById('royal-service-fee').value = masterData.settings.royalServiceFee;
    document.getElementById('cod-max-total').value = masterData.settings.codMaxTotal;
    renderBooks(masterData.books);
    renderCities(masterData.deliveryCities);
    status.textContent = `နောက်ဆုံးပြင်ဆင်ချိန်: ${masterData.updatedAt || 'မသတ်မှတ်ရသေးပါ'}`;
}

function readRow(row) {
    return Object.fromEntries([...row.querySelectorAll('[data-field]')].map((input) => [
        input.dataset.field,
        input.type === 'checkbox' ? input.checked : input.value.trim()
    ]));
}

function collectMasterData() {
    const thresholds = document.getElementById('price-thresholds').value
        .split(',').map((value) => Number(value.trim()));
    const books = {};
    [...booksRows.querySelectorAll('tr')].forEach((row) => {
        const values = readRow(row);
        const id = values.id;
        if (!id || !values.name || !values.image) {
            throw new Error('စာအုပ် ID၊ အမည်နှင့် ပုံဖိုင်အမည် လိုအပ်ပါသည်။');
        }
        if (books[id]) throw new Error(`စာအုပ် ID ထပ်နေသည်: ${id}`);
        books[id] = {
            id,
            name: values.name,
            image: values.image,
            weight: Number(values.weight),
            prices: values.prices.split(',').map((value) => Number(value.trim())),
            quantityHeader: values.quantityHeader,
            amountHeader: values.amountHeader,
            active: values.active
        };
    });
    const deliveryCities = {};
    [...citiesRows.querySelectorAll('tr')].forEach((row) => {
        const values = readRow(row);
        const id = values.id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (!id || !values.english || !values.myanmar) throw new Error('မြို့ ID နှင့် အမည်များ လိုအပ်ပါသည်။');
        if (deliveryCities[id]) throw new Error(`မြို့ ID ထပ်နေသည်: ${id}`);
        deliveryCities[id] = {
            id,
            english: values.english,
            myanmar: values.myanmar,
            label: `${values.english} (${values.myanmar})`,
            upTo2Kg: Number(values.upTo2Kg),
            nextKg: Number(values.nextKg)
        };
    });
    return {
        settings: {
            priceThresholds: thresholds,
            royalServiceFee: Number(document.getElementById('royal-service-fee').value),
            codMaxTotal: Number(document.getElementById('cod-max-total').value)
        },
        books,
        deliveryCities
    };
}

document.getElementById('add-book').addEventListener('click', () => {
    const id = `new-book-${booksRows.children.length + 1}`;
    const row = document.createElement('tr');
    row.dataset.id = id;
    const activeCell = document.createElement('td');
    const active = document.createElement('input');
    active.type = 'checkbox';
    active.dataset.field = 'active';
    active.checked = true;
    activeCell.append(active);
    row.append(activeCell);
    inputCell(row, 'id', id);
    inputCell(row, 'name', '');
    inputCell(row, 'image', '');
    inputCell(row, 'weight', '', 'number');
    inputCell(row, 'prices', (originalMasterData?.settings.priceThresholds || []).map(() => 0).join(', '));
    inputCell(row, 'quantityHeader', `${id} Qty`);
    inputCell(row, 'amountHeader', `${id} Amount`);
    booksRows.append(row);
    row.querySelector('[data-field="name"]')?.focus();
});

document.getElementById('add-city').addEventListener('click', () => {
    const id = `new-city-${citiesRows.children.length + 1}`;
    const row = document.createElement('tr');
    row.dataset.id = id;
    inputCell(row, 'id', id);
    inputCell(row, 'english', '');
    inputCell(row, 'myanmar', '');
    inputCell(row, 'upTo2Kg', 0, 'number');
    inputCell(row, 'nextKg', 0, 'number');
    citiesRows.append(row);
    row.querySelector('[data-field="english"]')?.focus();
});

document.getElementById('reload-master-data').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    status.className = 'status-message';
    status.textContent = 'Master Data ရယူနေသည်…';
    try {
        loadForm(await AdminApi.getMasterData());
    } catch (error) {
        status.textContent = `Master Data ရယူမရပါ။ ${error.message}`;
        status.classList.add('error');
    } finally {
        button.disabled = false;
    }
});

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = document.getElementById('save-master-data');
    button.disabled = true;
    status.className = 'status-message';
    status.textContent = 'Master Data စစ်ဆေးပြီး JSON ဖိုင်ထုတ်နေသည်…';
    try {
        const saved = await AdminApi.saveMasterData(collectMasterData());
        loadForm(saved);
        status.textContent = 'JSON ဖိုင်ကို download လုပ်ပြီးပါပြီ။ Customer app တွင် ပြောင်းလဲမှုသက်ရောက်ရန် ဖိုင်ကို repository ထဲ အစားထိုးတင်ပြီး hosting သို့ publish လုပ်ပါ။';
        status.classList.add('success');
    } catch (error) {
        status.textContent = `Master Data သိမ်းမရပါ။ ${error.message}`;
        status.classList.add('error');
    } finally {
        button.disabled = false;
    }
});

AdminApi.getMasterData()
    .then(loadForm)
    .catch((error) => {
        console.error('Unable to load shared master data.', error);
        status.textContent = `Master Data ရယူမရပါ။ ${error.message}`;
        status.classList.add('error');
    });
