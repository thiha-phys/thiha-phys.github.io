# Physics Learning Hub API setup

Customer and Admin remain separate Vercel projects. Create one additional Vercel project from this same repository for the shared API, with **Root Directory = `backend`**, Framework Preset = **Other**, and no build command or output directory. The function is configured for Vercel's Singapore region (`sin1`) to stay close to a Neon Singapore database.

## Neon database

1. In Neon, create a Free project and choose AWS Singapore (`ap-southeast-1`) if it is available in the region list.
2. Open **SQL Editor** and run `migrations/001_initial_schema.sql` first.
3. Run `seeds/001_initial_data.sql` next. It installs the current 7 books, 223 shipping cities, and 29 customer-facing bookstores.
4. Run `seeds/002_partner_shops.sql` to import the current Admin shop-order partners.
5. Before deploying the phone-login update, run `migrations/002_phone_login_and_password.sql`. It makes email optional and enforces one account per phone number. If duplicate phone numbers are found, Neon stops with an explanatory error so those records can be reviewed first.
6. Before deploying password change and recovery, run `migrations/006_password_reset_requests.sql` in Neon SQL Editor after the existing migrations. It creates the separate password-reset review queue.
7. Before deploying account discussions, run `migrations/007_discussion_messages.sql` in Neon SQL Editor. It creates an indexed, text-only message table; Admin deletion permanently removes selected message rows.
8. Before deploying the three-state delivery flow, run `migrations/008_order_completion.sql` in Neon SQL Editor after the existing migrations. It adds the independent `orders.complete` column and converts legacy delivery states to `pending`, `delivered`, and `complete`. Do not store the customer confirmation flag in the numeric `admin_data.Received` payment amount.
9. Run `migrations/009_received_amount_books_only.sql` in Neon SQL Editor to remove delivery fees from legacy `admin_data.Received` values that stored books plus delivery together.
10. In **Connect**, select the default database and role, turn on the pooled connection option, and copy the connection string. Keep it private.
11. After the migrations succeed, deploy the **API Vercel project** (Root Directory = `backend`) as well as the Customer/Admin projects. Confirm `GET /api/health` reports `discussionMessaging`, `conversationMessageDeletion`, `passwordChange`, and `passwordReset` as enabled before testing those screens.

## Vercel API environment variables

Add these to the API project's **Settings → Environment Variables** for Production and Preview, then redeploy:

- `DATABASE_URL`: the pooled Neon connection string. Never place this in customer/admin browser code or share it in chat.
- `ADMIN_EMAILS`: `thihakyawphys73@gmail.com,thihakyaw1sth66@gmail.com`
- `APP_ORIGINS`: `https://customer-three-kappa.vercel.app,https://admin-zeta-plum-21.vercel.app`

After Vercel gives the API project its domain, replace `https://YOUR-BACKEND.vercel.app` in `customer/page/api-config.js`, `admin/pages/admin-api.js`, and `admin/login.html` with that domain. Customer and Admin then keep their current separate Vercel projects and point to this one API project.

## First admin account

Admin and customer have separate app screens but use the same secure account table. Public signup always creates a customer role. Bootstrap the first admin by creating their account, confirming the account is yours, and running this one-time SQL in Neon:

```sql
UPDATE users SET role='admin' WHERE lower(email)=lower('thihakyawphys73@gmail.com');
```

The API checks both the database role and the allowlist. The two owner-approved emails (`thihakyawphys73@gmail.com` and `thihakyaw1sth66@gmail.com`) are included in the API as a base allowlist; `ADMIN_EMAILS` can add more. After the first admin is active, the Admin app's **Tools → App Users / Admin access** screen can grant or remove admin access for accounts whose email is allowlisted. That person must create an account first. Admin role is never assigned during public signup. Do not add an unverified self-service Admin signup: the current project has no email/SMS verification, so someone could claim an allowlisted address.

Customers can register with a phone number and password; email is optional. They can sign in using either phone or email. Their order history is filtered by the authenticated account ID, so customers cannot look up someone else's orders by supplying an email. Customers can change their password after confirming the current password. For recovery, the customer submits a request using their registered phone number; an Admin separately reviews it, verifies the customer by calling that registered number, and issues a single-use code that expires after 15 minutes. The Admin must deliver the code only through the verified contact. The code is stored as a hash and allows five incorrect entries per issued code. If it expires or five incorrect codes are entered, the customer can submit a new request; this does not limit the number of users and does not require a purchase. Successful recovery invalidates all existing sessions. No automated SMS/email delivery is configured.

Migration `006_password_reset_requests.sql` creates a separate request table and uses `IF NOT EXISTS` for its table and indexes, so rerunning it after a successful run will not create duplicate database objects. It does not duplicate or alter existing user accounts. A partial unique index allows at most one pending/approved reset request per user at a time.

## Current migration scope

The database stores customer accounts/sessions, books, settings, delivery cities, customer bookstore directory, customer orders/order items, Admin shop orders/partners, book stock, feedback, private customer/Admin discussion messages, and announcements. Discussion messages are text-only and capped at 4,000 characters; Admin deletion removes message rows from the table. The Admin UI manages books/prices/weights, delivery cities/fees, the bookstore directory, shop orders, stock, Royal shipment/statement imports, and announcements. Royal Excel parsing has been connected to the database API, but still needs validation against the owner's actual Royal exports before production use. Historical order import and Grade 10–12 content migration remain outstanding. The `Code.gs` file is retained temporarily as a reference for those legacy workflows; it is not called by the new app runtime.
