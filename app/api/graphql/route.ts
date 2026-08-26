import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { gql } from 'graphql-tag';
import { query, initDb } from '@/lib/db';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth';
import { getServerSession } from "next-auth/next";
import { sendEmail, verifySmtp } from '@/lib/mail';
import * as bcrypt from 'bcrypt';

// First-order discount. One use per email address, ever.
const FIRST_ORDER_DISCOUNT_PERCENT = 10;

/**
 * SQL that resolves the single active discount percentage for each product.
 *
 * Precedence is "most specific wins": a product rule beats a sub-category rule,
 * which beats a category rule. Ties inside the same scope go to the larger
 * percentage. Only rules whose date window covers today are considered, so
 * discounts start and expire on their own with no cron job.
 *
 * Exposed as a joinable fragment (alias `d`) so the products, product and
 * order paths all price identically.
 */
const ACTIVE_DISCOUNT_JOIN = `
  LEFT JOIN LATERAL (
    SELECT dd.percent
    FROM discounts dd
    WHERE CURRENT_DATE BETWEEN dd.starts_at AND dd.ends_at
      AND (
        (dd.scope = 'product'     AND dd.target_id = p.id)
        OR (dd.scope = 'subcategory' AND dd.target_id = p.sub_category_id)
        OR (dd.scope = 'category'    AND dd.target_id = p.category_id)
      )
    ORDER BY CASE dd.scope WHEN 'product' THEN 0 WHEN 'subcategory' THEN 1 ELSE 2 END,
             dd.percent DESC
    LIMIT 1
  ) d ON TRUE
`;

/** Price after an active discount, rounded to cents. */
const discountedPrice = (price: number, percent: number | null) =>
  percent ? Number((price - (price * percent) / 100).toFixed(2)) : Number(price);

/** The back-in-stock email, shared by the automatic and manual send paths. */
const backInStockMail = (product: { id: any; name: string }, to: string) => {
  const siteUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
  const link = siteUrl ? `${siteUrl.replace(/\/$/, '')}/shop/${product.id}` : '';
  return {
    from: 'SEAURA',
    to: [to],
    subject: `${product.name} est de nouveau disponible`,
    content:
      `Bonne nouvelle !\n\n` +
      `${product.name} est de nouveau en stock.\n\n` +
      (link ? `Commandez ici : ${link}\n\n` : '') +
      `Les quantités sont limitées.\n\nSEAURA`,
    images: [] as string[],
    unsubscribeEmail: to
  };
};

/**
 * Emails everyone waiting on `productId` that it is back in stock, then marks
 * their requests notified so they are never mailed twice.
 *
 * Rows are claimed with a single UPDATE ... RETURNING before any mail is sent:
 * that way two concurrent restocks cannot both pick up the same recipients.
 * Failures roll the claim back so the alert is retried on the next restock
 * rather than silently lost.
 */
const notifyBackInStock = async (productId: string | number) => {
  const prod = await query("SELECT id, name, stock FROM products WHERE id = $1", [productId]);
  const product = prod.rows[0];
  if (!product || product.stock <= 0) return 0;

  const claimed = await query(
    `UPDATE stock_notifications
     SET notified_at = CURRENT_TIMESTAMP
     WHERE product_id = $1 AND notified_at IS NULL
     RETURNING id, email`,
    [productId]
  );
  if (claimed.rowCount === 0) return 0;

  const recipients: string[] = claimed.rows.map((r: any) => r.email);
  const ids: number[] = claimed.rows.map((r: any) => r.id);

  try {
    // One mail per recipient so addresses are not disclosed to each other.
    for (const to of recipients) {
      await sendEmail(backInStockMail(product, to));
    }
  } catch (err) {
    // Un-claim so the next restock retries instead of dropping the alert.
    await query(
      "UPDATE stock_notifications SET notified_at = NULL WHERE id = ANY($1::int[])",
      [ids]
    );
    console.error('Failed to send back-in-stock emails:', err);
    return 0;
  }

  return recipients.length;
};

/**
 * True when this email has never placed an order that counts as "used".
 * Cancelled orders are ignored, so a customer whose order fell through can
 * still claim the discount later.
 *
 * Matching is case-insensitive and trimmed: Foo@Bar.com and foo@bar.com are
 * the same customer and must not each get a first order.
 */
const isFirstOrderEmail = async (email?: string | null) => {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return false;

  const res = await query(
    `SELECT 1 FROM orders
     WHERE lower(customer_email) = $1
       AND coalesce(status, '') <> 'CANCELLED'
     LIMIT 1`,
    [normalized]
  );
  return res.rowCount === 0;
};

/**
 * Gives an order's quantities back to product stock. Only meaningful for an
 * order that actually took stock, i.e. one that reached COMPLETED.
 * Lines whose product was deleted have a null product_id and are skipped.
 */
const restoreStockForOrder = async (orderId: string | number) => {
  const items = await query(
    "SELECT product_id, quantity FROM order_items WHERE order_id = $1",
    [orderId]
  );
  for (const item of items.rows) {
    if (item.product_id) {
      await query(
        "UPDATE products SET stock = stock + $1 WHERE id = $2",
        [item.quantity, item.product_id]
      );
    }
  }
};

/**
 * Re-sums an order's total from its remaining lines after an edit, so the
 * amount shown in Commandes and counted as revenue stays consistent.
 * Discounts already granted are preserved.
 */
const recalculateOrderTotal = async (orderId: string | number) => {
  const res = await query(
    `SELECT COALESCE(SUM(price * quantity), 0)::float AS merchandise
     FROM order_items WHERE order_id = $1`,
    [orderId]
  );
  const merchandise = Number(res.rows[0]?.merchandise || 0);

  const ord = await query("SELECT discount_percent FROM orders WHERE id = $1", [orderId]);
  const percent = Number(ord.rows[0]?.discount_percent || 0);
  const discount = Number(((merchandise * percent) / 100).toFixed(2));

  await query(
    "UPDATE orders SET total = $1, discount_amount = $2 WHERE id = $3",
    [Number((merchandise - discount).toFixed(2)), discount, orderId]
  );
};

/**
 * Swaps a row's sort_order with the sibling directly above ('up') or below
 * ('down') it in the displayed order. Siblings are all categories, or — for
 * sub_categories — the rows sharing the same category_id.
 *
 * The order is normalised to 1..n first so rows that never received a
 * sort_order (NULL) still have a well-defined position to swap against.
 * Returns false when the row is already at the edge, which is a no-op.
 */
