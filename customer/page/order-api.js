async function submitOrder(order) {
    return callOrderApi('createOrder', { order });
}

async function getDeliveryCities() {
    const { masterData } = await loadOrderMasterData();
    window.PHYSICS_ORDER_MASTER_DATA = masterData;
    const cities = Object.values(masterData.deliveryCities);
    if (!Array.isArray(cities) || cities.length === 0 || cities.some((city) =>
            !city || typeof city.english !== 'string' ||
            typeof city.myanmar !== 'string' ||
            typeof city.label !== 'string' ||
            !Number.isFinite(Number(city.upTo2Kg)) ||
            !Number.isFinite(Number(city.nextKg))
    )) {
        throw new Error('Delivery city data is missing or invalid.');
    }
    return cities;
}
