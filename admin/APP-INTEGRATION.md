# App Integration

Cloudflare Pages projects use separate output directories:

- Customer: `customer/`
- Admin: `admin/`

## Order API

`Code.gs` is deployed at:

`https://script.google.com/macros/s/AKfycbyK1T-_1zj9vgLpLu7HCumy-D-aB8rkSPGkNs-aXTVZqlrhP_qkncYwgmPc_0xU8SmX/exec`

The app uses `getMasterData`, `saveMasterData`, `createOrder`, order list/update actions, and Royal shipment/statement imports. At present `getMasterData` reads the `Master Data` tab in the order spreadsheet and initializes it from `Code.gs` defaults if empty.

## Account API

`sms.gs` is deployed at:

`https://script.google.com/macros/s/AKfycbzIdbnosK3NE_RItCHF-JFD-Olz4CJ0tBqrANyU4ORfHRZYxVgvAkQhMTNeAH3ZQRvz7A/exec`

The app uses `create`, `update`, `lookup`, and `submitFeedback` actions.

Both Apps Script Web Apps must be deployed for public website access. The order API currently allows anyone to overwrite master data, as requested.
