import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { gql } from 'graphql-tag';
import { query, initDb } from '@/lib/db';
import { authOptions } from '@/app/api/auth/[...nextauth]/auth';
import { getServerSession } from "next-auth/next";
import { sendEmail } from '@/lib/mail';

const typeDefs = gql`
  type User {
    id: ID!
    email: String!
    role: String!
  }

  type Category {
    id: ID!
    name: String!
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
    products: [Product!]!
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
  }

  type Mutation {
    createProduct(name: String!, description: String, price: Float!, image_url: String, category_id: ID, colors: [ColorInput!], images: [String!], sizes: [String!]): Product!
    updateProduct(id: ID!, name: String!, description: String, price: Float!, image_url: String, category_id: ID, colors: [ColorInput!], images: [String!], sizes: [String!]): Product!
    deleteProduct(id: ID!): Boolean!
    updateHomeContent(key: String!, value: String!, type: String!, section: String): HomeContent!
    subscribeNewsletter(email: String!): Boolean!
    createOrder(total: Float!, items: [OrderItemInput!]!, email: String, phone: String): Order!
    updateOrderStatus(id: ID!, status: String!): Order!
    updateCart(sessionId: String!, items: String!): Boolean!
    createCategory(name: String!): Category!
    deleteCategory(id: ID!): Boolean!
    sendChatMessage(email: String!, content: String!, role: String!): ChatMessage!
    deleteChatSession(email: String!): Boolean!
    sendEmailCampaign(from: String!, recipients: [String!]!, content: String!, images: [String!]): Boolean!
    updateSetting(key: String!, value: String!): Setting!
    updateWishlist(email: String!, items: String!): Boolean!
    createCharge(description: String!, amount: Float!, category: String, date: String): Charge!
    deleteCharge(id: ID!): Boolean!
    updateOrderPaymentStatus(id: ID!, payment_status: String!): Order!
  }
`;

const resolvers = {
  Query: {
    products: async () => {
      const res = await query(`
        SELECT id, name, price, description, category_id, colors, sizes, created_at,
               CASE WHEN length(image_url) > 5242880 THEN '/images/jewelry.png' ELSE image_url END as image_url,
               CASE WHEN length(images::text) > 5242880 THEN '[]' ELSE images::text END as images
        FROM products 
        ORDER BY created_at DESC
        LIMIT 20
      `);
      // Parse images back to JSON since we casted to text for length check
      return res.rows.map(r => ({
        ...r,
        images: typeof r.images === 'string' ? JSON.parse(r.images) : r.images
      }));
    },
    categories: async () => {
      const res = await query("SELECT * FROM categories");
      return res.rows;
    },
    homeContent: async () => {
      const res = await query(`
        SELECT id, key, type, section,
               CASE WHEN length(value) > 5242880 THEN '/images/hero.png' ELSE value END as value
        FROM home_content
      `);
      return res.rows;
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
    chatHistory: async (_: any, { email }: any) => {
      const res = await query(
        "SELECT m.id, m.session_id, m.sender_role, m.content, m.created_at::text FROM chat_messages m JOIN chat_sessions s ON m.session_id = s.id WHERE s.user_email = $1 ORDER BY m.created_at ASC",
        [email]
      );
      return res.rows;
    },
    orders: async (_: any, __: any, context: any) => {
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
      try {
        const res = await query("SELECT id, session_id, items, updated_at::text FROM carts ORDER BY updated_at DESC LIMIT 50");
        // Diagnostic : on s'assure que chaque champ est bien là, quitte à forcer les noms
        return res.rows.map(row => {
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
    wishlist: async (_: any, { email }: any) => {
      const res = await query("SELECT items FROM wishlists WHERE user_email = $1", [email]);
      return res.rows[0] ? JSON.stringify(res.rows[0].items) : "[]";
    },
    charges: async (_: any, __: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      const res = await query("SELECT * FROM charges ORDER BY date DESC");
      return res.rows;
    },
    searchProducts: async (_: any, { term }: any) => {
      const res = await query(
        `SELECT id, name, price, 
                CASE WHEN length(image_url) > 5242880 THEN NULL ELSE image_url END as image_url,
                CASE WHEN length(images::text) > 5242880 THEN '[]' ELSE images::text END as images
         FROM products 
         WHERE name ILIKE $1 OR description ILIKE $1 
         ORDER BY created_at DESC LIMIT 6`,
        [`%${term}%`]
      );
      return res.rows.map(r => ({
        ...r,
        images: typeof r.images === 'string' ? JSON.parse(r.images) : r.images
      }));
    },
    product: async (_: any, { id }: any) => {
      const res = await query(`
        SELECT id, name, price, description, category_id, colors, sizes,
               CASE WHEN length(image_url) > 5242880 THEN '/images/jewelry.png' ELSE image_url END as image_url,
               CASE WHEN length(images::text) > 5242880 THEN '[]' ELSE images::text END as images
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
    createProduct: async (_: any, { name, description, price, image_url, category_id, colors, images, sizes }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      const res = await query(
        "INSERT INTO products (name, description, price, image_url, category_id, colors, images, sizes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
        [name, description, price, image_url, category_id, JSON.stringify(colors || []), JSON.stringify(images || []), JSON.stringify(sizes || [])]
      );
      return res.rows[0];
    },
    updateProduct: async (_: any, { id, name, description, price, image_url, category_id, colors, images, sizes }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      const res = await query(
        "UPDATE products SET name = $1, description = $2, price = $3, image_url = $4, category_id = $5, colors = $6, images = $7, sizes = $8 WHERE id = $9 RETURNING *",
        [name, description, price, image_url, category_id, JSON.stringify(colors || []), JSON.stringify(images || []), JSON.stringify(sizes || []), id]
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
    createOrder: async (_: any, { total, items, email, phone }: any, context: any) => {
      const userId = context.session?.user?.id || null;
      const orderRes = await query(
        "INSERT INTO orders (user_id, total, status, customer_email, customer_phone) VALUES ($1, $2, $3, $4, $5) RETURNING *, created_at::text",
        [userId, total, 'PENDING', email, phone]
      );
      const order = orderRes.rows[0];
      
      for (const item of items) {
        await query(
          "INSERT INTO order_items (order_id, product_id, quantity, price, size, color) VALUES ($1, $2, $3, $4, $5, $6)",
          [order.id, item.id, item.quantity || 1, item.price, item.selectedSize, item.selectedColor]
        );
      }
      
      order.items = items.map((it: any) => ({ ...it, product_name: it.name }));
      return order;
    },
    updateOrderStatus: async (_: any, { id, status }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      const res = await query(
        "UPDATE orders SET status = $1 WHERE id = $2 RETURNING *, created_at::text",
        [status, id]
      );
      return res.rows[0];
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
    createCategory: async (_: any, { name }: any, context: any) => {
      if (context.session?.user?.role !== 'ADMIN') throw new Error('Not authorized');
      const res = await query(
        "INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING *",
        [name]
      );
      return res.rows[0];
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
