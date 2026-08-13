const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/seaura",
});

async function init() {
  const client = await pool.connect();
  try {
    console.log("Connecting to database...");

    // Create Tables
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

      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        image_url TEXT,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS home_content (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'TEXT',
        section VARCHAR(100),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS newsletter (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        total DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL,
        price DECIMAL(10, 2) NOT NULL
      );
    `);

    // Create Admin User if not exists
    const adminEmail = "admin@seaura.com";
    const checkRes = await client.query("SELECT * FROM users WHERE email = $1", [adminEmail]);
    if (checkRes.rows.length === 0) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await client.query(
        "INSERT INTO users (email, password, role) VALUES ($1, $2, $3)",
        [adminEmail, hashedPassword, "ADMIN"]
      );
      console.log("Admin user created: admin@seaura.com / admin123");
    }

    // Seed Categories
    await client.query("INSERT INTO categories (name) VALUES ('SACS'), ('BIJOUX'), ('VÊTEMENTS'), ('CHAUSSURES') ON CONFLICT DO NOTHING");

    // Seed initial home content for CMS
    const seedContent = [
      ['brand_logo', 'S E A U R A', 'TEXT', 'branding'],
      ['hero_title', 'NEW IN', 'TEXT', 'hero'],
      ['hero_link_text', "Plus d'informations", 'TEXT', 'hero'],
      ['newsletter_title', 'Abonnez-vous à notre newsletter', 'TEXT', 'newsletter'],
      ['newsletter_modal_image', '/images/hero.png', 'IMAGE', 'newsletter'],
      ['welcome_title', 'WELCOME TO SEAURA', 'TEXT', 'welcome'],
      // *asterisks* render as italics on the homepage.
      ['welcome_text', 'Introducing our latest limited edition edit. Handcrafted in our studio and designed to make you feel confident, effortlessly refined and *entirely yourself.*', 'TEXT', 'welcome'],
      ['hero_image_1', '/images/hero.png', 'IMAGE', 'hero'],
      ['hero_image_2', '/images/clothing.png', 'IMAGE', 'hero'],
      ['cat1_title', 'SACS', 'TEXT', 'categories'],
      ['cat1_image', '/images/bags.png', 'IMAGE', 'categories'],
      ['cat2_title', 'VÊTEMENTS', 'TEXT', 'categories'],
      ['cat2_image', '/images/clothing.png', 'IMAGE', 'categories'],
      ['cat3_title', 'BIJOUX', 'TEXT', 'categories'],
      ['cat3_image', '/images/jewelry.png', 'IMAGE', 'categories'],
      ['cat4_title', 'CHAUSSURES', 'TEXT', 'categories'],
      ['cat4_image', '/images/shoes.png', 'IMAGE', 'categories'],
    ];

    for (const [key, value, type, section] of seedContent) {
      await client.query(
        `INSERT INTO home_content (key, value, type, section) 
                 VALUES ($1, $2, $3, $4) 
                 ON CONFLICT (key) 
                 DO UPDATE SET section = EXCLUDED.section, type = EXCLUDED.type`,
        [key, value, type, section]
      );
    }

    console.log("Database seeded successfully.");
  } catch (err) {
    console.error("Initialization error:", err);
  } finally {
    client.release();
    pool.end();
  }
}

init();
