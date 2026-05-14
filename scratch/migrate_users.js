const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  try {
    console.log("Starting manual migration...");
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
    `);
    console.log("Migration successful: 'name' column added to 'users' table.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await pool.end();
  }
}

migrate();
