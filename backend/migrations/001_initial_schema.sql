CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  occupation text NOT NULL DEFAULT '',
  email text NOT NULL,
  phone text NOT NULL,
  password_hash text NOT NULL,
  password_salt text NOT NULL,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (lower(email));
CREATE INDEX IF NOT EXISTS users_phone_idx ON users (phone);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS books (
  id text PRIMARY KEY,
  name text NOT NULL,
  weight numeric(10,5) NOT NULL CHECK (weight > 0),
  prices jsonb NOT NULL,
  quantity_header text NOT NULL DEFAULT '',
  amount_header text NOT NULL DEFAULT '',
  image text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS delivery_cities (
  id text PRIMARY KEY,
  english text NOT NULL,
  myanmar text NOT NULL,
  label text NOT NULL,
  up_to_2kg integer NOT NULL CHECK (up_to_2kg >= 0),
  next_kg integer NOT NULL CHECK (next_kg >= 0),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS delivery_cities_english_unique ON delivery_cities (lower(english));
CREATE TABLE IF NOT EXISTS bookstores (
  id text PRIMARY KEY,
  city text NOT NULL DEFAULT '',
  name text NOT NULL,
  address text NOT NULL DEFAULT '',
  phones jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS partner_shops (
  id text PRIMARY KEY,
  name text NOT NULL,
  discount_rate smallint NOT NULL DEFAULT 20 CHECK (discount_rate IN (20,25)),
  address text NOT NULL DEFAULT '',
  phone1 text NOT NULL DEFAULT '',
  phone2 text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_no text NOT NULL UNIQUE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  phone text NOT NULL,
  phone2 text NOT NULL DEFAULT '',
  city_id text NOT NULL REFERENCES delivery_cities(id),
  address text NOT NULL,
  delivery_service text NOT NULL CHECK (delivery_service IN ('Royal','Car')),
  payment_method text NOT NULL CHECK (payment_method IN ('COD','KBZ Pay')),
  car_details text NOT NULL DEFAULT '',
  subtotal integer NOT NULL DEFAULT 0,
  delivery_fee integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  total_weight_kg numeric(10,3) NOT NULL DEFAULT 0,
  cash_collection integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'new',
  admin_note text NOT NULL DEFAULT '',
  admin_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  royal_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_phone_idx ON orders (phone);
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  book_id text NOT NULL,
  book_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price integer NOT NULL,
  amount integer NOT NULL,
  weight_kg numeric(10,5) NOT NULL
);
CREATE TABLE IF NOT EXISTS partner_shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id text NOT NULL REFERENCES partner_shops(id),
  voucher_no text NOT NULL,
  order_data jsonb NOT NULL,
  total integer NOT NULL DEFAULT 0,
  received integer NOT NULL DEFAULT 0,
  order_date date NOT NULL,
  delivered_date date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id,voucher_no)
);
CREATE INDEX IF NOT EXISTS partner_shop_orders_date_idx ON partner_shop_orders (order_date DESC);
CREATE TABLE IF NOT EXISTS book_stock_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id text NOT NULL REFERENCES books(id),
  entry_date date NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS book_stock_entries_date_idx ON book_stock_entries (book_id,entry_date DESC);

CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  publish_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS educational_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade smallint NOT NULL CHECK (grade IN (10,11,12)),
  category text NOT NULL CHECK (category IN ('old_questions','one_mark','objectives','calculations','short_questions','definitions')),
  title text NOT NULL,
  chapter text NOT NULL DEFAULT '',
  content jsonb NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
