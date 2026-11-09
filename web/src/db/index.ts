import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// A serverless instance is one process holding one pool; ten slots per instance would eat a managed
// pooler's connection budget within a few warm lambdas, so cap it there.
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: process.env.VERCEL ? 1 : 10 });

export const db = drizzle(pool, { schema });
export { schema };
