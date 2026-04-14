const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://postgres:postgres@localhost:5432/seaura"
});

async function seed() {
  const client = await pool.connect();
  try {
    // 1. Get Category ID for "Bijoux"
    let catRes = await client.query("SELECT id FROM categories WHERE name ILIKE 'bijoux'");
    let catId;
    if (catRes.rows.length === 0) {
      const insCat = await client.query("INSERT INTO categories (name) VALUES ('Bijoux') RETURNING id");
      catId = insCat.rows[0].id;
    } else {
      catId = catRes.rows[0].id;
    }

    // 2. Clear old test products to match screenshot
    await client.query("DELETE FROM products");

    // 3. Insert the 4 specific products from the screenshot
    const products = [
      {
        name: "THE DEMI BASE CHAIN",
        price: 45.0,
        description: "A timeless base chain for your unique collection.",
        image_url: "/images/jewelry.png"
      },
      {
        name: "PAVE INITIAL CHARM",
        price: 25.0,
        description: "Elegant pave charm with your initial.",
        image_url: "/images/jewelry.png"
      },
      {
        name: "CLOVER CHARM",
        price: 20.0,
        description: "Four-leaf clover charm for good luck.",
        image_url: "/images/jewelry.png"
      },
      {
        name: "THE DEMI BASE BRACELET",
        price: 35.0,
        description: "Matching base bracelet for a complete set.",
        image_url: "/images/jewelry.png"
      }
    ];

    for (const p of products) {
      await client.query(
        "INSERT INTO products (name, price, description, category_id, image_url) VALUES ($1, $2, $3, $4, $5)",
        [p.name, p.price, p.description, catId, p.image_url]
      );
    }

    console.log("Database seeded with screenshot products!");
  } finally {
    client.release();
    pool.end();
  }
}

seed().catch(console.error);
