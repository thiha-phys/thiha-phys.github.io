async function sendOrderRequest(action, payload) {
    const response = await fetch("https://script.google.com/macros/s/AKfycbxWcDQ_ue9hZPawB-svH9bkusQelPCdXyjXilzLgklfSxXFd74fOi3ydCoCpg0ZuEXg/exec", {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ action, ...payload })
    });
    if (!response.ok) {
        throw new Error(`Firebase order sync request failed (${response.status}).`);
    }
    const result = await response.json();
    if (!result.ok) {
        throw new Error(result.message || result.error || 'The order sync service rejected the Firebase order.');
    }
    return result;
}

async function submitOrder(order) {
    const session = await getFirebaseOrderSession();
    const orderId = await submitOrderToFirebase(order, session);
    try {
        const synced = await sendOrderRequest('syncFirebaseOrder', {
            orderId,
            idToken: session.idToken
        });
        return { ...synced, orderId, syncPending: false };
    } catch (error) {
        console.warn('The Firebase order was saved but Sheet sync is pending.', error);
        return { ok: true, orderId, syncPending: true };
    }
}

async function getDeliveryCities() {
    const { session, masterData } = await loadOrderMasterData();
    window.PHYSICS_ORDER_MASTER_DATA = masterData;
    window.PHYSICS_ORDER_FIREBASE_SESSION = session;
    const cities = Object.values(masterData.deliveryCities);
    if (!Array.isArray(cities) || cities.length === 0 || cities.some((city) =>
            !city || typeof city.english !== 'string' ||
            typeof city.myanmar !== 'string' ||
            typeof city.label !== 'string' ||
            !Number.isFinite(Number(city.upTo2Kg)) ||
            !Number.isFinite(Number(city.nextKg))
    )) {
        throw new Error('Firebase delivery city data is missing or invalid.');
    }
    return cities;
}
