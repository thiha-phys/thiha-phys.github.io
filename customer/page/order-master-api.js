const ORDER_API_URL = 'https://script.google.com/macros/s/AKfycbyK1T-_1zj9vgLpLu7HCumy-D-aB8rkSPGkNs-aXTVZqlrhP_qkncYwgmPc_0xU8SmX/exec';
const MASTER_DATA_URL = new URL('../data/master-data.json', document.currentScript.src);

async function callOrderApi(action, payload = {}) {
    const response = await fetch(ORDER_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ action, ...payload })
    });
    if (!response.ok) {
        throw new Error(`Order service request failed (${response.status}).`);
    }
    const result = await response.json();
    if (!result.ok) {
        throw new Error(result.message || result.error || 'The order service rejected the request.');
    }
    return result;
}

async function loadOrderMasterData() {
    const response = await fetch(MASTER_DATA_URL);
    if (!response.ok) {
        throw new Error(`Master data request failed (${response.status}).`);
    }
    const masterData = await response.json();
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
