async function callOrderApi(action, payload = {}) {
    if (action === 'createOrder') return physicsApiFetch('orders', { method: 'POST', body: JSON.stringify(payload) });
    throw new Error('This order action has not been migrated yet.');
}

async function loadOrderMasterData() {
    const response = await physicsApiFetch('public/master-data', { method: 'GET' });
    const masterData = response.masterData;
    if (!masterData || !masterData.books || !masterData.deliveryCities || !masterData.settings) {
        throw new Error('Order master data is missing or incomplete.');
    }
    if (masterData.schemaVersion !== 1) {
        throw new Error('This app version does not support the master data format.');
    }
    const thresholds = masterData.settings.priceThresholds;
    if (!Array.isArray(thresholds) || thresholds.length === 0 ||
        thresholds.some((value) => !Number.isSafeInteger(Number(value)) || Number(value) < 0) ||
        !Number.isFinite(Number(masterData.settings.royalServiceFee)) ||
        !Number.isFinite(Number(masterData.settings.codMaxTotal))) {
        throw new Error('Order master data settings are invalid.');
    }
    const books = getOrderBooks(masterData);
    if (books.length === 0 || books.some((book) =>
        !book || !Array.isArray(book.prices) || book.prices.length !== thresholds.length ||
        book.prices.some((price) => !Number.isSafeInteger(Number(price)) || Number(price) < 0) ||
        !book.name || !Number.isFinite(Number(book.weight)) || Number(book.weight) <= 0
    )) {
        throw new Error('Order book master data is invalid.');
    }
    return { masterData };
}

function getOrderBooks(masterData) {
    const books = masterData && masterData.books ? masterData.books : {};
    return (Array.isArray(books) ? books : Object.entries(books).map(([id, book]) => ({ ...book, id: book.id || id })))
        .filter((book) => book && book.active !== false);
}