const swapSortOrder = async (table: 'categories' | 'sub_categories', id: string, direction: 'up' | 'down') => {
  // Restricts both statements to the sibling group. `scopedAnd` qualifies the
  // column with the `n` alias, since an unqualified name there would bind to the
  // outer table. Categories have no scope, so the normalise query then takes no
  // parameters at all.
  const isSub = table === 'sub_categories';
  const parent = `(SELECT category_id FROM sub_categories WHERE id = $1)`;
  const scope = isSub ? `WHERE category_id = ${parent}` : '';
  const scopedAnd = isSub ? `n.category_id = ${parent} AND` : '';

  await query(`
    UPDATE ${table} t SET sort_order = o.rn
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order ASC NULLS LAST, name ASC) AS rn
      FROM ${table} ${scope}
    ) o
    WHERE t.id = o.id AND t.sort_order IS DISTINCT FROM o.rn
  `, isSub ? [id] : []);

  const comparator = direction === 'up' ? '<' : '>';
  const neighbourOrder = direction === 'up' ? 'DESC' : 'ASC';

  const res = await query(`
    WITH current AS (SELECT id, sort_order FROM ${table} WHERE id = $1),
    neighbour AS (
      SELECT n.id, n.sort_order FROM ${table} n, current c
      WHERE ${scopedAnd} n.sort_order ${comparator} c.sort_order
      ORDER BY n.sort_order ${neighbourOrder}
      LIMIT 1
    )
    UPDATE ${table} u
    SET sort_order = CASE WHEN u.id = (SELECT id FROM current) THEN (SELECT sort_order FROM neighbour)
                          ELSE (SELECT sort_order FROM current) END
    WHERE u.id IN (SELECT id FROM current UNION SELECT id FROM neighbour)
      AND EXISTS (SELECT 1 FROM neighbour)
    RETURNING u.id
  `, [id]);

  return res.rowCount === 2;
};

const typeDefs = gql`
  type User {
    id: ID!
    email: String!
    role: String!
    name: String
  }

  type UserWithStats {
    id: ID!
    email: String!
    role: String!
    name: String
    order_count: Int
    created_at: String
  }

  type Category {
    id: ID!
    name: String!
    image_url: String
    sort_order: Int
    sub_categories: [SubCategory!]
  }

  type SubCategory {
    id: ID!
    name: String!
    category_id: ID!
    image_url: String
    sort_order: Int
  }

  type Color {
    name: String!
    hex: String!
  }

  input ColorInput {
    name: String!
    hex: String!
  }

  type Product {
    id: ID!
    name: String!
    description: String
    price: Float!
    image_url: String
    category_id: ID
    sub_category_id: ID
    "Original price before any active discount, or null when not discounted."
    original_price: Float
    "Active discount percentage, or null. The date window is never exposed."
    discount_percent: Float
    colors: [Color!]
    images: [String!]
    sizes: [String!]
    has_sizes: Boolean
    stock: Int
    created_at: String
  }

  type HomeContent {
    id: ID!
    key: String!
    value: String!
    type: String!
    section: String
  }

  type NewsletterEntry {
    id: ID!
    email: String!
    created_at: String
  }

  type OrderItem {
    id: ID!
    product_name: String
    quantity: Int!
    price: Float!
    size: String
    color: String
  }

  type Order {
    id: ID!
    user_id: ID
    customer_email: String
    customer_phone: String
    total: Float!
    discount_amount: Float
    discount_percent: Int
    status: String!
    payment_status: String!
    created_at: String
    items: [OrderItem!]
  }

  "Whether an email still qualifies for the one-time first-order discount."
  type DiscountEligibility {
    eligible: Boolean!
    percent: Int!
  }

  "A percentage discount scoped to a category, sub-category or product. Admin-only."
  type Discount {
    id: ID!
    scope: String!
    target_id: ID!
    target_name: String
    percent: Float!
    starts_at: String!
    ends_at: String!
    "Derived: whether today falls inside the date window."
    is_active: Boolean!
    "How many products this rule currently prices."
    product_count: Int
  }

  "A shopper waiting to hear that a product is back in stock."
  type StockNotification {
    id: ID!
    email: String!
    product_id: ID!
    product_name: String
    product_stock: Int
    created_at: String
    notified_at: String
  }

  type Charge {
    id: ID!
    description: String!
    amount: Float!
    category: String
    date: String
    created_at: String
  }

  type Cart {
    id: ID!
    session_id: String
    items: String
    updated_at: String
  }

  type ChatSession {
    id: ID!
    user_email: String!
    created_at: String
  }

  type ChatMessage {
    id: ID!
    session_id: ID!
    sender_role: String!
    content: String!
    created_at: String
  }

  type Setting {
    key: String!
    value: String!
  }

  input OrderItemInput {
    id: ID!
    name: String!
    price: Float!
    selectedSize: String!
    selectedColor: String!
    quantity: Int
  }

  type Query {
    products(limit: Int): [Product!]!
    categories: [Category!]!
    homeContent: [HomeContent!]!
    newsletter: [NewsletterEntry!]!
    me: User
    settings: [Setting!]!
    chatSessions: [ChatSession!]!
    chatHistory(email: String!): [ChatMessage!]!
    orders: [Order!]!
    activeCarts: [Cart!]!
    wishlist(email: String!): String
    charges: [Charge!]!
    searchProducts(term: String!): [Product!]!
    product(id: ID!): Product
    subCategories(categoryId: ID): [SubCategory!]!
    users: [UserWithStats!]!
    firstOrderDiscount(email: String!): DiscountEligibility!
    stockNotifications: [StockNotification!]!
    discounts: [Discount!]!
    "Verifies the stored SMTP credentials without sending a message."
    testSmtpConnection: String!
  }

  type Mutation {
    createProduct(name: String!, description: String, price: Float!, image_url: String, category_id: ID, sub_category_id: ID, colors: [ColorInput!], images: [String!], sizes: [String!], has_sizes: Boolean, stock: Int): Product!
    updateProduct(id: ID!, name: String!, description: String, price: Float!, image_url: String, category_id: ID, sub_category_id: ID, colors: [ColorInput!], images: [String!], sizes: [String!], has_sizes: Boolean, stock: Int): Product!
    deleteProduct(id: ID!): Boolean!
    updateHomeContent(key: String!, value: String!, type: String!, section: String): HomeContent!
    deleteHomeContent(key: String!): Boolean!
    subscribeNewsletter(email: String!): Boolean!
    deleteNewsletter(id: ID!): Boolean!
    createOrder(total: Float!, items: [OrderItemInput!]!, email: String, phone: String, address: String, city: String): Order!
    updateOrderStatus(id: ID!, status: String!): Order!
    updateCart(sessionId: String!, items: String!): Boolean!
    createCategory(name: String!, image_url: String): Category!
    updateCategory(id: ID!, name: String, image_url: String): Category!
    deleteCategory(id: ID!): Boolean!
    sendChatMessage(email: String!, content: String!, role: String!): ChatMessage!
    deleteChatSession(email: String!): Boolean!
    sendEmailCampaign(from: String!, recipients: [String!]!, content: String!, images: [String!]): Boolean!
    updateSetting(key: String!, value: String!): Setting!
    updateWishlist(email: String!, items: String!): Boolean!
    createCharge(description: String!, amount: Float!, category: String, date: String): Charge!
    deleteCharge(id: ID!): Boolean!
    updateOrderPaymentStatus(id: ID!, payment_status: String!): Order!
    "Marks an order CANCELLED: kept for the record, excluded from revenue, stock returned."
    cancelOrder(id: ID!): Order!
    "Restores a cancelled order to PENDING."
    restoreOrder(id: ID!): Order!
    "Permanently deletes an order and its lines. Irreversible - the sale disappears from history and from revenue."
    deleteOrder(id: ID!): Boolean!
    updateOrderItem(id: ID!, quantity: Int, price: Float): Order!
    deleteOrderItem(id: ID!): Order!
    createSubCategory(name: String!, category_id: ID!, image_url: String): SubCategory!
    updateSubCategory(id: ID!, name: String, image_url: String): SubCategory!
    deleteSubCategory(id: ID!): Boolean!
    notifyWhenAvailable(product_id: ID!, email: String!): Boolean!
    createDiscount(scope: String!, target_id: ID!, percent: Float!, starts_at: String!, ends_at: String!): Discount!
    deleteDiscount(id: ID!): Boolean!
    sendStockNotification(id: ID!): Boolean!
    deleteStockNotification(id: ID!): Boolean!
    moveCategory(id: ID!, direction: String!): Boolean!
    moveSubCategory(id: ID!, direction: String!): Boolean!
    deleteCart(sessionId: String!): Boolean!
    updateUserPassword(id: ID!, password: String!): Boolean!
  }
`;

