import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCarInfo, royalShipmentCharges } from '../lib/order-delivery.js';

test('car information accepts current and legacy field names', () => {
  assert.equal(normalizeCarInfo({ carDetails: 'Station / Bus' }), 'Station / Bus');
  assert.equal(normalizeCarInfo({ 'car inform': 'Saved value' }), 'Saved value');
  assert.equal(normalizeCarInfo({ car_details: 'Database value' }), 'Database value');
  assert.equal(normalizeCarInfo({ carStation: 'Station', carName: 'Bus' }), 'Station / Bus');
});

test('Royal service charge increases by 300 for each 5 kg package', () => {
  assert.deepEqual(royalShipmentCharges('Royal', 5, 6000, 300), {
    serviceCharge: 300,
    codCharge: 5700
  });
  assert.deepEqual(royalShipmentCharges('Royal', 5.01, 6000, 300), {
    serviceCharge: 600,
    codCharge: 5400
  });
  assert.deepEqual(royalShipmentCharges('Royal', 10, 6000, 300), {
    serviceCharge: 600,
    codCharge: 5400
  });
  assert.deepEqual(royalShipmentCharges('Royal', 10.01, 6000, 300), {
    serviceCharge: 900,
    codCharge: 5100
  });
});

test('Royal COD charge never goes below zero and Car delivery has no Royal charges', () => {
  assert.deepEqual(royalShipmentCharges('Royal', 5, 200, 300), {
    serviceCharge: 300,
    codCharge: 0
  });
  assert.deepEqual(royalShipmentCharges('Car', 15, 1000, 300), {
    serviceCharge: 0,
    codCharge: 0
  });
});
