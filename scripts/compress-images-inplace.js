/**
 * One-time migration: shrink the base64 images already stored in Postgres.
 *
 * Uploads made before lib/compressImage.ts existed went in as raw PNG data-URLs
 * — 11 MB for a single product, 183 MB across the table. Every product listing
 * and every /api/image request had to drag those bytes out of the DB, which is
 * what made the admin panel feel like it was hanging after adding a product.
 *
 * This re-encodes each stored data-URL to WebP at the same settings the client
 * uploader now uses (1600px max edge, quality 80) and writes it back in place,
 * so the storage model is unchanged — just ~20x smaller.
 *
 * Safe to re-run: values that are not base64 data-URLs, or that would not get
 * smaller, are left exactly as they are. Nothing is deleted.
 *
 * Usage:  node scripts/compress-images-inplace.js
 *         node scripts/compress-images-inplace.js --dry-run
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function loadEnv() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, '..', '.env');
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error('DATABASE_URL not found');
}

const MAX_DIM = 1600;
const WEBP_QUALITY = 80;
const DRY_RUN = process.argv.includes('--dry-run');

const pool = new Pool({
  connectionString: loadEnv(),
  // Writing back a large row can exceed the app's 15s default.
  statement_timeout: 120000,
});

const kb = n => (n / 1024).toFixed(0) + 'KB';

/** Re-encode one data-URL to WebP. Returns null when it should be left alone. */
async function shrink(value) {
  if (typeof value !== 'string') return null;
  const m = value.match(/^data:(image\/[\w+.-]+);base64,(.+)$/s);
  if (!m) return null;                       // a file path or URL — not ours to touch
  if (m[1] === 'image/svg+xml') return null; // vector: rasterizing would degrade it

  const input = Buffer.from(m[2], 'base64');
  let out;
  try {
    out = await sharp(input)
      .rotate()                              // honour EXIF orientation before resizing
      .resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  } catch (e) {
    console.warn('    ! could not decode image, leaving as-is:', e.message);
    return null;
  }

  const next = `data:image/webp;base64,${out.toString('base64')}`;
  // Never make a row bigger than it already was.
  return next.length < value.length ? next : null;
}

async function main() {
  let savedTotal = 0;

  // ---- products: image_url (single) + images (jsonb array) ----
  const products = await pool.query(
    'SELECT id, name, image_url, images FROM products ORDER BY id'
  );

  for (const p of products.rows) {
    let changed = false;
    let before = 0, after = 0;

    const nextUrl = await shrink(p.image_url);
    if (nextUrl) {
      before += p.image_url.length; after += nextUrl.length; changed = true;
    }

    const arr = Array.isArray(p.images) ? p.images : [];
    const nextArr = [];
    for (const img of arr) {
      const next = await shrink(img);
      if (next) {
        before += img.length; after += next.length; changed = true;
        nextArr.push(next);
      } else {
        nextArr.push(img);
      }
    }

    if (!changed) continue;

    console.log(
      `product ${p.id} ${(p.name || '').slice(0, 24).padEnd(26)} ${kb(before)} -> ${kb(after)}`
    );
    savedTotal += before - after;

    if (!DRY_RUN) {
      await pool.query(
        'UPDATE products SET image_url = $1, images = $2 WHERE id = $3',
        [nextUrl || p.image_url, JSON.stringify(nextArr), p.id]
      );
    }
  }

  // ---- categories / sub_categories / home_content: single image_url ----
  for (const [table, col] of [
    ['categories', 'image_url'],
    ['sub_categories', 'image_url'],
    ['home_content', 'value'],
  ]) {
    let rows;
    try {
      rows = await pool.query(`SELECT id, ${col} AS v FROM ${table} ORDER BY id`);
    } catch {
      continue; // table not present in this deployment
    }
    for (const r of rows.rows) {
      const next = await shrink(r.v);
      if (!next) continue;
      console.log(`${table} ${r.id}  ${kb(r.v.length)} -> ${kb(next.length)}`);
      savedTotal += r.v.length - next.length;
      if (!DRY_RUN) {
        await pool.query(`UPDATE ${table} SET ${col} = $1 WHERE id = $2`, [next, r.id]);
      }
    }
  }

  console.log(`\n${DRY_RUN ? '[dry run] would save' : 'saved'} ~${(savedTotal / 1024 / 1024).toFixed(1)} MB`);

  if (!DRY_RUN) {
    // UPDATE leaves dead tuples behind; without this the table keeps its old
    // size on disk and the reads stay slow.
    console.log('Reclaiming space (VACUUM FULL)...');
    try {
      await pool.query('VACUUM FULL products');
      await pool.query('VACUUM FULL home_content');
    } catch (e) {
      console.warn('VACUUM FULL failed (needs table ownership):', e.message);
      console.warn('Run it manually as the table owner to reclaim disk space.');
    }
  }

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
