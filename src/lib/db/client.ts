import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Sin `ssl`, pg se conecta en texto plano. DATABASE_CA_CERT es el certificado
// que da Supabase (Settings → Database → SSL Configuration), en una sola
// línea con \n, igual que FIREBASE_ADMIN_PRIVATE_KEY.
const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: ca ? { ca } : undefined,
  max: 5,
});

export const db = drizzle(pool, { schema });
