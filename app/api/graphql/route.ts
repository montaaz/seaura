import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { gql } from 'graphql-tag';
import { query, initDb } from '@/lib/db';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth';
import { getServerSession } from "next-auth/next";
import { sendEmail } from '@/lib/mail';
import * as bcrypt from 'bcrypt';

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
    sub_categories: [SubCategory!]
  }

  type SubCategory {
    id: ID!
    name: String!
    category_id: ID!
    image_url: String
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
    status: String!
    payment_status: String!
    created_at: String
    items: [OrderItem!]
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
  }

  type Mutation {
    createProduct(name: String!, description: String, price: Float!, image_url: String, category_id: ID, colors: [ColorInput!], images: [String!], sizes: [String!], has_sizes: Boolean, stock: Int): Product!
    updateProduct(id: ID!, name: String!, description: String, price: Float!, image_url: String, category_id: ID, colors: [ColorInput!], images: [String!], sizes: [String!], has_sizes: Boolean, stock: Int): Product!
    deleteProduct(id: ID!): Boolean!
    updateHomeContent(key: String!, value: String!, type: String!, section: String): HomeContent!
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
    createSubCategory(name: String!, category_id: ID!, image_url: String): SubCategory!
    updateSubCategory(id: ID!, name: String, image_url: String): SubCategory!
    deleteSubCategory(id: ID!): Boolean!
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
        SELECT id, name, price, description, category_id, colors, sizes, has_sizes, stock, created_at,
               left(md5(coalesce(image_url,'') || coalesce(images::text,'')), 8) AS v
        FROM products
        ORDER BY created_at DESC
        ${limitStr}
      `);
      return res.rows.map((r: any) => ({
        ...r,
        // ?v=<fingerprint> busts the browser cache whenever the stored image
        // changes, so edited product images appear immediately.
        image_url: `/api/image/${r.id}?v=${r.v}`,
        images: [`/api/image/${r.id}?idx=0&v=${r.v}`, `/api/image/${r.id}?idx=1&v=${r.v}`]
      }));
    },
    categories: async () => {
      const res = await query("SELECT id, name, left(md5(coalesce(image_url,'')), 8) AS v FROM categories ORDER BY name ASC");
      const subRes = await query("SELECT id, name, category_id, left(md5(coalesce(image_url,'')), 8) AS v FROM sub_categories ORDER BY name ASC");

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
    subCategories: async (_: any, { categoryId }: { categoryId?: string }) => {
      const where = categoryId ? `WHERE category_id = $1` : '';
      const params = categoryId ? [categoryId] : [];
      const res = await query(`SELECT id, name, category_id, left(md5(coalesce(image_url,'')), 8) AS v FROM sub_categories ${where} ORDER BY name ASC`, params);
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
        // Safety net: never ship a giant inline base64 image inside a JSON
        // slot to the editor — it freezes the DOM. Replace it with a
        // placeholder so the admin can just re-upload a compressed image.
        if (r.type === 'JSON' && typeof r.value === 'string' && r.value.includes('data:image')) {
          try {
            const obj = JSON.parse(r.value);
            if (typeof obj.image_url === 'string' && obj.image_url.startsWith('data:image')) {
              obj.image_url = '/logo1.png';
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
                     'product_name', p.name
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
        SELECT id, name, price, description, category_id, colors, sizes, has_sizes, image_url, images, stock
        FROM products WHERE id = $1
      `, [id]);
      const r = res.rows[0];
      if (!r) return null;
      return {
        ...r,
        images: typeof r.images === 'string' ? JSON.parse(r.images) : r.images
      };
    }
  },
  Mutation: {
    createProduct: async (_: any, { name, description, price, image_url, category_id, colors, images, sizes, has_sizes, stock }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      const res = await query(
        "INSERT INTO products (name, description, price, image_url, category_id, colors, images, sizes, has_sizes, stock) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *",
        [name, description, price, image_url, category_id, JSON.stringify(colors || []), JSON.stringify(images || []), JSON.stringify(sizes || []), has_sizes !== undefined ? has_sizes : true, stock || 10]
      );
      return res.rows[0];
    },
    updateProduct: async (_: any, { id, name, description, price, image_url, category_id, colors, images, sizes, has_sizes, stock }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      const res = await query(
        "UPDATE products SET name = $1, description = $2, price = $3, image_url = $4, category_id = $5, colors = $6, images = $7, sizes = $8, has_sizes = $9, stock = $10 WHERE id = $11 RETURNING *",
        [name, description, price, image_url, category_id, JSON.stringify(colors || []), JSON.stringify(images || []), JSON.stringify(sizes || []), has_sizes !== undefined ? has_sizes : true, stock, id]
      );
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

      const priceRes = await query(
        "SELECT id, name, price FROM products WHERE id = ANY($1::int[])",
        [ids]
      );
      const priceById = new Map(
        priceRes.rows.map((r: any) => [String(r.id), { name: r.name, price: Number(r.price) }])
      );

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

      const serverTotal = Number(
        pricedItems.reduce((sum: number, it: any) => sum + it.price * it.quantity, 0).toFixed(2)
      );

      if (typeof total === 'number' && Math.abs(total - serverTotal) > 0.01) {
        console.warn(`Order total mismatch: client sent ${total}, server computed ${serverTotal}`);
      }

      const orderRes = await query(
        "INSERT INTO orders (user_id, total, status, customer_email, customer_phone, address, city) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *, created_at::text",
        [userId, serverTotal, 'PENDING', email, phone, address, city]
      );
      const order = orderRes.rows[0];

      for (const item of pricedItems) {
        await query(
          "INSERT INTO order_items (order_id, product_id, quantity, price, size, color) VALUES ($1, $2, $3, $4, $5, $6)",
          [order.id, item.id, item.quantity, item.price, item.selectedSize, item.selectedColor]
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
      const res = await query(
        "INSERT INTO categories (name, image_url) VALUES ($1, $2) RETURNING id, name",
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
        await sendEmail({ from, to: recipients, subject: 'Campaign from SEAURA', content, images });
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
        "INSERT INTO sub_categories (name, category_id, image_url) VALUES ($1, $2, $3) RETURNING id, name, category_id",
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
