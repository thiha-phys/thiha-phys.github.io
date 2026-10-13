async function sendOrderRequest(action, payload) {
    const response = await fetch("https://script.google.com/macros/s/AKfycbxWcDQ_ue9hZPawB-svH9bkusQelPCdXyjXilzLgklfSxXFd74fOi3ydCoCpg0ZuEXg/exec", {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ action, ...payload })
    });
    if (!response.ok) {
        throw new Error(`Google Sheet request failed (${response.status}).`);
    }
    const result = await response.json();
    if (!result.ok) {
        throw new Error(result.message || result.error || 'Google Sheet rejected the order request.');
    }
    return result;
}

function submitOrder(order) {
    return sendOrderRequest('createOrder', { order });
}

function getDeliveryCities() {
    return Promise.resolve(window.PHYSICS_DELIVERY_CITIES).then((cities) => {
        if (!Array.isArray(cities) || cities.length !== 223 || cities.some((city) =>
            !city || typeof city.english !== 'string' ||
            typeof city.myanmar !== 'string' ||
            typeof city.label !== 'string' ||
            !Number.isFinite(Number(city.upTo2Kg)) ||
            !Number.isFinite(Number(city.nextKg))
        )) {
            throw new Error('The local delivery city list is missing or invalid.');
        }
        return cities;
    });
}
