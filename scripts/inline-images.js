/**
 * Inline the on-disk WebP images back INTO the database as base64.
 *
 * The earlier migrate-images.js moved images to files under public/images/db/
 * and stored only the *path* in the DB. That split the data: the DB holds a
 * path, the bytes live in a file on ONE machine. So a DB backup/restore or a
 * deploy to another server loses the images (the path points at a file that
 * isn't there), which is why edits "don't show up" and backups look unchanged.
 *
 * This script reverses that: for every DB value that points at a local
 * /images/db/*.webp file, it reads the (now small, ~100 KB) file and writes it
 * back as a base64 data-URL. After this the database is fully self-contained —
 * every backup, restore, and deploy carries the real images.
 *
 * Safe to re-run: values that aren't a /images/db/ path are left untouched.
 *
 * Usage:  node scripts/inline-images.js
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

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const pool = new Pool({
  connectionString: loadEnv(),
  statement_timeout: 120000,
  connectionTimeoutMillis: 10000,
});

// Turn a "/images/db/foo.webp" path into a base64 data-URL by reading the file.
// Returns the original value unchanged if it isn't a local db image path or the
// file is missing.
function inlinePath(value) {
  if (typeof value !== 'string') return value;
  if (!value.startsWith('/images/db/')) return value;
  const filePath = path.join(PUBLIC_DIR, value);
  if (!fs.existsSync(filePath)) {
    console.warn(`  ! missing file for ${value} — leaving path as-is`);
    return value;
  }
  const buf = fs.readFileSync(filePath);
  const kb = Math.round(buf.length / 1024);
  console.log(`  ${value} -> base64 (${kb} KB)`);
  return `data:image/webp;base64,${buf.toString('base64')}`;
}

async function inlineProducts() {
  console.log('\n== Products ==');
  const { rows } = await pool.query('SELECT id, image_url, images FROM products ORDER BY id');
  for (const row of rows) {
    let images = typeof row.images === 'string' ? JSON.parse(row.images) : (row.images || []);

    // Repair corrupted self-referential image_url ("/api/image/<id>") that a
    // previous edit saved back. Fall back to the first real image.
    let sourceUrl = row.image_url;
    if (typeof sourceUrl === 'string' && sourceUrl.startsWith('/api/image/')) {
      sourceUrl = images[0] || '';
      console.log(`  product ${row.id}: repaired proxy-placeholder image_url -> ${sourceUrl}`);
    }

    let imageUrl = inlinePath(sourceUrl);
    let changed = imageUrl !== row.image_url;

    const newImages = images.map((img) => {
      const inlined = inlinePath(img);
      if (inlined !== img) changed = true;
      return inlined;
    });

    if (changed) {
      await pool.query('UPDATE products SET image_url = $1, images = $2 WHERE id = $3', [
        imageUrl,
        JSON.stringify(newImages),
        row.id,
      ]);
      console.log(`  updated product ${row.id}`);
    }
  }
}

async function inlineSimpleTable(table, label) {
  console.log(`\n== ${label} ==`);
  const { rows } = await pool.query(`SELECT id, image_url FROM ${table} ORDER BY id`);
  for (const row of rows) {
    const inlined = inlinePath(row.image_url);
    if (inlined !== row.image_url) {
      await pool.query(`UPDATE ${table} SET image_url = $1 WHERE id = $2`, [inlined, row.id]);
      console.log(`  updated ${table} ${row.id}`);
    }
  }
}

async function inlineHomeContent() {
  console.log('\n== Home Content ==');
  const { rows } = await pool.query('SELECT id, key, type, value FROM home_content ORDER BY id');
  for (const row of rows) {
    if (row.type === 'IMAGE') {
      const inlined = inlinePath(row.value);
      if (inlined !== row.value) {
        await pool.query('UPDATE home_content SET value = $1 WHERE id = $2', [inlined, row.id]);
        console.log(`  updated home_content ${row.id} (${row.key})`);
      }
    } else if (row.type === 'JSON') {
      let obj;
      try { obj = JSON.parse(row.value); } catch { continue; }
      if (obj && typeof obj.image_url === 'string') {
        const inlined = inlinePath(obj.image_url);
        if (inlined !== obj.image_url) {
          obj.image_url = inlined;
          await pool.query('UPDATE home_content SET value = $1 WHERE id = $2', [JSON.stringify(obj), row.id]);
          console.log(`  updated home_content ${row.id} (${row.key})`);
        }
      }
    }
  }
}

(async () => {
  try {
    await inlineProducts();
    await inlineSimpleTable('categories', 'Categories');
    await inlineSimpleTable('sub_categories', 'Sub-categories');
    await inlineHomeContent();
    console.log('\n✅ Inlining complete. Images now live in the database.');
  } catch (e) {
    console.error('\n❌ Inlining failed:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
