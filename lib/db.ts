import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

// Minimal Cache for CMS Content (HomeContent) to speed up everything
let cmsCache: any[] | null = null;
let lastCacheUpdate: number = 0;
const CACHE_TTL = 60 * 1000; // 60 seconds

export const getCachedHomeContent = async () => {
  const now = Date.now();
  if (cmsCache && (now - lastCacheUpdate < CACHE_TTL)) {
    return cmsCache;
  }
  
  const res = await pool.query("SELECT * FROM home_content");
  cmsCache = res.rows;
  lastCacheUpdate = now;
  return cmsCache;
};

export const clearCmsCache = () => { cmsCache = null; };

// Use global to resist HMR reloads in Next.js development
const globalAny: any = global;
if (typeof globalAny.dbInitialized === 'undefined') {
  globalAny.dbInitialized = false;
}

export const initDb = async () => {
  if (globalAny.dbInitialized) return;
  try {
    const client = await pool.connect();

    // Create User Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'CLIENT',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Category Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL
      );
    `);

    // Create Product Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        image_url VARCHAR(500),
        colors JSONB DEFAULT '[]',
        images JSONB DEFAULT '[]',
        sizes JSONB DEFAULT '[]',
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migration: Add sizes column if it doesn't exist
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='sizes') THEN
          ALTER TABLE products ADD COLUMN sizes JSONB DEFAULT '[]';
        END IF;

        -- Repair: Set sizes to [] for rows where it is NULL
        UPDATE products SET sizes = '[]' WHERE sizes IS NULL;
      END $$;
    `);

    // Migration: Add images column if it doesn't exist
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='images') THEN
          ALTER TABLE products ADD COLUMN images JSONB DEFAULT '[]';
        END IF;

        -- Repair: Set images to [] for rows where it is NULL
        UPDATE products SET images = '[]' WHERE images IS NULL;
      END $$;
    `);

    // Migration: Change colors column to JSONB if it's text[] or add it
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='colors') THEN
          ALTER TABLE products ADD COLUMN colors JSONB DEFAULT '[]';
        ELSIF (SELECT data_type FROM information_schema.columns WHERE table_name='products' AND column_name='colors') = 'ARRAY' THEN
          ALTER TABLE products ALTER COLUMN colors TYPE JSONB USING to_jsonb(colors);
          ALTER TABLE products ALTER COLUMN colors SET DEFAULT '[]';
        END IF;
      END $$;
    `);

    // Create Home Content Table (CMS functionality)
    await client.query(`
      CREATE TABLE IF NOT EXISTS home_content (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'TEXT', -- TEXT, IMAGE, JSON
        section VARCHAR(100), -- hero, newsletter, categories, branding, instagram, etc.
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Default Instagram Content
    for (let i = 1; i <= 4; i++) {
      await client.query(`
          INSERT INTO home_content (key, value, type, section) 
          VALUES ($1, $2, 'JSON', 'instagram')
          ON CONFLICT (key) DO NOTHING`,
        [`instagram_post_${i}`, JSON.stringify({ image_url: `/images/hero.png`, instagram_url: 'https://instagram.com' })]
      );
    }

    // Create Orders Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        total DECIMAL(10, 2) NOT NULL,
        items JSONB NOT NULL,
        status VARCHAR(50) DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Chat Tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id SERIAL PRIMARY KEY,
        user_email VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_email)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
        sender_role VARCHAR(20) NOT NULL, -- 'CLIENT' or 'ADMIN'
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create Settings Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Default SMTP settings from ENV or defaults
    const defaultSettings = [
      { key: 'SMTP_HOST', value: process.env.SMTP_HOST || 'smtp.gmail.com' },
      { key: 'SMTP_PORT', value: process.env.SMTP_PORT || '587' },
      { key: 'SMTP_SECURE', value: process.env.SMTP_SECURE || 'false' },
      { key: 'SMTP_USER', value: process.env.SMTP_USER || '' },
      { key: 'SMTP_PASS', value: process.env.SMTP_PASS || '' },
      { key: 'SMTP_FROM_NAME', value: 'Boutique Seaura' },
    ];

    for (const s of defaultSettings) {
      await client.query(
        "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING",
        [s.key, s.value]
      );
    }

    // Create Carts Table (Live shopping tracking)
    await client.query(`
      CREATE TABLE IF NOT EXISTS carts (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(255) UNIQUE NOT NULL,
        items JSONB DEFAULT '[]',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_carts_session ON carts(session_id);
    `);

    // Create Wishlists Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS wishlists (
        id SERIAL PRIMARY KEY,
        user_email VARCHAR(255) UNIQUE NOT NULL,
        items JSONB DEFAULT '[]',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_wishlists_user ON wishlists(user_email);
    `);

    // Create Charges Table (Accounting/Expenses)
    await client.query(`
      CREATE TABLE IF NOT EXISTS charges (
        id SERIAL PRIMARY KEY,
        description VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        category VARCHAR(100),
        date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migration: Add payment_status to orders if it doesn't exist
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_status') THEN
          ALTER TABLE orders ADD COLUMN payment_status VARCHAR(50) DEFAULT 'UNPAID';
        END IF;
      END $$;
    `);

    client.release();
    globalAny.dbInitialized = true;
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};