const resolvers = {
  Query: {
    users: async (_: any, __: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      const res = await query(`
        SELECT u.id, u.email, u.role, u.created_at::text,
        (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id OR o.customer_email = u.email) as order_count
        FROM users u
        ORDER BY u.created_at DESC
      `);
      return res.rows;
    },
    products: async (_: any, { limit }: { limit?: number }) => {
      const limitStr = limit ? `LIMIT ${limit}` : '';
      const res = await query(`
        SELECT p.id, p.name, p.price, p.description, p.category_id, p.sub_category_id,
               p.colors, p.sizes, p.has_sizes, p.stock, p.created_at,
               -- Fingerprint from the write timestamp, NOT from hashing the
               -- image bytes. Hashing image_url || images::text forced Postgres
               -- to detoast and md5 every multi-MB base64 blob on every listing
               -- (~3s across 180MB), which is why a newly added product took so
               -- long to appear. updated_at changes on every write, so it busts
               -- the browser cache just as reliably for free.
               left(md5(extract(epoch from coalesce(p.updated_at, p.created_at))::text), 8) AS v,
               -- Count only, so the multi-MB base64 blobs stay out of this query.
               jsonb_array_length(coalesce(p.images, '[]'::jsonb)) AS image_count,
               d.percent AS discount_percent
        FROM products p
        ${ACTIVE_DISCOUNT_JOIN}
        ORDER BY p.created_at DESC
        ${limitStr}
      `);
      return res.rows.map((r: any) => ({
        ...r,
        // `price` becomes the price customers actually pay; the pre-discount
        // value moves to original_price so the UI can strike it through.
        price: discountedPrice(Number(r.price), r.discount_percent),
        original_price: r.discount_percent ? Number(r.price) : null,
        discount_percent: r.discount_percent ? Number(r.discount_percent) : null,
        // ?v=<fingerprint> busts the browser cache whenever the stored image
        // changes, so edited product images appear immediately.
        image_url: `/api/image/${r.id}?v=${r.v}`,
        // One proxy URL per stored image, so products with more than two photos
        // show all of them.
        images: Array.from(
          { length: r.image_count },
          (_, i) => `/api/image/${r.id}?idx=${i}&v=${r.v}`
        )
      }));
    },
    categories: async () => {
      // sort_order is the admin-controlled display order; NULLS LAST + name keeps
      // rows created before the column existed at the end in a stable order.
      const res = await query("SELECT id, name, sort_order, left(md5(coalesce(image_url,'')), 8) AS v FROM categories ORDER BY sort_order ASC NULLS LAST, name ASC");
      const subRes = await query("SELECT id, name, category_id, sort_order, left(md5(coalesce(image_url,'')), 8) AS v FROM sub_categories ORDER BY sort_order ASC NULLS LAST, name ASC");

      return res.rows.map((r: any) => ({
        ...r,
        image_url: `/api/image/${r.id}?type=category&v=${r.v}`,
        sub_categories: subRes.rows
          .filter((s: any) => s.category_id === r.id)
          .map((s: any) => ({
            ...s,
            image_url: `/api/image/${s.id}?type=subcategory&v=${s.v}`
          }))
      }));
    },
    // Lets checkout show the discount before the order is placed. Advisory
    // only — createOrder re-checks eligibility and recomputes the amount, so a
    // forged response here cannot grant a discount.
    firstOrderDiscount: async (_: any, { email }: { email: string }) => ({
      eligible: await isFirstOrderEmail(email),
      percent: FIRST_ORDER_DISCOUNT_PERCENT
    }),
    testSmtpConnection: async (_: any, __: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      return verifySmtp();
    },
    // Discount rules with the name of whatever they target and how many
    // products each one currently prices. Admin-only: the date windows are
    // internal and must never reach the storefront.
    discounts: async (_: any, __: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      const res = await query(`
        SELECT dd.id, dd.scope, dd.target_id, dd.percent,
               dd.starts_at::text, dd.ends_at::text,
               (CURRENT_DATE BETWEEN dd.starts_at AND dd.ends_at) AS is_active,
               CASE dd.scope
                 WHEN 'category'    THEN (SELECT name FROM categories     WHERE id = dd.target_id)
                 WHEN 'subcategory' THEN (SELECT name FROM sub_categories WHERE id = dd.target_id)
                 ELSE                    (SELECT name FROM products       WHERE id = dd.target_id)
               END AS target_name,
               CASE dd.scope
                 WHEN 'category'    THEN (SELECT count(*) FROM products WHERE category_id = dd.target_id)
                 WHEN 'subcategory' THEN (SELECT count(*) FROM products WHERE sub_category_id = dd.target_id)
                 ELSE 1
               END AS product_count
        FROM discounts dd
        ORDER BY is_active DESC, dd.starts_at DESC, dd.id DESC
      `);
      return res.rows.map((r: any) => ({
        ...r,
        percent: Number(r.percent),
        product_count: Number(r.product_count)
      }));
    },
    // Back-in-stock requests for the admin newsletter view. Pending first, then
    // most recent, so the actionable rows are at the top.
    stockNotifications: async (_: any, __: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      const res = await query(`
        SELECT sn.id, sn.email, sn.product_id, sn.created_at::text, sn.notified_at::text,
               p.name AS product_name, p.stock AS product_stock
        FROM stock_notifications sn
        LEFT JOIN products p ON p.id = sn.product_id
        ORDER BY (sn.notified_at IS NOT NULL), sn.created_at DESC
      `);
      return res.rows;
    },
    subCategories: async (_: any, { categoryId }: { categoryId?: string }) => {
      const where = categoryId ? `WHERE category_id = $1` : '';
      const params = categoryId ? [categoryId] : [];
      const res = await query(`SELECT id, name, category_id, sort_order, left(md5(coalesce(image_url,'')), 8) AS v FROM sub_categories ${where} ORDER BY sort_order ASC NULLS LAST, name ASC`, params);
      return res.rows.map((r: any) => ({
        ...r,
        image_url: `/api/image/${r.id}?type=subcategory&v=${r.v}`
      }));
    },
    homeContent: async () => {
      const res = await query(`
        SELECT id, key, type, section,
               CASE WHEN type = 'IMAGE' THEN '' ELSE value END as value,
               EXTRACT(EPOCH FROM updated_at)::bigint AS v
        FROM home_content
      `);
      return res.rows.map((r: any) => {
        if (r.type === 'IMAGE') {
          // Append updated_at as a cache-busting version so a freshly edited
          // image gets a new URL and the browser fetches it immediately.
          return { ...r, value: `/api/image/${r.id}?type=home&v=${r.v || 0}` };
        }
        // Never ship a giant inline base64 image inside a JSON slot — it
        // freezes the DOM. Point at the image proxy instead, which unwraps the
        // embedded image_url and streams it as real image bytes. (This used to
        // substitute /logo1.png, which silently discarded whatever the admin
        // had just uploaded.)
        if (r.type === 'JSON' && typeof r.value === 'string' && r.value.includes('data:image')) {
          try {
            const obj = JSON.parse(r.value);
            if (typeof obj.image_url === 'string' && obj.image_url.startsWith('data:image')) {
              obj.image_url = `/api/image/${r.id}?type=home&v=${r.v || 0}`;
              return { ...r, value: JSON.stringify(obj) };
            }
          } catch {
            // fall through and return as-is
          }
        }
        return r;
      });
    },
    newsletter: async (_: any, __: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      const res = await query("SELECT * FROM newsletter ORDER BY created_at DESC");
      return res.rows;
    },
    me: async (_: any, __: any, context: any) => {
      return context.session?.user;
    },
    settings: async (_: any, __: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      const res = await query("SELECT * FROM settings");
      return res.rows;
    },
    chatSessions: async (_: any, __: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      const res = await query("SELECT id, user_email, created_at::text FROM chat_sessions ORDER BY created_at DESC");
      return res.rows;
    },
    chatHistory: async (_: any, { email }: any, context: any) => {
      // Only your own conversation, unless you're an admin — otherwise any
      // email address could be used to read someone else's messages.
      const isAdmin = context.session?.user?.role === 'ADMIN';
      if (!isAdmin && context.session?.user?.email !== email) throw new Error('Not authorized');
      const res = await query(
        "SELECT m.id, m.session_id, m.sender_role, m.content, m.created_at::text FROM chat_messages m JOIN chat_sessions s ON m.session_id = s.id WHERE s.user_email = $1 ORDER BY m.created_at ASC",
        [email]
      );
      return res.rows;
    },
    orders: async (_: any, __: any, context: any) => {
      // Admin-only: exposes every customer's email, phone and order history.
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      // Optimise: Use a single query with JOIN to avoid N+1 issue
      const res = await query(`
        SELECT o.id, o.user_id, o.total, o.status, o.payment_status, o.created_at::text, o.customer_email, o.customer_phone,
               COALESCE(
                 json_agg(
                   json_build_object(
                     'id', oi.id,
                     'product_id', oi.product_id,
                     'quantity', oi.quantity,
                     'price', oi.price,
                     'size', oi.size,
                     'color', oi.color,
                     'product_name', COALESCE(oi.product_name, p.name, 'Produit supprimé')
                   )
                 ) FILTER (WHERE oi.id IS NOT NULL),
                 '[]'
               ) as items
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        GROUP BY o.id
        ORDER BY o.created_at DESC
      `);
      return res.rows;
    },
    activeCarts: async (_: any, __: any, context: any) => {
      // Admin-only: live view of every visitor's basket.
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      try {
        const res = await query("SELECT id, session_id, items, updated_at::text FROM carts ORDER BY updated_at DESC LIMIT 50");
        // Diagnostic : on s'assure que chaque champ est bien là, quitte à forcer les noms
        return res.rows.map((row: any) => {
          const itemsData = row.items || [];
          return {
            id: String(row.id),
            session_id: String(row.session_id || 'Anon'),
            items: typeof itemsData === 'string' ? itemsData : JSON.stringify(itemsData),
            updated_at: String(row.updated_at || Date.now())
          };
        });
      } catch (err) {
        console.error("activeCarts error:", err);
        return [];
      }
    },
    wishlist: async (_: any, { email }: any, context: any) => {
      // Only your own wishlist, unless you're an admin.
      const isAdmin = context.session?.user?.role === 'ADMIN';
      if (!isAdmin && context.session?.user?.email !== email) throw new Error('Not authorized');
      const res = await query("SELECT items FROM wishlists WHERE user_email = $1", [email]);
      return res.rows[0] ? JSON.stringify(res.rows[0].items) : "[]";
    },
    charges: async (_: any, __: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      const res = await query("SELECT id, description, amount, category, TO_CHAR(date, 'YYYY-MM-DD') as date FROM charges ORDER BY date DESC");
      return res.rows;
    },
    searchProducts: async (_: any, { term }: any) => {
      const res = await query(
        `SELECT id, name, price, image_url, images
         FROM products 
         WHERE name ILIKE $1 OR description ILIKE $1 
         ORDER BY created_at DESC LIMIT 6`,
        [`%${term}%`]
      );
      return res.rows.map((r: any) => ({
        ...r,
        image_url: `/api/image/${r.id}`,
        images: typeof r.images === 'string' ? JSON.parse(r.images) : r.images
      }));
    },
    product: async (_: any, { id }: any) => {
      const res = await query(`
        SELECT p.id, p.name, p.price, p.description, p.category_id, p.sub_category_id,
               p.colors, p.sizes, p.has_sizes, p.image_url, p.images, p.stock,
               d.percent AS discount_percent
        FROM products p
        ${ACTIVE_DISCOUNT_JOIN}
        WHERE p.id = $1
      `, [id]);
      const r = res.rows[0];
      if (!r) return null;
      return {
        ...r,
        price: discountedPrice(Number(r.price), r.discount_percent),
        original_price: r.discount_percent ? Number(r.price) : null,
        discount_percent: r.discount_percent ? Number(r.discount_percent) : null,
        images: typeof r.images === 'string' ? JSON.parse(r.images) : r.images
      };
    }
  },
  Mutation: {
    createProduct: async (_: any, { name, description, price, image_url, category_id, sub_category_id, colors, images, sizes, has_sizes, stock }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      const res = await query(
        // RETURNING the specific columns rather than * keeps the multi-MB
        // base64 blobs we just wrote from being sent straight back to us.
        "INSERT INTO products (name, description, price, image_url, category_id, sub_category_id, colors, images, sizes, has_sizes, stock) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, name, description, price, category_id, sub_category_id, colors, sizes, has_sizes, stock, created_at",
        [name, description, price, image_url, category_id, sub_category_id || null, JSON.stringify(colors || []), JSON.stringify(images || []), JSON.stringify(sizes || []), has_sizes !== undefined ? has_sizes : true, stock || 10]
      );
      return res.rows[0];
    },
    updateProduct: async (_: any, { id, name, description, price, image_url, category_id, sub_category_id, colors, images, sizes, has_sizes, stock }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');

      // Read the previous stock to detect a restock. Any increase counts, not
      // just 0 -> positive: shoppers can also subscribe when stock exists but is
      // fully reserved, and they must be told when more arrives.
      const prevRes = await query("SELECT stock FROM products WHERE id = $1", [id]);
      const prevStock = prevRes.rows[0]?.stock ?? 0;

      const res = await query(
        // Named columns instead of * — see createProduct: returning the base64
        // blobs we just wrote doubles the cost of every save for no benefit.
        "UPDATE products SET name = $1, description = $2, price = $3, image_url = $4, category_id = $5, sub_category_id = $6, colors = $7, images = $8, sizes = $9, has_sizes = $10, stock = $11 WHERE id = $12 RETURNING id, name, description, price, category_id, sub_category_id, colors, sizes, has_sizes, stock, created_at",
        [name, description, price, image_url, category_id, sub_category_id || null, JSON.stringify(colors || []), JSON.stringify(images || []), JSON.stringify(sizes || []), has_sizes !== undefined ? has_sizes : true, stock, id]
      );

      // Fire and forget: a mail failure must not fail the admin's save.
      if (res.rows[0]?.stock > prevStock && res.rows[0]?.stock > 0) {
        notifyBackInStock(id).catch(err =>
          console.error('Back-in-stock notification failed:', err)
        );
      }

      return res.rows[0];
    },
    deleteProduct: async (_: any, { id }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      await query("DELETE FROM products WHERE id = $1", [id]);
      return true;
    },
    updateHomeContent: async (_: any, { key, value, type, section }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');

      // Server-side safety net: the editor loads IMAGE rows as read-only
      // "/api/image/..." proxy URLs. If one of those is ever sent back as the
      // value of an IMAGE row, writing it would overwrite the real stored image
      // with the proxy URL string (self-referential) and destroy the image.
      // Reject it and keep the existing value untouched.
      if (type === 'IMAGE' && typeof value === 'string' && value.startsWith('/api/image/')) {
        const existing = await query("SELECT * FROM home_content WHERE key = $1", [key]);
        if (existing.rows[0]) return existing.rows[0];
        throw new Error('Refusing to store a proxy URL as an image');
      }

      // JSON slots (instagram_post_N) carry their picture inside `image_url`.
      // The editor omits that field when only the link/caption changed, and
      // never sends back a proxy URL — so merge onto the stored object to keep
      // the existing image instead of blanking it.
      if (type === 'JSON' && typeof value === 'string') {
        try {
          const incoming = JSON.parse(value);
          const proxyUrl = typeof incoming?.image_url === 'string' && incoming.image_url.startsWith('/api/image/');
          if (incoming && typeof incoming === 'object' && (incoming.image_url === undefined || proxyUrl)) {
            const existing = await query("SELECT value FROM home_content WHERE key = $1", [key]);
            const prev = existing.rows[0]?.value;
            if (typeof prev === 'string') {
              const prevObj = JSON.parse(prev);
              if (typeof prevObj?.image_url === 'string') {
                value = JSON.stringify({ ...incoming, image_url: prevObj.image_url });
              }
            }
          }
        } catch {
          // Not JSON / no previous row — fall through and store as sent.
        }
      }

      const res = await query(
        `INSERT INTO home_content (key, value, type, section)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value, type = EXCLUDED.type, section = EXCLUDED.section, updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [key, value, type, section]
      );
      return res.rows[0];
    },
    deleteHomeContent: async (_: any, { key }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      await query("DELETE FROM home_content WHERE key = $1", [key]);
      return true;
    },
    subscribeNewsletter: async (_: any, { email }: any) => {
      await query(
        "INSERT INTO newsletter (email) VALUES ($1) ON CONFLICT (email) DO NOTHING",
        [email]
      );
      return true;
    },
    deleteNewsletter: async (_: any, { id }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      await query("DELETE FROM newsletter WHERE id = $1", [id]);
      return true;
    },
    createOrder: async (_: any, { total, items, email, phone, address, city }: any, context: any) => {
      const userId = context.session?.user?.id || null;

      if (!Array.isArray(items) || items.length === 0) throw new Error('Le panier est vide.');

      // Never trust prices from the browser — re-read them from the database
      // and recompute the total, otherwise the cart can be edited client-side
      // to buy anything for any amount.
      const ids = items.map((it: any) => it.id).filter(Boolean);
      if (ids.length === 0) throw new Error('Panier invalide.');

      // Prices come with any active discount already applied, so an order is
      // charged the same amount the storefront advertised.
      const priceRes = await query(
        `SELECT p.id, p.name, p.price, p.stock, d.percent AS discount_percent
         FROM products p
         ${ACTIVE_DISCOUNT_JOIN}
         WHERE p.id = ANY($1::int[])`,
        [ids]
      );
      const priceById = new Map(
        priceRes.rows.map((r: any) => [String(r.id), {
          name: r.name,
          price: discountedPrice(Number(r.price), r.discount_percent),
          stock: r.stock
        }])
      );

      // Total requested per product across the cart, so two lines of the same
      // product (different sizes or colors) cannot together exceed stock.
      const requestedById = new Map<string, number>();
      for (const it of items) {
        const key = String(it.id);
        const qty = Math.max(1, parseInt(it.quantity, 10) || 1);
        requestedById.set(key, (requestedById.get(key) || 0) + qty);
      }
      for (const [productId, requested] of requestedById) {
        const known = priceById.get(productId);
        if (!known) throw new Error(`Produit introuvable: ${productId}`);
        // Never trust the browser's quantities: the cart lives in localStorage
        // and the request can be replayed by hand.
        if (typeof known.stock === 'number' && requested > known.stock) {
          throw new Error(
            `Stock insuffisant pour ${known.name}: ${requested} demandé(s), ${known.stock} disponible(s).`
          );
        }
      }

      const pricedItems = items.map((it: any) => {
        const known = priceById.get(String(it.id));
        if (!known) throw new Error(`Produit introuvable: ${it.id}`);
        const quantity = Math.max(1, parseInt(it.quantity, 10) || 1);
        return {
          ...it,
          quantity,
          price: known.price,
          name: known.name,
        };
      });

      const merchandiseTotal = Number(
        pricedItems.reduce((sum: number, it: any) => sum + it.price * it.quantity, 0).toFixed(2)
      );

      // Eligibility is decided here, never from the client, so the discount
      // cannot be claimed twice by replaying a request.
      const eligible = await isFirstOrderEmail(email);
      const discountPercent = eligible ? FIRST_ORDER_DISCOUNT_PERCENT : 0;
      const discountAmount = Number(((merchandiseTotal * discountPercent) / 100).toFixed(2));
      const serverTotal = Number((merchandiseTotal - discountAmount).toFixed(2));

      if (typeof total === 'number' && Math.abs(total - serverTotal) > 0.01) {
        console.warn(`Order total mismatch: client sent ${total}, server computed ${serverTotal}`);
      }

      const insertOrder = (dAmount: number, dPercent: number, orderTotal: number) => query(
        `INSERT INTO orders (user_id, total, discount_amount, discount_percent, status, customer_email, customer_phone, address, city)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *, created_at::text`,
        [userId, orderTotal, dAmount, dPercent, 'PENDING', email, phone, address, city]
      );

      let orderRes;
      try {
        orderRes = await insertOrder(discountAmount, discountPercent, serverTotal);
      } catch (err: any) {
        // 23505 = unique violation on the one-discount-per-email index: a
        // concurrent checkout claimed the discount first. Place the order at
        // full price rather than failing it.
        if (err?.code === '23505' && discountAmount > 0) {
          orderRes = await insertOrder(0, 0, merchandiseTotal);
        } else {
          throw err;
        }
      }
      const order = orderRes.rows[0];

      for (const item of pricedItems) {
        // product_name is snapshotted here on purpose: the product row can be
        // deleted later, and the sale must stay readable in the sales journal.
        await query(
          "INSERT INTO order_items (order_id, product_id, quantity, price, size, color, product_name) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [order.id, item.id, item.quantity, item.price, item.selectedSize, item.selectedColor, item.name]
        );
      }

      order.items = pricedItems.map((it: any) => ({ ...it, product_name: it.name }));
      return order;
    },
    updateOrderStatus: async (_: any, { id, status }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');

      // Read the previous status first: stock must only move on the actual
      // transition into COMPLETED, or re-saving a completed order would
      // decrement the same quantities again.
      const prevRes = await query("SELECT status FROM orders WHERE id = $1", [id]);
      const wasCompleted = prevRes.rows[0]?.status === 'COMPLETED';

      const res = await query(
        "UPDATE orders SET status = $1 WHERE id = $2 RETURNING *, created_at::text",
        [status, id]
      );
      const order = res.rows[0];

      if (status === 'COMPLETED' && order && !wasCompleted) {
        await query("UPDATE orders SET payment_status = 'PAID' WHERE id = $1", [id]);
        order.payment_status = 'PAID';
        const itemsRes = await query("SELECT product_id, quantity FROM order_items WHERE order_id = $1", [id]);
        for (const item of itemsRes.rows) {
          if (item.product_id) {
            await query("UPDATE products SET stock = GREATEST(0, stock - $1) WHERE id = $2", [item.quantity, item.product_id]);
          }
        }
      }

      // Leaving COMPLETED must give the stock back, otherwise "Remettre en
      // attente" silently loses inventory that was never actually sold.
      if (order && wasCompleted && status !== 'COMPLETED') {
        await restoreStockForOrder(id);
      }
      return order;
    },
    updateOrderPaymentStatus: async (_: any, { id, payment_status }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      const res = await query(
        "UPDATE orders SET payment_status = $1 WHERE id = $2 RETURNING *, created_at::text",
        [payment_status, id]
      );
      return res.rows[0];
    },
    cancelOrder: async (_: any, { id }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');

      const prev = await query("SELECT status FROM orders WHERE id = $1", [id]);
      if (!prev.rows[0]) throw new Error('Commande introuvable');
      if (prev.rows[0].status === 'CANCELLED') throw new Error('Commande déjà annulée');

      // Stock was only ever decremented on the move into COMPLETED, so it is
      // only given back when cancelling from that state.
      if (prev.rows[0].status === 'COMPLETED') {
        await restoreStockForOrder(id);
      }

      const res = await query(
        "UPDATE orders SET status = 'CANCELLED', payment_status = 'UNPAID' WHERE id = $1 RETURNING *, created_at::text",
        [id]
      );
      return res.rows[0];
    },
    restoreOrder: async (_: any, { id }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      // Comes back as PENDING, never straight to COMPLETED: re-confirming the
      // delivery is what re-applies the stock movement.
      const res = await query(
        "UPDATE orders SET status = 'PENDING' WHERE id = $1 RETURNING *, created_at::text",
        [id]
      );
      if (!res.rows[0]) throw new Error('Commande introuvable');
      return res.rows[0];
    },
    // Hard delete, unlike cancelOrder which keeps the row for the record.
    // Used when an order must leave the database entirely.
    deleteOrder: async (_: any, { id }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');

      const prev = await query("SELECT status FROM orders WHERE id = $1", [id]);
      if (!prev.rows[0]) throw new Error('Commande introuvable');

      // A COMPLETED order still holds the stock it deducted. Give it back
      // before the lines are gone, or those units are lost from inventory.
      // CANCELLED orders already returned theirs, so skip them.
      if (prev.rows[0].status === 'COMPLETED') {
        await restoreStockForOrder(id);
      }

      // order_items.order_id is ON DELETE CASCADE, so the lines go with it.
      const res = await query("DELETE FROM orders WHERE id = $1", [id]);
      return (res.rowCount ?? 0) > 0;
    },
    updateOrderItem: async (_: any, { id, quantity, price }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');

      const cur = await query(
        "SELECT order_id, product_id, quantity FROM order_items WHERE id = $1",
        [id]
      );
      const line = cur.rows[0];
      if (!line) throw new Error('Ligne introuvable');

      const newQty = quantity == null ? line.quantity : Math.max(1, quantity);

      // Keep stock in step with the edit, but only for an order that already
      // took stock (COMPLETED); otherwise nothing was deducted to correct.
      const ord = await query("SELECT status FROM orders WHERE id = $1", [line.order_id]);
      if (ord.rows[0]?.status === 'COMPLETED' && line.product_id && newQty !== line.quantity) {
        const delta = newQty - line.quantity;
        await query(
          "UPDATE products SET stock = GREATEST(0, stock - $1) WHERE id = $2",
          [delta, line.product_id]
        );
      }

      await query(
        "UPDATE order_items SET quantity = $1, price = COALESCE($2, price) WHERE id = $3",
        [newQty, price ?? null, id]
      );
      await recalculateOrderTotal(line.order_id);

      const res = await query("SELECT *, created_at::text FROM orders WHERE id = $1", [line.order_id]);
      return res.rows[0];
    },
    deleteOrderItem: async (_: any, { id }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');

      const cur = await query(
        "SELECT order_id, product_id, quantity FROM order_items WHERE id = $1",
        [id]
      );
      const line = cur.rows[0];
      if (!line) throw new Error('Ligne introuvable');

      const ord = await query("SELECT status FROM orders WHERE id = $1", [line.order_id]);
      if (ord.rows[0]?.status === 'COMPLETED' && line.product_id) {
        await query(
          "UPDATE products SET stock = stock + $1 WHERE id = $2",
          [line.quantity, line.product_id]
        );
      }

      await query("DELETE FROM order_items WHERE id = $1", [id]);
      await recalculateOrderTotal(line.order_id);

      const res = await query("SELECT *, created_at::text FROM orders WHERE id = $1", [line.order_id]);
      return res.rows[0];
    },
    createCharge: async (_: any, { description, amount, category, date }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      const res = await query(
        "INSERT INTO charges (description, amount, category, date) VALUES ($1, $2, $3, $4) RETURNING *, date::text",
        [description, amount, category, date || new Date().toISOString().split('T')[0]]
      );
      return res.rows[0];
    },
    deleteCharge: async (_: any, { id }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      await query("DELETE FROM charges WHERE id = $1", [id]);
      return true;
    },
    updateCart: async (_: any, { sessionId, items }: any) => {
      await query(
        "INSERT INTO carts (session_id, items, updated_at) VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP) ON CONFLICT (session_id) DO UPDATE SET items = EXCLUDED.items, updated_at = CURRENT_TIMESTAMP",
        [sessionId, items]
      );
      return true;
    },
    deleteCart: async (_: any, { sessionId }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      await query("DELETE FROM carts WHERE session_id = $1", [sessionId]);
      return true;
    },
    createCategory: async (_: any, { name, image_url }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      // New categories go to the end of the admin-defined order.
      const res = await query(
        "INSERT INTO categories (name, image_url, sort_order) VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories)) RETURNING id, name",
        [name, image_url]
      );
      return { 
        ...res.rows[0], 
        image_url: `/api/image/${res.rows[0].id}?type=category`
      };
    },
    updateCategory: async (_: any, { id, name, image_url }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      const res = await query(
        "UPDATE categories SET name = COALESCE($1, name), image_url = COALESCE($2, image_url) WHERE id = $3 RETURNING id, name",
        [name, image_url, id]
      );
      return { 
        ...res.rows[0], 
        image_url: `/api/image/${res.rows[0].id}?type=category`
      };
    },
    deleteCategory: async (_: any, { id }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      await query("DELETE FROM categories WHERE id = $1", [id]);
      return true;
    },
    sendChatMessage: async (_: any, { email, content, role }: any) => {
      let sessionRes = await query("SELECT id FROM chat_sessions WHERE user_email = $1", [email]);
      let sessionId;
      if (sessionRes.rows.length === 0) {
        const createRes = await query("INSERT INTO chat_sessions (user_email) VALUES ($1) RETURNING id", [email]);
        sessionId = createRes.rows[0].id;
      } else {
        sessionId = sessionRes.rows[0].id;
      }
      const res = await query(
        "INSERT INTO chat_messages (session_id, sender_role, content) VALUES ($1, $2, $3) RETURNING id, session_id, sender_role, content, created_at::text",
        [sessionId, role, content]
      );
      return res.rows[0];
    },
    deleteChatSession: async (_: any, { email }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      await query("DELETE FROM chat_sessions WHERE user_email = $1", [email]);
      return true;
    },
    sendEmailCampaign: async (_: any, { from, recipients, content, images }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      try {
        // One message per recipient, paced slightly apart. Bulk blasts from a
        // single connection are a strong spam signal, and per-recipient sends
        // let each carry its own unsubscribe link.
        for (const to of recipients) {
          await sendEmail({
            from,
            to: [to],
            subject: 'Campaign from SEAURA',
            content,
            images,
            unsubscribeEmail: to
          });
          await new Promise(r => setTimeout(r, 300));
        }
        return true;
      } catch (error) {
        console.error('Email Error:', error);
        throw new Error('Failed to send emails: ' + (error as Error).message);
      }
    },
    updateSetting: async (_: any, { key, value }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      const res = await query(
        "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP RETURNING *",
        [key, value]
      );
      return res.rows[0];
    },
    updateWishlist: async (_: any, { email, items }: any) => {
      await query(
        "INSERT INTO wishlists (user_email, items, updated_at) VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP) ON CONFLICT (user_email) DO UPDATE SET items = EXCLUDED.items, updated_at = CURRENT_TIMESTAMP",
        [email, items]
      );
      return true;
    },
    createSubCategory: async (_: any, { name, category_id, image_url }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      const res = await query(
        "INSERT INTO sub_categories (name, category_id, image_url, sort_order) VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM sub_categories WHERE category_id = $2)) RETURNING id, name, category_id",
        [name, category_id, image_url]
      );
      return { 
        ...res.rows[0], 
        image_url: `/api/image/${res.rows[0].id}?type=subcategory`
      };
    },
    updateSubCategory: async (_: any, { id, name, image_url }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      const res = await query(
        "UPDATE sub_categories SET name = COALESCE($1, name), image_url = COALESCE($2, image_url) WHERE id = $3 RETURNING id, name, category_id",
        [name, image_url, id]
      );
      return { 
        ...res.rows[0], 
        image_url: `/api/image/${res.rows[0].id}?type=subcategory`
      };
    },
    deleteSubCategory: async (_: any, { id }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      await query("DELETE FROM sub_categories WHERE id = $1", [id]);
      return true;
    },
    // Registers a "notify me when available" request. Public: shoppers who hit
    // a sold-out product are not logged in.
    notifyWhenAvailable: async (_: any, { product_id, email }: any) => {
      const normalized = (email || '').trim().toLowerCase();
      if (!normalized || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
        throw new Error('Adresse e-mail invalide.');
      }

      const prod = await query("SELECT id, name, stock FROM products WHERE id = $1", [product_id]);
      if (prod.rowCount === 0) throw new Error('Produit introuvable.');
      // Deliberately not requiring stock = 0: a shopper who wants more units
      // than are currently available has a legitimate reason to be told about
      // the next restock. The alert fires on the 0 -> in-stock transition.

      // ON CONFLICT keeps this idempotent: subscribing twice is a no-op rather
      // than an error the shopper has to understand.
      await query(
        `INSERT INTO stock_notifications (product_id, email) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [product_id, normalized]
      );
      return true;
    },
    createDiscount: async (_: any, { scope, target_id, percent, starts_at, ends_at }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');

      const scopes: Record<string, string> = {
        category: 'categories',
        subcategory: 'sub_categories',
        product: 'products'
      };
      const table = scopes[scope];
      if (!table) throw new Error("Portée invalide (category, subcategory ou product).");

      const pct = Number(percent);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
        throw new Error('Le pourcentage doit être compris entre 1 et 100.');
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(starts_at) || !/^\d{4}-\d{2}-\d{2}$/.test(ends_at)) {
        throw new Error('Dates invalides (format attendu: AAAA-MM-JJ).');
      }
      if (ends_at < starts_at) {
        throw new Error('La date de fin doit être postérieure à la date de début.');
      }

      // Table name comes from the whitelist above, never from user input.
      const exists = await query(`SELECT name FROM ${table} WHERE id = $1`, [target_id]);
      if (exists.rowCount === 0) throw new Error('Cible introuvable.');

      const res = await query(
        `INSERT INTO discounts (scope, target_id, percent, starts_at, ends_at)
         VALUES ($1, $2, $3, $4::date, $5::date)
         RETURNING id, scope, target_id, percent, starts_at::text, ends_at::text,
                   (CURRENT_DATE BETWEEN starts_at AND ends_at) AS is_active`,
        [scope, target_id, pct, starts_at, ends_at]
      );
      return {
        ...res.rows[0],
        percent: Number(res.rows[0].percent),
        target_name: exists.rows[0].name
      };
    },
    deleteDiscount: async (_: any, { id }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      await query("DELETE FROM discounts WHERE id = $1", [id]);
      return true;
    },
    // Sends one pending back-in-stock alert on demand, so the admin can notify a
    // shopper without waiting for a stock edit to trigger it.
    sendStockNotification: async (_: any, { id }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');

      // Claim first: the row only leaves "pending" if it was still pending, so
      // an automatic restock running at the same time cannot also send it.
      const claimed = await query(
        `UPDATE stock_notifications SET notified_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND notified_at IS NULL
         RETURNING id, email, product_id`,
        [id]
      );
      if (claimed.rowCount === 0) throw new Error('Cette notification a déjà été envoyée.');

      const row = claimed.rows[0];
      const prod = await query("SELECT id, name FROM products WHERE id = $1", [row.product_id]);
      if (prod.rowCount === 0) {
        await query("UPDATE stock_notifications SET notified_at = NULL WHERE id = $1", [row.id]);
        throw new Error('Produit introuvable.');
      }

      try {
        await sendEmail(backInStockMail(prod.rows[0], row.email));
      } catch (err: any) {
        // Restore the pending state so it can be retried.
        await query("UPDATE stock_notifications SET notified_at = NULL WHERE id = $1", [row.id]);
        throw new Error(err?.message || "L'envoi de l'e-mail a échoué.");
      }
      return true;
    },
    deleteStockNotification: async (_: any, { id }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      await query("DELETE FROM stock_notifications WHERE id = $1", [id]);
      return true;
    },
    // Moves a category one slot up or down by swapping sort_order with its
    // neighbour. Sub-categories follow automatically: they are nested under the
    // category in every query, so they travel with their parent.
    moveCategory: async (_: any, { id, direction }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      if (direction !== 'up' && direction !== 'down') throw new Error('Invalid direction');
      return swapSortOrder('categories', id, direction);
    },
    moveSubCategory: async (_: any, { id, direction }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      if (direction !== 'up' && direction !== 'down') throw new Error('Invalid direction');
      return swapSortOrder('sub_categories', id, direction);
    },
    updateUserPassword: async (_: any, { id, password }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      const hashedPassword = await bcrypt.hash(password, 10);
      await query("UPDATE users SET password = $1 WHERE id = $2", [hashedPassword, id]);
      return true;
    }
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

const handler = startServerAndCreateNextHandler(server, {
  context: async (req) => {
    const session = await getServerSession(authOptions);
    return { req, session };
  }
});

export const maxDuration = 60;

export async function GET(request: Request) {
  await initDb();
  return handler(request);
}

export async function POST(request: Request) {
  await initDb();
  return handler(request);
}
