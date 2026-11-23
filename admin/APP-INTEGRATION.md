# App Integration Status

The deployed Customer and Admin websites are separate Vercel projects rooted at `customer/` and `admin/`. The shared API is a third Vercel project rooted at `backend/`; both browser apps call it using their API URL configuration.

## Moved to the Neon API

- Customer email/password account creation and sign in
- Customer book list, prices, weights, delivery-city fees, and bookstore directory reads
- Customer book-order submission
- Admin book and city management (`Master Data`): create, edit, enable/disable
- Admin customer bookstore directory management: create, edit, enable/disable
- Admin order list/status updates, account/feedback reads, and announcement publishing

## Still being migrated

Royal shipment and statement imports, full order editing, and importing historical order rows use or are being moved to the database API. Validate Royal imports against the actual export files before production use. `Code.gs` is retained as a temporary reference for historical order migration; the app runtime does not call it. The old static `customer/data/master-data.json` has been removed from the Customer runtime; `backend/seeds/001_initial_data.sql` is the one-time starting import.

Database credentials belong only in the API project's Vercel environment variables. Browser projects must contain only the public API domain, never `DATABASE_URL`.
