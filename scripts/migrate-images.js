/**
 * One-time migration: move giant base64 images out of Postgres and onto disk.
 *
 * The DB currently stores product/category images as base64 data-URLs inside
 * TEXT / JSONB columns. Some are 30-40 MB each, which makes every image request
 * transfer tens of megabytes over the network and blows the statement timeout.
 *
 * This script decodes each base64 image, resizes + compresses it to WebP with
 * sharp, writes it to public/images/db/, and replaces the DB value with the
 * static file path (e.g. /images/db/product-9-0.webp).
 *
 * Safe to re-run: rows already pointing at /images/... are skipped.
 *
 * Usage:  node scripts/migrate-images.js
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Load DATABASE_URL from .env (first non-commented value wins).
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

const OUT_DIR = path.join(__dirname, '..', 'public', 'images', 'db');
const MAX_DIM = 1600;      // cap the longest edge
const WEBP_QUALITY = 80;

fs.mkdirSync(OUT_DIR, { recursive: true });

const pool = new Pool({
  connectionString: loadEnv(),
  statement_timeout: 120000,
  connectionTimeoutMillis: 10000,
});

function isBase64Image(v) {
  return typeof v === 'string' && /^data:image\/\w+;base64,/.test(v);
}

async function toWebpFile(dataUrl, name) {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const buf = Buffer.from(base64, 'base64');
  const outName = `${name}.webp`;
  const outPath = path.join(OUT_DIR, outName);
  await sharp(buf)
    .rotate() // respect EXIF orientation
    .resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(outPath);
  const kb = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`  -> ${outName} (${kb} KB)`);
  return `/images/db/${outName}`;
}

async function migrateProducts() {
  console.log('\n== Products ==');
  const { rows } = await pool.query('SELECT id FROM products ORDER BY id');
  for (const { id } of rows) {
    // Fetch one product at a time to avoid loading everything into memory.
    const r = await pool.query('SELECT image_url, images FROM products WHERE id = $1', [id]);
    const row = r.rows[0];
    let imageUrl = row.image_url;
    let images = typeof row.images === 'string' ? JSON.parse(row.images) : (row.images || []);
    let changed = false;

    if (isBase64Image(imageUrl)) {
      console.log(`product ${id} image_url (${Math.round(imageUrl.length / 1024)} KB base64)`);
      imageUrl = await toWebpFile(imageUrl, `product-${id}-main`);
      changed = true;
    }

    for (let i = 0; i < images.length; i++) {
      if (isBase64Image(images[i])) {
        console.log(`product ${id} images[${i}] (${Math.round(images[i].length / 1024)} KB base64)`);
        images[i] = await toWebpFile(images[i], `product-${id}-${i}`);
        changed = true;
      }
    }

    if (changed) {
      await pool.query('UPDATE products SET image_url = $1, images = $2 WHERE id = $3', [
        imageUrl,
        JSON.stringify(images),
        id,
      ]);
      console.log(`  updated product ${id}`);
    }
  }
}

async function migrateSimpleTable(table, label) {
  console.log(`\n== ${label} ==`);
  const { rows } = await pool.query(`SELECT id FROM ${table} ORDER BY id`);
  for (const { id } of rows) {
    const r = await pool.query(`SELECT image_url FROM ${table} WHERE id = $1`, [id]);
    const v = r.rows[0].image_url;
    if (isBase64Image(v)) {
      console.log(`${table} ${id} (${Math.round(v.length / 1024)} KB base64)`);
      const p = await toWebpFile(v, `${table}-${id}`);
      await pool.query(`UPDATE ${table} SET image_url = $1 WHERE id = $2`, [p, id]);
      console.log(`  updated ${table} ${id}`);
    }
  }
}

async function migrateHomeContent() {
  console.log('\n== Home Content (IMAGE) ==');
  const { rows } = await pool.query("SELECT id, value FROM home_content WHERE type = 'IMAGE'");
  for (const row of rows) {
    if (isBase64Image(row.value)) {
      console.log(`home_content ${row.id} (${Math.round(row.value.length / 1024)} KB base64)`);
      const p = await toWebpFile(row.value, `home-${row.id}`);
      await pool.query('UPDATE home_content SET value = $1 WHERE id = $2', [p, row.id]);
      console.log(`  updated home_content ${row.id}`);
    }
  }
}

async function migrateHomeContentJson() {
  // JSON slots (e.g. Instagram posts) can embed a base64 image inside
  // { image_url: "data:image/..." }. Extract those too.
  console.log('\n== Home Content (JSON) ==');
  const { rows } = await pool.query("SELECT id, key, value FROM home_content WHERE type = 'JSON'");
  for (const row of rows) {
    let obj;
    try {
      obj = JSON.parse(row.value);
    } catch {
      continue; // not valid JSON, skip
    }
    if (obj && isBase64Image(obj.image_url)) {
      console.log(`home_content ${row.id} (${row.key}) image_url (${Math.round(obj.image_url.length / 1024)} KB base64)`);
      obj.image_url = await toWebpFile(obj.image_url, `home-json-${row.id}`);
      await pool.query('UPDATE home_content SET value = $1 WHERE id = $2', [JSON.stringify(obj), row.id]);
      console.log(`  updated home_content ${row.id}`);
    }
  }
}

(async () => {
  try {
    await migrateProducts();
    await migrateSimpleTable('categories', 'Categories');
    await migrateSimpleTable('sub_categories', 'Sub-categories');
    await migrateHomeContent();
    await migrateHomeContentJson();
    console.log('\n✅ Migration complete.');
  } catch (e) {
    console.error('\n❌ Migration failed:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
