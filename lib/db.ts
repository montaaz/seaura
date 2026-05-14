import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Ensure isInitialized persists in development mode across hot reloads
const globalWithDb = globalThis as typeof globalThis & {
  dbInitialized?: boolean;
};

const cache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 300000; // 5 minutes

export const query = async (text: string, params?: any[]) => {
  const cacheKey = `${text}_${JSON.stringify(params || [])}`;
  const now = Date.now();
  
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey)!;
    if (now - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }

  const result = await pool.query(text, params);
  
  // Only cache SELECT queries
  if (text.trim().toUpperCase().startsWith('SELECT')) {
    cache.set(cacheKey, { data: result, timestamp: now });
  } else {
    // Clear cache on mutations (INSERT/UPDATE/DELETE)
    cache.clear();
  }
  
  return result;
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
      ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS sizes JSONB DEFAULT '[]';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS colors JSONB DEFAULT '[]';
      ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 10;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS sub_category_id INTEGER REFERENCES sub_categories(id) ON DELETE SET NULL;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS has_sizes BOOLEAN DEFAULT TRUE;

      -- Order columns
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

    // Performance Optimizations (Handled separately to prevent failure on permission issues)
    try {
      await client.query(`
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
