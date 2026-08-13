import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  // Fail fast instead of holding a pooled connection for minutes.
  // A single image query should never take more than a few seconds.
  statement_timeout: 15000,
});

// Ensure isInitialized persists in development mode across hot reloads
const globalWithDb = globalThis as typeof globalThis & {
  dbInitialized?: boolean;
};

export const query = async (text: string, params?: any[]) => {
  // No application-level query cache. It was a per-process in-memory Map, so
  // each running instance (localhost vs. server) held its own stale copy and
  // served different images for the same database after an edit. Now that
  // images are tiny file-path lookups, reads are fast enough that always
  // hitting the DB is the right trade-off and guarantees consistency.
  return pool.query(text, params);
};

export const initDb = async () => {
  if (globalWithDb.dbInitialized) return;
  try {
    const client = await pool.connect();
    
    console.log('Checking database schema and performance indexes...');

    // Create All Tables in one batch to minimize round-trips
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'CLIENT',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sub_categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        image_url TEXT,
        colors JSONB DEFAULT '[]',
        images JSONB DEFAULT '[]',
        sizes JSONB DEFAULT '[]',
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url TEXT;
      -- Admin-controlled display order for the storefront menu.
      ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER;
      ALTER TABLE sub_categories ADD COLUMN IF NOT EXISTS sort_order INTEGER;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS sizes JSONB DEFAULT '[]';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS colors JSONB DEFAULT '[]';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 10;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS sub_category_id INTEGER REFERENCES sub_categories(id) ON DELETE SET NULL;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS has_sizes BOOLEAN DEFAULT TRUE;

      -- Order columns
      -- First-order discount: recorded per order so the amount granted is
      -- auditable and the total can be reconstructed from the stored parts.
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_percent INTEGER DEFAULT 0;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS city VARCHAR(255);

      CREATE TABLE IF NOT EXISTS home_content (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'TEXT',
        section VARCHAR(100),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        total DECIMAL(10, 2) NOT NULL,
        items JSONB NOT NULL,
        status VARCHAR(50) DEFAULT 'PENDING',
        payment_status VARCHAR(50) DEFAULT 'UNPAID',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Percentage discounts scoped to a category, a sub-category or a single
      -- product. Active only between starts_at and ends_at; the window is
      -- internal and never exposed to shoppers.
      CREATE TABLE IF NOT EXISTS discounts (
        id SERIAL PRIMARY KEY,
        scope VARCHAR(20) NOT NULL,           -- 'category' | 'subcategory' | 'product'
        target_id INTEGER NOT NULL,
        percent NUMERIC(5,2) NOT NULL CHECK (percent > 0 AND percent <= 100),
        starts_at DATE NOT NULL,
        ends_at DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CHECK (ends_at >= starts_at)
      );

      -- "Notify me when available" requests. One pending row per
      -- (product, email); notified_at is stamped when the mail goes out so the
      -- same request is never sent twice.
      CREATE TABLE IF NOT EXISTS stock_notifications (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notified_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chat_sessions (
        id SERIAL PRIMARY KEY,
        user_email VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_email)
      );
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
        sender_role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

    `);

    // Backfill sort_order for rows created before the column existed, keeping
    // the alphabetical order they were displayed in until an admin reorders.
    await client.query(`
      UPDATE categories c SET sort_order = o.rn
      FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY name ASC) AS rn FROM categories WHERE sort_order IS NULL) o
      WHERE c.id = o.id AND c.sort_order IS NULL;

      UPDATE sub_categories s SET sort_order = o.rn
      FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY name ASC) AS rn FROM sub_categories WHERE sort_order IS NULL) o
      WHERE s.id = o.id AND s.sort_order IS NULL;
    `);

    // Performance Optimizations (Handled separately to prevent failure on permission issues)
    try {
      await client.query(`
        -- Backs the first-order eligibility lookup, which matches on lowercased email.
        CREATE INDEX IF NOT EXISTS idx_orders_customer_email_lower ON orders (lower(customer_email));
        -- Backs the per-product discount lookup, which filters by scope + target.
        CREATE INDEX IF NOT EXISTS idx_discounts_scope_target ON discounts (scope, target_id);
        -- One outstanding stock alert per product/email. Partial, so a shopper can
        -- subscribe again after being notified for an earlier restock.
        CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_notif_pending
          ON stock_notifications (product_id, lower(email))
          WHERE notified_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_stock_notif_product_pending
          ON stock_notifications (product_id) WHERE notified_at IS NULL;
        -- Hard guarantee that the first-order discount is granted at most once per
        -- email, even if two checkouts race past the application-level check.
        CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_one_discount_per_email
          ON orders (lower(customer_email))
          WHERE discount_amount > 0;
        CREATE EXTENSION IF NOT EXISTS pg_trgm;
        CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING GIN (name gin_trgm_ops);
        CREATE INDEX IF NOT EXISTS idx_products_description_trgm ON products USING GIN (description gin_trgm_ops);
      `);
    } catch (e) {
      console.warn('Could not create search indexes (likely permission issues):', e);
    }

    client.release();
    globalWithDb.dbInitialized = true;
    console.log('Database optimizations applied successfully.');
  } catch (err) {
    console.error('Error during database optimization:', err);
  }
};
