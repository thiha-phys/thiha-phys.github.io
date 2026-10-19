# Combined App Integration

Customer and Admin apps live in this repository under `customer/` and `admin/`. The Admin app's shared API client and Master Data editor use the contract below.

## Shared Master Data

The order Apps Script deployment is the single source of truth for customer-facing catalog, pricing, weights, delivery fees, and order calculations.

- API: `https://script.google.com/macros/s/AKfycbyK1T-_1zj9vgLpLu7HCumy-D-aB8rkSPGkNs-aXTVZqlrhP_qkncYwgmPc_0xU8SmX/exec`
- `getMasterData`: returns `{ ok: true, masterData }`.
- `saveMasterData`: accepts `{ action: "saveMasterData", masterData }` and returns the saved data.
- `createOrder`: accepts `{ action: "createOrder", order }`; the server recalculates prices, weight, delivery fees, total, COD eligibility, and voucher values from the current master data before writing the order.

`masterData` has this shape:

- `settings`: `priceThresholds`, `royalServiceFee`, `codMaxTotal`
- `books`: object keyed by book ID; each book has `id`, `name`, `image`, `weight`, `prices`, `quantityHeader`, `amountHeader`, and optional `active`
- `deliveryCities`: object keyed by city ID; each city has `english`, `myanmar`, `label`, `upTo2Kg`, and `nextKg`
- `updatedAt`

The first `getMasterData` call seeds a `Master Data` tab in the bound order spreadsheet from the repository's current defaults. Previous database contents are not imported. Admin edits are stored in that same tab and are immediately used by customer catalog, order, and voucher flows.

## Account And Recommendation API

The separate account/recommendation Apps Script deployment remains the backing store for profiles and feedback:

- API: `https://script.google.com/macros/s/AKfycbzIdbnosK3NE_RItCHF-JFD-Olz4CJ0tBqrANyU4ORfHRZYxVgvAkQhMTNeAH3ZQRvz7A/exec`
- Actions: `create`, `update`, `lookup`, and `submitFeedback`, each with a `profile` payload.

## Access Model

The master-data API intentionally has no admin authentication or permission check. Anyone who can reach the public Apps Script deployment can call `saveMasterData` and overwrite the shared catalog/settings. The endpoint still validates data shape and numeric values to avoid breaking customer calculations.

## Deployment

After updating the Apps Script project bound to the order spreadsheet with `Code.gs`, deploy a new Web App version at the order API URL above. Keep it executing as the spreadsheet owner and accessible to website visitors. Update the separate account/recommendation deployment with `sms.gs` as needed, keeping its URL unchanged. Keep both apps connected only to these Sheet APIs.
