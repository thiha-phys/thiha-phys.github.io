# App Integration

Cloudflare Pages projects use separate output directories:

- Customer: `customer/`
- Admin: `admin/`

## Order API

`Code.gs` is deployed at:

`https://script.google.com/macros/s/AKfycbyK1T-_1zj9vgLpLu7HCumy-D-aB8rkSPGkNs-aXTVZqlrhP_qkncYwgmPc_0xU8SmX/exec`

The customer order flow and the Admin order tools use this API for order creation, order list/update actions, and Royal shipment/statement imports. Order price and delivery fees are validated server-side against the published master data. The legacy `getMasterData` action remains read-only for older clients; it fetches the static JSON and caches it briefly. `saveMasterData` is disabled.

## Static Master Data

`customer/data/master-data.json` is the single source of truth for book prices, delivery cities, and order settings. The customer app loads it as a static asset and includes it in its offline cache. The Admin reads the public file, validates edits, and downloads a replacement `master-data.json`; no Cloudflare Access, payment card, backend function, or browser-side GitHub credential is required.

To publish an edit, replace `customer/data/master-data.json` in the repository with the downloaded file and push/commit the change (or upload it through the repository website). The static hosting deployment then serves the updated public data. The customer app may need to refresh its page or service-worker cache before it sees the new snapshot.

The customer JSON is public by design and is not a place for secrets. Its cache headers permit short-lived CDN/browser caching; the Service Worker retains a usable copy for offline use. A future Android/iOS app can bundle this same schema as its offline snapshot and refresh it from the public JSON URL when the version/ETag changes. Order/account transactions remain on their existing APIs in this phase; only repeated master-data reads/writes are moved off the Google Sheet API.

## Account API

`sms.gs` is deployed at:

`https://script.google.com/macros/s/AKfycbzIdbnosK3NE_RItCHF-JFD-Olz4CJ0tBqrANyU4ORfHRZYxVgvAkQhMTNeAH3ZQRvz7A/exec`

The app uses `create`, `update`, `lookup`, and `submitFeedback` actions.

Both Apps Script Web Apps must be deployed for their transaction features. Master data is no longer edited through Apps Script or Google Sheets.
