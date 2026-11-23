# Physics Learning Hub API setup

Customer and Admin remain separate Vercel projects. Create one additional Vercel project from this same repository for the shared API, with **Root Directory = `backend`**, Framework Preset = **Other**, and no build command or output directory. The function is configured for Vercel's Singapore region (`sin1`) to stay close to a Neon Singapore database.

## Neon database

1. In Neon, create a Free project and choose AWS Singapore (`ap-southeast-1`) if it is available in the region list.
2. Open **SQL Editor** and run `migrations/001_initial_schema.sql` first.
3. Run `seeds/001_initial_data.sql` next. It installs the current 7 books, 223 shipping cities, and 29 customer-facing bookstores.
4. Run `seeds/002_partner_shops.sql` to import the current Admin shop-order partners.
5. In **Connect**, select the default database and role, turn on the pooled connection option, and copy the connection string. Keep it private.

## Vercel API environment variables

Add these to the API project's **Settings → Environment Variables** for Production and Preview, then redeploy:

- `DATABASE_URL`: the pooled Neon connection string. Never place this in customer/admin browser code or share it in chat.
- `ADMIN_EMAILS`: `thihakyawphys73@gmail.com,thihakyaw1sth66@gmail.com`
- `APP_ORIGINS`: `https://customer-three-kappa.vercel.app,https://admin-zeta-plum-21.vercel.app`

After Vercel gives the API project its domain, replace `https://YOUR-BACKEND.vercel.app` in `customer/page/api-config.js`, `admin/pages/admin-api.js`, and `admin/login.html` with that domain. Customer and Admin then keep their current separate Vercel projects and point to this one API project.

## First admin account

Register the first admin in the customer app with `thihakyawphys73@gmail.com`, confirm that account is yours, then run this one-time SQL in Neon (replace the email if needed):

```sql
UPDATE users SET role='admin' WHERE lower(email)=lower('thihakyawphys73@gmail.com');
```

The API checks both the database role and `ADMIN_EMAILS`. Set the second admin's role the same way only after that person has created their own account. Admin role is never assigned during public signup.

## Current migration scope

The database stores customer accounts/sessions, books, settings, delivery cities, customer bookstore directory, customer orders/order items, Admin shop orders/partners, book stock, feedback, and announcements. The Admin UI manages books/prices/weights, delivery cities/fees, the bookstore directory, shop orders, stock, Royal shipment/statement imports, and announcements. Royal Excel parsing has been connected to the database API, but still needs validation against the owner's actual Royal exports before production use. Historical order import and Grade 10–12 content migration remain outstanding. The `Code.gs` file is retained temporarily as a reference for those legacy workflows; it is not called by the new app runtime.
