/**
 * Order lines were being destroyed when a product was deleted.
 *
 * order_items.product_id carried `REFERENCES products(id) ON DELETE CASCADE`,
 * so removing a product from the catalogue also deleted every historical order
 * line that pointed at it. That is why "Journal des Ventes" showed 0 products
 * while "Chiffre d'Affaires" still showed the real revenue: orders.total was
 * intact, but every order_items row had been cascaded away.
 *
 * An order line is a financial record — it must outlive the catalogue entry.
 * This migration:
 *   1. adds order_items.product_name, a snapshot of the name at purchase time,
 *      so the sale is still readable after the product is gone;
 *   2. backfills it from products for the lines that still resolve;
 *   3. swaps the FK to ON DELETE SET NULL, so deleting a product detaches the
 *      line instead of deleting it.
 *
 * Safe to run more than once.
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '..', '.env');
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error('DATABASE_URL not found');
}

const pool = new Pool({ connectionString: loadEnv(), connectionTimeoutMillis: 10000 });

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_name VARCHAR(255)');
    console.log('✓ order_items.product_name present');

    const filled = await client.query(`
      UPDATE order_items oi SET product_name = p.name
      FROM products p
      WHERE oi.product_id = p.id AND oi.product_name IS NULL
    `);
    console.log(`✓ backfilled ${filled.rowCount} existing line(s)`);

    // Replace the CASCADE foreign key with SET NULL.
    const fk = await client.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'order_items'::regclass
        AND contype = 'f'
        AND pg_get_constraintdef(oid) LIKE '%REFERENCES products%'
    `);
    for (const row of fk.rows) {
      await client.query(`ALTER TABLE order_items DROP CONSTRAINT ${row.conname}`);
      console.log(`✓ dropped ${row.conname}`);
    }
    await client.query(`
      ALTER TABLE order_items
      ADD CONSTRAINT order_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    `);
    console.log('✓ product_id now ON DELETE SET NULL — deleting a product keeps the sale');

    await client.query('COMMIT');

    const def = await client.query(`
      SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid = 'order_items'::regclass AND conname = 'order_items_product_id_fkey'
    `);
    console.log('\nResulting constraint:', def.rows[0].def);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('FAILED, rolled back:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
