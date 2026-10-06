async function sendOrderRequest(action, payload) {
    const response = await fetch(PROFILE_API_URL, {
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

function getOrdersForPhone(phone) {
    return sendOrderRequest('listOrders', { phone });
}
