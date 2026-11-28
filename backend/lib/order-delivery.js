export function normalizeCarInfo(order) {
  const directValues = [
    order?.carDetails,
    order?.carInfo,
    order?.['car inform'],
    order?.car_details,
    order?.car_info,
    order?.deliveryNotes
  ];
  const directValue = directValues
    .map((value) => String(value ?? '').trim())
    .find(Boolean);
  if (directValue) return directValue;

  return [order?.carStation, order?.carName]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' / ');
}

export function royalShipmentCharges(deliveryService, weightKg, deliveryFee, serviceFee) {
  if (deliveryService !== 'Royal') {
    return { serviceCharge: 0, codCharge: 0 };
  }

  const packageCount = Math.max(1, Math.ceil(Number(weightKg) / 5 - 0.000000001));
  const serviceCharge = packageCount * Number(serviceFee);
  return {
    serviceCharge,
    codCharge: Math.max(0, Number(deliveryFee) - serviceCharge)
  };
}
